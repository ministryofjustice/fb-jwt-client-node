const got = require('got')
const merge = require('got/source/merge')
const jwt = require('jsonwebtoken')
const pathToRegexp = require('path-to-regexp')
const crypto = require('crypto')

const aes256 = require('./fb-jwt-aes256')

const {FBError} = require('@ministryofjustice/fb-utils-node')
class FBJWTClientError extends FBError {}

// algo to encrypt user data with
const algorithm = 'HS256'

const getResponseLabels = (response) => {
  const responseLabels = {}

  if (response.status) {
    responseLabels.status = response.status
  }

  if (response.statusCode) {
    responseLabels.status_code = response.statusCode
  }

  if (response.statusMessage) {
    responseLabels.status_message = response.statusMessage
  }

  return responseLabels
}

const getErrorStatusCode = (message) => {
  let statusCode = 500
  if (message === 'ENOTFOUND') {
    // no dns resolution
    statusCode = 502
  } else if (message === 'ECONNREFUSED') {
    // connection rejected
    statusCode = 503
  }
  return statusCode
}

/**
 * Creates client using JSON Web Tokens
 * @class
 */
class FBJWTClient {
  /**
   * Initialise client
   *
   * @param {string} serviceSecret
   * Service secret
   *
   * @param {string} serviceToken
   * Service token
   *
   * @param {string} serviceSlug
   * Service slug
   *
   * @param {string} microserviceUrl
   * URL of microservice to communicate with
   *
   * @param {error} [errorClass]
   * Error class (defaults to FBJWTClientError)
   *
   * @return {object}
   **/
  constructor (serviceSecret, serviceToken, serviceSlug, microserviceUrl, errorClass) {
    if (errorClass) {
      this.ErrorClass = errorClass
    }

    if (!serviceSecret) {
      this.throwRequestError('ENOSERVICESECRET', 'No service secret passed to client')
    }
    if (!serviceToken) {
      this.throwRequestError('ENOSERVICETOKEN', 'No service token passed to client')
    }
    if (!serviceSlug) {
      this.throwRequestError('ENOSERVICESLUG', 'No service slug passed to client')
    }
    if (!microserviceUrl) {
      this.throwRequestError('ENOMICROSERVICEURL', 'No microservice url passed to client')
    }

    this.serviceSecret = serviceSecret
    this.serviceToken = serviceToken
    this.serviceUrl = microserviceUrl
    this.serviceSlug = serviceSlug

    // provide default Prometheus startTimer behaviour so as not to have to wrap all instrumentation calls in conditionals
    const startTimer = () => () => ({})

    this.apiMetrics = {
      startTimer
    }

    this.requestMetrics = {
      startTimer
    }
  }

  /**
   * Add metrics recorders for requests
   *
   * @param {object} apiMetrics
   * Prometheus histogram instance
   *
   * @param {object} requestMetrics
   * Prometheus histogram instance
   *
   * @return {undefined}
   *
   **/
  setMetricsInstrumentation (apiMetrics, requestMetrics) {
    this.apiMetrics = apiMetrics
    this.requestMetrics = requestMetrics
  }

  /**
   * Generate access token
   *
   * @param {string} [data]
   * Request data
   *
   * @return {string}
   * Access token
   *
   **/
  generateAccessToken (data) {
    const checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')

    return jwt.sign({checksum}, this.serviceToken, {algorithm})
  }

  /**
   * Encrypt data with AES 256
   *
   * @param {string} token
   * Token
   *
   * @param {any} data
   * Request data
   *
   * @param {string} [ivSeed]
   * Initialization Vector
   *
   * @return {string}
   * Encrypted data
   *
   **/
  encrypt (token, data, ivSeed) {
    return aes256.encrypt(token, JSON.stringify(data), ivSeed)
  }

  /**
   * Decrypt data
   *
   * @param {string} token
   * Token
   *
   * @param {string} data
   * Encrypted data
   *
   * @return {string}
   * Decrypted data
   *
   **/
  decrypt (token, data) {
    try {
      return JSON.parse(aes256.decrypt(token, data))
    } catch (e) {
      this.throwRequestError(500, 'EINVALIDPAYLOAD')
    }
  }

  /**
   * Encrypt user ID and token using service secret
   *
   * Guaranteed to return the same value
   *
   * @param {string} userId
   * User ID
   *
   * @param {string} userToken
   * User token
   *
   * @return {string}
   *
   **/
  encryptUserIdAndToken (userId, userToken) {
    const ivSeed = userId + userToken

    return this.encrypt(this.serviceSecret, {userId, userToken}, ivSeed)
  }

  /**
   * Decrypt user ID and token using service secret
   *
   * @param {string} data
   * Encrypted user ID and token
   *
   * @return {object}
   *
   **/
  decryptUserIdAndToken (data) {
    return this.decrypt(this.serviceSecret, data)
  }

  /**
   * Create user-specific endpoint
   *
   * @param {string} urlPattern
   * Uncompiled pathToRegexp url pattern
   *
   * @param {object} context
   * Object of values to substitute
   *
   * @return {string}
   * Endpoint URL
   *
   **/
  createEndpointUrl (urlPattern, context = {}) {
    const toPath = pathToRegexp.compile(urlPattern)

    return this.serviceUrl + toPath(context)
  }

  /**
   * Create request options
   *
   * @param {string} urlPattern
   * Uncompiled pathToRegexp url pattern
   *
   * @param {string} context
   * User ID
   *
   * @param {object} [data]
   * Payload
   *
   * @param {boolean} [isGET]
   * Send payload as query string
   *
   * @return {object}
   * Request options
   *
   **/
  createRequestOptions (urlPattern, context, data = {}, isGET) {
    const accessToken = this.generateAccessToken(data)
    const url = this.createEndpointUrl(urlPattern, context)
    const hasData = !!Object.keys(data).length

    const requestOptions = {
      url,
      headers: {
        'x-access-token': accessToken
      },
      responseType: 'json'
    }

    if (isGET) {
      if (hasData) {
        requestOptions.searchParams = {
          payload: Buffer.from(JSON.stringify(data)).toString('Base64')
        }
      }
    } else {
      requestOptions.json = data
    }

    return requestOptions
  }

  logError (type, error, labels, logger) {
    if (Reflect.has(error, 'gotOptions')) {
      const {
        gotOptions: {
          headers
        }
      } = error

      error.client_headers = headers
    }

    const {
      client_name: name
    } = labels

    if ((error.body || false) instanceof Object) error.error = error.body

    const logObject = Object.assign({}, labels, {error})

    /*
     *  This is ugly but at least it's not a single super long line of stupid
     */
    const logMessage = `JWT ${type} request error: ${name}:`
      .concat(' ')
      .concat(labels.method.toUpperCase())
      .concat(' ')
      .concat([
        labels.base_url.concat(labels.url),
        error.name || '',
        error.code || '',
        error.statusCode || '',
        error.statusMessage || ''
      ].join(' - ').concat(' - '))
      .concat(
        error.error ? JSON.stringify(error.error) : ''
      )

    if (logger) logger.error(logObject, logMessage)
  }

  /**
   * Handle client requests
   *
   * @param {string} method
   * Method for request
   *
   * @param {object} args
   * Args for request
   *
   * @param {string} args.urlPattern
   * Url pattern for request
   *
   * @param {object} args.context
   * Context for url pattern substitution
   *
   * @param {object} [args.payload]
   * Payload to send as query param to endpoint
   *
   * @param {object} [args.sendOptions]
   * Additional options to pass to got method
   *
   * @param {object} [logger]
   * Bunyan logger instance
   *
   * @return {object}
   * Returns JSON object or handles exception
   *
   **/
  async send (method, args, logger) {
    const {
      url,
      context = {},
      payload,
      sendOptions = {}
    } = args

    const client = this
    const client_name = this.constructor.name // eslint-disable-line camelcase
    const base_url = this.serviceUrl // eslint-disable-line camelcase
    const requestOptions = this.createRequestOptions(url, context, payload, method === 'get')

    const labels = {
      client_name,
      base_url,
      url,
      method
    }

    function logError (type, error) {
      client.logError(type, error, Object.assign({}, labels, {name: `jwt_${type.toLowerCase()}_request_error`}), logger)
    }

    let requestMetricsEnd
    let retryCounter = 1

    const gotOptions = merge.options(got.defaults.options, {
      hooks: {
        beforeRequest: [
          () => {
            requestMetricsEnd = this.requestMetrics.startTimer(labels)
          }
        ],
        beforeRetry: [
          (options, error, retryCount) => {
            error.retryCount = retryCounter = retryCount

            logError('client', error)

            if (requestMetricsEnd) requestMetricsEnd(getResponseLabels(error))
            requestMetricsEnd = this.requestMetrics.startTimer(labels)
          }
        ],
        beforeError: [
          (error) => {
            error.retryCount = retryCounter
            if (requestMetricsEnd) requestMetricsEnd(getResponseLabels(error))
            return error
          }
        ],
        afterResponse: [
          (response) => {
            if (response.statusCode >= 400) {
              const {
                statusCode,
                statusMessage,
                body,
                retryCount
              } = response

              const error = {
                statusCode,
                statusMessage,
                body,
                retryCount
              }

              logError('client', error)
            }

            if (requestMetricsEnd) requestMetricsEnd(getResponseLabels(response))
            response.body = response.body || '{}'
            return response
          }
        ]
      }
    }, sendOptions, requestOptions, {method})

    const apiMetricsEnd = this.apiMetrics.startTimer(labels)

    try {
      const response = await got[method](gotOptions)

      apiMetricsEnd(getResponseLabels(response))

      if (response.body && /^\s*$/.test(response.body)) return {}
      return response.body
    } catch (e) {
      const {response = {}} = e
      if (response.statusCode < 300) {
        if (response.body && /^\s*$/.test(response.body)) {
          if (requestMetricsEnd) requestMetricsEnd(getResponseLabels(response))
          return {}
        }
      }

      apiMetricsEnd(getResponseLabels(e))

      if (logger) logError('API', e)

      client.handleRequestError(e)
    }
  }

  /**
   * Handle client get requests
   *
   * @param {object} args
   * Args for request
   *
   * @param {string} args.url
   * Url pattern for request
   *
   * @param {object} args.context
   * Context for url pattern substitution
   *
   * @param {object} [args.payload]
   * Payload to send as query param to endpoint
   *
   * @param {object} [args.sendOptions]
   * Additional options to pass to got method
   *
   * @param {object} [logger]
   * Bunyan logger instance
   *
   * @return {promise<object>}
   * Returns promise resolving to JSON object or handles exception
   *
   **/
  async sendGet (args, logger) {
    return this.send('get', args, logger)
  }

  /**
   * Handle client post requests
   *
   * @param {object} args
   * Args for request
   *
   * @param {string} args.url
   * Url pattern for request
   *
   * @param {object} args.context
   * Context for url pattern substitution
   *
   * @param {object} args.payload
   * Payload to post to endpoint
   *
   * @param {object} [args.sendOptions]
   * Additional options to pass to got method
   *
   * @param {object} [logger]
   * Bunyan logger instance
   *
   * @return {promise<object>}
   * Returns promise resolving to JSON object or handles exception
   *
   **/
  async sendPost (args, logger) {
    return this.send('post', args, logger)
  }

  /**
   * Handle client response errors
   *
   * @param {object} e
   * Error returned by Request
   *
   * @return {undefined}
   * Returns nothing as it should throw an error
   *
   **/
  handleRequestError (e) {
    // rethrow error if already client error
    if (e instanceof this.ErrorClass) throw e

    // adjust
    if ((e.body || false) instanceof Object) e.error = e.body

    const {
      statusCode
    } = e

    if (statusCode) {
      if (statusCode > 400 && statusCode < 500) {
        // Data does not exist - ie. expired
        this.throwRequestError(statusCode)
      } else {
        if (e.error) {
          // Handle errors which have an error object
          const message = e.error.name || e.error.code || 'EUNSPECIFIED'
          this.throwRequestError(statusCode, message)
        } else {
          // Handle errors which have no error object
          const message = e.code || 'ENOERROR'
          this.throwRequestError(statusCode, message)
        }
      }
    } else if (e.error) {
      // Handle errors which have an error object
      const message = e.error.name || e.error.code || 'EUNSPECIFIED'
      const statusCode = getErrorStatusCode(message)
      this.throwRequestError(statusCode, message)
    } else {
      // Handle errors which have no error object
      const message = e.code || 'ENOERROR'
      const statusCode = getErrorStatusCode(message)
      this.throwRequestError(statusCode, message)
    }
  }

  /**
   * Convenience function for throwing errors
   *
   * @param {number|string} code
   * Error code
   *
   * @param {string} [message]
   * Error message (defaults to code)
   *
   * @return {undefined}
   * Returns nothing as it should throw an error
   *
   **/
  throwRequestError (code, message) {
    message = message || code
    throw new this.ErrorClass({
      error: {
        code,
        message
      }
    })
  }
}

// default client error class
FBJWTClient.prototype.ErrorClass = FBJWTClientError

module.exports = FBJWTClient

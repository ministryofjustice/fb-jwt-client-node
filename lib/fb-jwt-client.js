const request = require('request-promise-native')
const jwt = require('jsonwebtoken')
const pathToRegexp = require('path-to-regexp')
const crypto = require('crypto')
const aes256 = require('./fb-jwt-aes256')

const {FBError} = require('@ministryofjustice/fb-utils-node')
class FBJWTClientError extends FBError {}

// algo to encrypt user data with
const algorithm = 'HS256'

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
    // NB. jsonwebtoken helpfully sets ‘iat’ option by default
    let checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
    const payload = {checksum}
    const accessToken = jwt.sign(payload, this.serviceToken, {algorithm})
    return accessToken
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
    const dataString = JSON.stringify(data)
    const encryptedData = aes256.encrypt(token, dataString, ivSeed)
    return encryptedData
  }

  /**
   * Decrypt data
   *
   * @param {string} token
   * Token
   *
   * @param {string} encryptedData
   * Encrypted data
   *
   * @return {string}
   * Decrypted data
   *
   **/
  decrypt (token, encryptedData) {
    let data
    try {
      data = aes256.decrypt(token, encryptedData)
      data = JSON.parse(data)
    } catch (e) {
      this.throwRequestError(500, 'EINVALIDPAYLOAD')
    }
    return data
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
    const serviceSecret = this.serviceSecret
    const ivSeed = userId + userToken
    return this.encrypt(serviceSecret, {userId, userToken}, ivSeed)
  }

  /**
   * Decrypt user ID and token using service secret
   *
   * @param {string} encryptedData
   * Encrypted user ID and token
   *
   * @return {object}
   *
   **/
  decryptUserIdAndToken (encryptedData) {
    const serviceSecret = this.serviceSecret
    return this.decrypt(serviceSecret, encryptedData)
  }

  /**
   * Create user-specific endpoint
   *
   * @param {string} urlPattern
   * Uncompiled pathToRegexp url pattern
   *
   * @param {object} urlKeys
   * Object of values to substitute
   *
   * @return {string}
   * Endpoint URL
   *
   **/
  createEndpointUrl (urlPattern, urlKeys = {}) {
    const toPath = pathToRegexp.compile(urlPattern)
    const endpointUrl = this.serviceUrl + toPath(urlKeys)
    return endpointUrl
  }

  /**
   * Create request options
   *
   * @param {string} urlPattern
   * Uncompiled pathToRegexp url pattern
   *
   * @param {string} urlKeys
   * User ID
   *
   * @param {object} [data]
   * Payload
   *
   * @param {boolean} [qs]
   * Send payload as query strinf
   *
   * @return {object}
   * Request options
   *
   **/
  createRequestOptions (urlPattern, urlKeys, data = {}, qs) {
    const accessToken = this.generateAccessToken(data)
    const url = this.createEndpointUrl(urlPattern, urlKeys)
    const hasData = Object.keys(data).length
    const json = hasData && !qs ? data : true
    const requestOptions = {
      url,
      headers: {
        'x-access-token': accessToken
      },
      json
    }
    if (qs && hasData) {
      requestOptions.qs = {
        payload: Buffer.from(JSON.stringify(data)).toString('Base64')
      }
    }
    return requestOptions
  }

  /**
   * Handle client get requests
   *
   * @param {string} urlPattern
   * Url pattern for request
   *
   * @param {object} urlKeys
   * Keys for url pattern substitution
   *
   * @param {object} [payload]
   * Payload to send as query param to endpoint
   *
   * @return {object}
   * Returns JSON object or handles exception
   *
   **/
  sendGet (urlPattern, urlKeys, payload) {
    const client = this
    const options = this.createRequestOptions(urlPattern, urlKeys, payload, true)
    return request.get(options)
      .catch(e => client.handleRequestError(e))
  }

  /**
   * Handle client post requests
   *
   * @param {string} urlPattern
   * Url pattern for request
   *
   * @param {object} urlKeys
   * Keys for url pattern substitution
   *
   * @param {object} payload
   * Payload to post to endpoint
   *
   * @return {object}
   * Returns JSON object or handles exception
   *
   **/
  sendPost (urlPattern, urlKeys, payload) {
    const client = this
    const options = this.createRequestOptions(urlPattern, urlKeys, payload)
    return request.post(options)
      .catch(e => client.handleRequestError(e))
  }

  /**
   * Handle client response errors
   *
   * @param {object} err
   * Error returned by Request
   *
   * @return {undefined}
   * Returns nothing as it should throw an error
   *
   **/
  handleRequestError (err) {
    // rethrow error if already client error
    if (err.name === this.ErrorClass.name) {
      throw err
    }
    const {statusCode} = err
    if (statusCode) {
      if (statusCode === 404) {
        // Data does not exist - ie. expired
        this.throwRequestError(404)
      } else {
        this.throwRequestError(statusCode)
      }
    } else if (err.error) {
      const message = err.error.name || err.error.code || 'EUNSPECIFIED'
      let statusCode = 500
      if (message === 'ENOTFOUND') {
        // no dns resolution
        statusCode = 502
      } else if (message === 'ECONNREFUSED') {
        // connection rejected
        statusCode = 503
      }
      this.throwRequestError(statusCode, message)
      // Handle errors that have not been specified
    } else {
      // Handle errors which have no error object
      this.throwRequestError(500, 'ENOERROR')
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

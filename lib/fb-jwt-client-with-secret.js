const FBJWTClient = require('./fb-jwt-client')
class FBJWTClientWithSecretError extends FBJWTClient.prototype.ErrorClass {}

/**
 * Creates FB JWT client with service secret and associated methods
 * @class
 */
class FBJWTClientWithSecret extends FBJWTClient {
  /**
   * Initialise submitter client
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
   * @param {string} submitterUrl
   * URL of microservice to communicate with
   *
   * @param {error} errorClass
   * Error class (defaults to FBJWTClientWithSecretError)
   *
   * @return {object}
   *
   **/
  constructor (serviceSecret, serviceToken, serviceSlug, submitterUrl, errorClass) {
    super(serviceToken, serviceSlug, submitterUrl, errorClass || FBJWTClientWithSecretError)
    if (!serviceSecret) {
      throw new this.ErrorClass('No service secret passed to client', {
        error: {
          code: 'ENOSERVICESECRET'
        }
      })
    }
    this.serviceSecret = serviceSecret
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
}

module.exports = FBJWTClientWithSecret

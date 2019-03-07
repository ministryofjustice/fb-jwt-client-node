const test = require('tape')
const {useFakeTimers} = require('sinon')

const jwt = require('jsonwebtoken')

// const request = require('request-promise-native')

const FBJWTClientWithSecret = require('./fb-jwt-client-with-secret')

/* test values */
const userId = 'testUserId'
const submissionId = 'testSubmissionId'
const userToken = 'testUserToken'
const serviceSlug = 'testServiceSlug'
const serviceToken = 'testServiceToken'
const serviceSecret = 'testServiceSecret'
const endpointUrl = 'https://endpoint'
const routeUrl = `${endpointUrl}/submission`
const routeWithSubsitutionUrl = `${endpointUrl}/submission/${submissionId}`
const userIdTokenData = {userId, userToken}
const encryptedUserIdTokenData = 'Ejo7ypk1TFQNAbbkUFW8NeQhcZt1Wxf1IJNLhDjbtpoUdfluylSqWDCRXuulEqMiCdiQzhjIeLHANj9mMK0sMl6jTA=='
const expectedEncryptedData = 'pOXXs5YW9mUW1weBLNawiMRFdk6Hh92YBfGqmg8ych8PqnZ5l8JbcqHXHKjmcrKYJqZXn53sFr/eCq7Mbh5j9rj87w=='

// Ensure that client is properly instantiated

/**
 * Convenience function for testing client instantiation
 *
 * @param {object} t
 *  Object containing tape methods
 *
 * @param {array} params
 *  Arguments to pass to client constructor
 *
 * @param {string} expectedCode
 *  Error code expected to be returned by client
 *
 * @param {string} expectedMessage
 *  Error message expected to be returned by client
 *
 * @return {undefined}
 *
 **/
const testInstantiation = (t, params, expectedCode, expectedMessage) => {
  t.plan(4)

  let failedClient
  try {
    failedClient = new FBJWTClientWithSecret(...params)
  } catch (e) {
    t.equal(e.name, 'FBJWTClientWithSecretError', 'it should return an error of the correct type')
    t.equal(e.code, expectedCode, 'it should return the correct error code')
    t.equal(e.message, expectedMessage, 'it should return the correct error message')
  }
  t.equal(failedClient, undefined, 'it should not return an instantiated client')
}

test('When instantiating submitter client without a service token', t => {
  testInstantiation(t, [undefined, serviceSecret, serviceToken, serviceSlug], 'ENOSERVICESECRET', 'No service secret passed to client')
})

test('When instantiating submitter client without a service token', t => {
  testInstantiation(t, [], 'ENOSERVICETOKEN', 'No service token passed to client')
})

test('When instantiating submitter client without a service slug', t => {
  testInstantiation(t, [serviceSecret, serviceToken], 'ENOSERVICESLUG', 'No service slug passed to client')
})

test('When instantiating submitter client without a submitter url', t => {
  testInstantiation(t, [serviceSecret, serviceToken, serviceSlug], 'ENOMICROSERVICEURL', 'No microservice url passed to client')
})

// Set up a client to test the methods
const jwtClientWithSecret = new FBJWTClientWithSecret(serviceSecret, serviceToken, serviceSlug, endpointUrl)

// Endpoint URLs
test('When asking for endpoint urls', t => {
  const getUrl =
  jwtClientWithSecret.createEndpointUrl('/submission')
  t.equal(getUrl, routeUrl, 'it should return the correct value for the get endpoint')
  const setUrl =
  jwtClientWithSecret.createEndpointUrl('/submission/:submissionId', {submissionId})
  t.equal(setUrl, routeWithSubsitutionUrl, 'it should return the correct value for the set endpoint')

  t.end()
})

// JWT
test('When generating json web token', async t => {
  const clock = useFakeTimers({
    now: 1483228800000
  })
  const accessToken = jwtClientWithSecret.generateAccessToken({data: 'testData'})
  const decodedAccessToken = jwt.verify(accessToken, serviceToken)
  t.equal(decodedAccessToken.data, 'testData', 'it should output a token containing the data')
  t.equal(decodedAccessToken.iat, 1483228800, 'it should output a token containing the iat property')

  clock.restore()
  t.end()
})

// Decrypting user ID and token
test('When decrypting the user’s ID and token', async t => {
  const decryptedData = jwtClientWithSecret.decryptUserIdAndToken(encryptedUserIdTokenData)
  t.deepEqual(userIdTokenData, decryptedData, 'it should return the correct data from valid encrypted input')

  t.end()
})

test('When decrypting invalid user ID and token', async t => {
  t.plan(4)
  let invalidData
  try {
    invalidData = jwtClientWithSecret.decryptUserIdAndToken(userToken, 'invalid')
  } catch (e) {
    t.equal(e.name, 'FBJWTClientWithSecretError', 'it should return an error object of the correct type')
    t.equal(e.code, 500, 'it should return correct error code')
    t.equal(e.message, 'EINVALIDPAYLOAD', 'it should return the correct error message')
  }
  t.equal(invalidData, undefined, 'it should not return anything if data is invalid')

  t.end()
})

// Encrypting user ID and token
test('When encrypting the user ID and token', async t => {
  const encryptedData = jwtClientWithSecret.encryptUserIdAndToken(userId, userToken)
  t.deepEqual(encryptedData, expectedEncryptedData, 'it should encrypt the data correctly')

  const encryptedDataAgain = jwtClientWithSecret.encryptUserIdAndToken(userId, userToken)
  t.equal(encryptedDataAgain, encryptedData, 'it should return the same value for the same input')

  t.end()
})

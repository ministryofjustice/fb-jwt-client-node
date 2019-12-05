require('@ministryofjustice/module-alias/register')

const proxyquire = require('proxyquire')

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const {
  expect
} = chai

const jwt = require('jsonwebtoken')
const got = require('got')

const nock = require('nock')

chai.use(sinonChai)

const encryptStub = sinon.stub()
const decryptStub = sinon.stub()

const FBJWTClient = proxyquire('~/fb-jwt-client-node/fb-jwt-client', {
  './fb-jwt-aes256': {
    encrypt: encryptStub,
    decrypt: decryptStub
  }
})

const userId = 'testUserId'
const serviceSlug = 'testServiceSlug'
const serviceSecret = 'testServiceSecret'
const serviceToken = 'testServiceToken'

const microserviceUrl = 'https://microservice'

describe('~/fb-jwt-client-node/fb-jwt-client', () => {
  describe('Always', () => {
    it('exports the class', () => expect(FBJWTClient).to.be.a('function'))

    describe('Instantiating a client', () => {
      describe('With required parameters', () => {
        class MockCustomError {}

        let client

        beforeEach(() => {
          client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl, MockCustomError)
        })

        it('assigns the service secret to a field of the instance', () => expect(client.serviceSecret).to.equal(serviceSecret))

        it('assigns the service token to a field of the instance', () => expect(client.serviceToken).to.equal(serviceToken))

        it('assigns the service slug to a field of the instance', () => expect(client.serviceSlug).to.equal(serviceSlug))

        it('assigns the custom error class to a field of the instance', () => expect(client.ErrorClass).to.equal(MockCustomError))

        it('assigns a default metrics object to the field `apiMetrics`', () => {
          expect(client.apiMetrics).to.be.an('object')

          const {
            startTimer
          } = client.apiMetrics

          expect(startTimer).to.be.a('function')
        })

        it('assigns a default metrics object to the field `requestMetrics`', () => {
          expect(client.requestMetrics).to.be.an('object')

          const {
            startTimer
          } = client.requestMetrics

          expect(startTimer).to.be.a('function')
        })
      })

      describe('Without a service secret parameter', () => {
        it('throws an error', () => expect(() => new FBJWTClient()).to.throw(Error, 'No service secret passed to client'))

        describe('The error', () => {
          it('has the expected name', () => {
            try {
              new FBJWTClient()
            } catch ({name}) {
              expect(name).to.equal('FBJWTClientError')
            }
          })

          it('has the expected code', () => {
            try {
              new FBJWTClient()
            } catch ({code}) {
              expect(code).to.equal('ENOSERVICESECRET')
            }
          })
        })
      })

      describe('Without a service token parameter', () => {
        it('throws an error', () => expect(() => new FBJWTClient(serviceSecret)).to.throw(Error, 'No service token passed to client'))

        describe('The error', () => {
          it('has the expected name', () => {
            try {
              new FBJWTClient(serviceSecret)
            } catch ({name}) {
              expect(name).to.equal('FBJWTClientError')
            }
          })

          it('has the expected code', () => {
            try {
              new FBJWTClient(serviceSecret)
            } catch ({code}) {
              expect(code).to.equal('ENOSERVICETOKEN')
            }
          })
        })
      })

      describe('Without a service slug parameter', () => {
        it('throws an error', () => expect(() => new FBJWTClient(serviceSecret, serviceToken)).to.throw(Error, 'No service slug passed to client'))

        describe('The error', () => {
          it('has the expected name', () => {
            try {
              new FBJWTClient(serviceSecret, serviceToken)
            } catch ({name}) {
              expect(name).to.equal('FBJWTClientError')
            }
          })

          it('has the expected code', () => {
            try {
              new FBJWTClient(serviceSecret, serviceToken)
            } catch ({code}) {
              expect(code).to.equal('ENOSERVICESLUG')
            }
          })
        })
      })

      describe('Without a service url parameter', () => {
        it('throws an error', () => expect(() => new FBJWTClient(serviceSecret, serviceToken, serviceSlug)).to.throw(Error, 'No microservice url passed to client'))

        describe('The error', () => {
          it('has the expected name', () => {
            try {
              new FBJWTClient(serviceSecret, serviceToken, serviceSlug)
            } catch ({name}) {
              expect(name).to.equal('FBJWTClientError')
            }
          })

          it('has the expected code', () => {
            try {
              new FBJWTClient(serviceSecret, serviceToken, serviceSlug)
            } catch ({code}) {
              expect(code).to.equal('ENOMICROSERVICEURL')
            }
          })
        })
      })

      describe('With a custom error parameter', () => {
        class CustomError extends Error {}

        it('throws an error', () => expect(() => new FBJWTClient(null, null, null, null, CustomError)).to.throw(CustomError))
      })
    })
  })

  describe('Injecting metrics instrumentation (setMetricsInstrumentation)', () => {
    let mockApiMetrics
    let mockRequestMetrics
    let client

    beforeEach(() => {
      mockApiMetrics = {}
      mockRequestMetrics = {}

      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)

      client.setMetricsInstrumentation(mockApiMetrics, mockRequestMetrics)
    })

    it('assigns the first argument to the field `apiMetrics`', () => expect(client.apiMetrics).to.equal(mockApiMetrics))

    it('assigns the second argument to the field `requestMetrics`', () => expect(client.requestMetrics).to.equal(mockRequestMetrics))
  })

  // Endpoint URLs
  describe('Creating the endpoint URLs', () => {
    it('creates the URLs', () => {
      const client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)

      expect(client.createEndpointUrl('/service/:serviceSlug/user/:userId', {serviceSlug, userId})).to.equal('https://microservice/service/testServiceSlug/user/testUserId')
    })
  })

  // JWT
  describe('Generating a JSON web token', () => {
    let client
    let clock
    let accessToken

    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      clock = sinon.useFakeTimers({now: 1483228800000})
      accessToken = client.generateAccessToken({data: 'testData'})
    })

    afterEach(() => {
      clock.restore()
    })

    it('generates a JSON web token containing a checksum', () => {
      const {
        checksum
      } = jwt.verify(accessToken, serviceToken)

      expect(checksum).to.equal('b5118e71a8ed3abbc8c40d4058b0dd54b9410ffd56ef888f602ed10026c46a3a')
    })

    it('generates a JSON web token containing an iat', () => {
      const {
        iat
      } = jwt.verify(accessToken, serviceToken)

      expect(iat).to.equal(1483228800)
    })
  })

  describe('Creating the request options', () => {
    describe('POST requests', () => {
      describe('With data', () => {
        it('returns an object with a JSON object assigned to the field `body`', () => {
          const client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
          sinon.stub(client, 'generateAccessToken').returns('testAccessToken')

          expect(client.createRequestOptions('/foo', {}, {foo: 'bar'}))
            .to.eql({
              url: 'https://microservice/foo',
              headers: {'x-access-token': 'testAccessToken'},
              json: true,
              body: {foo: 'bar'}
            })
        })
      })

      describe('Without data', () => {
        it('returns an object without a JSON object assigned to the field `body`', () => {
          const client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
          sinon.stub(client, 'generateAccessToken').returns('testAccessToken')

          expect(client.createRequestOptions('/foo', {}, {}))
            .to.eql({
              url: 'https://microservice/foo',
              headers: {'x-access-token': 'testAccessToken'},
              json: true
            })
        })
      })
    })

    describe('GET requests', () => {
      describe('With data', () => {
        it('returns an object with a `searchParams` field', () => {
          const client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
          sinon.stub(client, 'generateAccessToken').returns('testAccessToken')

          expect(client.createRequestOptions('/foo', {}, {foo: 'bar'}, true))
            .to.eql({
              url: 'https://microservice/foo',
              headers: {'x-access-token': 'testAccessToken'},
              json: true,
              searchParams: {payload: 'eyJmb28iOiJiYXIifQ=='}
            })
        })
      })

      describe('Without data', () => {
        it('returns an object without a `searchParams` field', () => {
          const client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
          sinon.stub(client, 'generateAccessToken').returns('testAccessToken')

          expect(client.createRequestOptions('/foo', {}, {}, true))
            .to.eql({
              url: 'https://microservice/foo',
              headers: {'x-access-token': 'testAccessToken'},
              json: true
            })
        })
      })
    })
  })

  // Sending gets
  describe('Getting', () => {
    let client

    let generateAccessTokenStub
    let getGetStub

    let returnValue

    describe('With a payload', () => {
      beforeEach(async () => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
        generateAccessTokenStub = sinon.stub(client, 'generateAccessToken').returns('testAccessToken')
        getGetStub = sinon.stub(got, 'get').callsFake((options) => Promise.resolve({body: {foo: 'bar'}}))

        returnValue = await client.sendGet({
          url: '/user/:userId',
          context: {userId},
          payload: {foo: 'bar'}
        })
      })

      afterEach(() => {
        generateAccessTokenStub.restore()
        getGetStub.restore()
      })

      it('it should call the correct url', () => expect(getGetStub.getCall(0).args[0].url).to.equal(`${microserviceUrl}/user/testUserId`))
      it('it should add the correct x-access-token header', () => expect(getGetStub.getCall(0).args[0].headers['x-access-token']).to.equal('testAccessToken'))
      it('it should return the unencrypted data', () => expect(returnValue).to.eql({foo: 'bar'}))
    })

    describe('Without a payload', () => {
      beforeEach(async () => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
        generateAccessTokenStub = sinon.stub(client, 'generateAccessToken').returns('testAccessToken')
        getGetStub = sinon.stub(got, 'get').returns(Promise.resolve({}))

        returnValue = await client.sendGet({
          url: '/user/:userId',
          context: {userId}
        })
      })

      afterEach(() => {
        generateAccessTokenStub.restore()
        getGetStub.restore()
      })

      it('it should call the correct url', () => expect(getGetStub.getCall(0).args[0].url).to.equal(`${microserviceUrl}/user/testUserId`))
      it('it should add the correct x-access-token header', () => expect(getGetStub.getCall(0).args[0].headers['x-access-token']).to.equal('testAccessToken'))
      it('it should return undefined', () => expect(returnValue).to.be.undefined)
    })
  })

  // Sending posts
  describe('Posting', () => {
    describe('With a payload', () => {
      let client

      let generateAccessTokenStub
      let getPostStub

      let returnValue

      beforeEach(async () => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
        generateAccessTokenStub = sinon.stub(client, 'generateAccessToken').returns('accessToken')
        getPostStub = sinon.stub(got, 'post').returns(Promise.resolve({body: {foo: 'bar'}}))

        returnValue = await client.sendPost({
          url: '/user/:userId',
          context: {userId},
          payload: {foo: 'bar'}
        })
      })

      afterEach(() => {
        getPostStub.restore()
        generateAccessTokenStub.restore()
      })

      it('it should call the correct url', () => expect(getPostStub.getCall(0).args[0].url).to.equal(`${microserviceUrl}/user/testUserId`))
      it('it should add the x-access-token header', () => expect(getPostStub.getCall(0).args[0].headers['x-access-token']).to.equal('accessToken'))
      it('it should return the response’s body parsed as JSON', () => expect(returnValue).to.eql({foo: 'bar'}))
    })

    describe('Without a payload', () => {
      let client

      let generateAccessTokenStub
      let getPostStub

      let returnValue

      beforeEach(async () => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
        generateAccessTokenStub = sinon.stub(client, 'generateAccessToken').returns('accessToken')
        getPostStub = sinon.stub(got, 'post').returns(Promise.resolve({}))

        returnValue = await client.sendPost({
          url: '/user/:userId',
          context: {userId}
        })
      })

      afterEach(() => {
        getPostStub.restore()
        generateAccessTokenStub.restore()
      })

      it('it should call the correct url', () => expect(getPostStub.getCall(0).args[0].url).to.equal(`${microserviceUrl}/user/testUserId`))
      it('it should add the x-access-token header', () => expect(getPostStub.getCall(0).args[0].headers['x-access-token']).to.equal('accessToken'))
      it('it should return undefined', () => expect(returnValue).to.be.undefined)
    })
  })

  describe('Posting to an endpoint successfully', () => {
    let client

    let apiMetricsEndStub
    let apiMetricsStartTimerStub

    let requestMetricsEndStub
    let requestMetricsStartTimerStub

    beforeEach(async () => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)

      apiMetricsEndStub = sinon.stub()
      apiMetricsStartTimerStub = sinon.stub(client.apiMetrics, 'startTimer').returns(apiMetricsEndStub)

      requestMetricsEndStub = sinon.stub()
      requestMetricsStartTimerStub = sinon.stub(client.requestMetrics, 'startTimer').returns(requestMetricsEndStub)

      nock(microserviceUrl)
        .post('/route')
        .reply(200, {success: true})

      await client.send('post', {
        url: '/route'
      })
    })

    afterEach(() => {
      apiMetricsStartTimerStub.restore()
      requestMetricsStartTimerStub.restore()
    })

    it('starts the instrumentation timer with the correct args', () => expect(apiMetricsStartTimerStub.getCall(0).args[0]).to.eql({
      client_name: 'FBJWTClient',
      base_url: microserviceUrl,
      url: '/route',
      method: 'post'
    }))

    it('stops the instrumentation timer with the correct args', () => expect(apiMetricsEndStub.getCall(0).args[0]).to.eql({status_code: 200})) // , status_message: 'OK'}))

    it('starts the instrumentation timer with the correct args', () => expect(requestMetricsStartTimerStub.getCall(0).args[0]).to.eql({
      client_name: 'FBJWTClient',
      base_url: microserviceUrl,
      url: '/route',
      method: 'post'
    }))

    it('stops the instrumentation timer with the correct args', () => expect(requestMetricsEndStub.getCall(0).args[0]).to.eql({status_code: 200})) //, status_message: 'OK'}))
  })

  describe('Posting to an endpoint unsuccessfully', () => {
    let client

    let apiMetricsEndStub
    let apiMetricsStartTimerStub

    let requestMetricsEndStub
    let requestMetricsStartTimerStub

    beforeEach(async () => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)

      apiMetricsEndStub = sinon.stub()
      apiMetricsStartTimerStub = sinon.stub(client.apiMetrics, 'startTimer').returns(apiMetricsEndStub)

      requestMetricsEndStub = sinon.stub()
      requestMetricsStartTimerStub = sinon.stub(client.requestMetrics, 'startTimer').returns(requestMetricsEndStub)

      nock(microserviceUrl)
        .post('/not-found')
        .reply(404, {code: 404, name: 'ENOTFOUND'})
    })

    afterEach(() => {
      apiMetricsStartTimerStub.restore()
      requestMetricsStartTimerStub.restore()
    })

    it('throws an ‘ENOERROR’', async () => {
      try {
        await client.send('post', {
          url: '/not-found'
        }, {error: () => {}})
      } catch (e) {
        expect(e.name).to.equal('FBJWTClientError')
      }
    })

    it('starts the instrumentation timer with the correct args', async () => {
      try {
        await client.send('post', {
          url: '/not-found'
        }, {error: () => {}})
      } catch (e) {
        expect(apiMetricsStartTimerStub.getCall(0).args[0]).to.eql({
          client_name: 'FBJWTClient',
          base_url: microserviceUrl,
          url: '/not-found',
          method: 'post'
        })
      }
    })

    it('stops the instrumentation timer with the correct args', async () => {
      try {
        await client.send('post', {
          url: '/not-found'
        }, {error: () => {}})
      } catch (e) {
        expect(apiMetricsEndStub.getCall(0).args[0]).to.eql({status_code: 404, status_message: 'Not Found'})
      }
    })

    it('starts the instrumentation timer with the correct args', async () => {
      try {
        await client.send('post', {
          url: '/not-found'
        }, {error: () => {}})
      } catch (e) {
        expect(requestMetricsStartTimerStub.getCall(0).args[0]).to.eql({
          client_name: 'FBJWTClient',
          base_url: microserviceUrl,
          url: '/not-found',
          method: 'post'
        })
      }
    })

    it('stops the instrumentation timer with the correct args', async () => {
      try {
        await client.send('post', {
          url: '/not-found'
        }, {error: () => {}})
      } catch (e) {
        expect(requestMetricsEndStub.getCall(0).args[0]).to.eql({status_code: 404})
      }
    })
  })

  xdescribe('Retrying', () => {
    let client

    let apiMetricsEndStub
    let apiMetricsStartTimerStub

    let requestMetricsEndStub
    let requestMetricsStartTimerStub

    beforeEach(async () => {
      /*
       *  Don't use Nock or the nocked microservice URL
       */
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, 'https://retry-microservice')

      apiMetricsEndStub = sinon.stub()
      apiMetricsStartTimerStub = sinon.stub(client.apiMetrics, 'startTimer').returns(apiMetricsEndStub)

      requestMetricsEndStub = sinon.stub()
      requestMetricsStartTimerStub = sinon.stub(client.requestMetrics, 'startTimer').returns(requestMetricsEndStub)
    })

    afterEach(() => {
      apiMetricsStartTimerStub.restore()
      requestMetricsStartTimerStub.restore()
    })

    it('throws an ‘ENOTFOUND’', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(e.name).to.equal('FBJWTClientError')
      }
    }).timeout(30000)

    it('starts the instrumentation timer with the correct args', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(apiMetricsStartTimerStub.getCall(0).args[0]).to.eql({
          client_name: 'FBJWTClient',
          base_url: 'https://retry-microservice',
          url: '/server-error',
          method: 'get'
        })
      }
    }).timeout(30000)

    it('stops the api metrics instrumentation timer with the correct args', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(apiMetricsEndStub.getCall(0).args[0]).to.eql({
          error_name: 'RequestError',
          error_message: 'getaddrinfo ENOTFOUND retry-microservice'
        })
      }
    }).timeout(30000)

    it('starts the request instrumentation timer with the correct args', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(requestMetricsStartTimerStub.getCall(0).args[0]).to.eql({
          client_name: 'FBJWTClient',
          base_url: 'https://retry-microservice',
          url: '/server-error',
          method: 'get'
        })
      }
    }).timeout(30000)

    it('stops the instrumentation timer with the correct args', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(requestMetricsEndStub.getCall(0).args[0]).to.eql({
          error_name: 'RequestError',
          error_message: 'getaddrinfo ENOTFOUND retry-microservice'
        })
      }
    }).timeout(30000)

    it('calls the api metrics start timer the expected number of times', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(apiMetricsStartTimerStub.callCount).to.equal(1)
      }
    }).timeout(30000)

    it('calls api metrics end the expected number of times', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(apiMetricsEndStub.callCount).to.equal(1)
      }
    }).timeout(30000)

    it('calls request metrics end the expected number of times', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(requestMetricsEndStub.callCount).to.equal(4)
      }
    }).timeout(30000)

    it('calls the request metrics start timer the expected number of times', async () => {
      try {
        await client.send('get', {url: '/server-error', sendOptions: {retry: 3}}, {error (e) { return e }})
      } catch (e) {
        expect(requestMetricsStartTimerStub.callCount).to.equal(4)
      }
    }).timeout(30000)
  })

  describe('An endpoint returns JSON', () => {
    describe('The JSON is populated', () => {
      let client
      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      })

      describe('Getting', async () => {
        it('throws an ‘ENOERROR’', async () => {
          try {
            nock(microserviceUrl)
              .get('/json-body')
              .reply(201, {success: true})

            await client.send('get', {url: '/json-body'})
          } catch (e) {
            expect(e.name).to.equal('FBJWTClientError')
          }
        })
      })

      describe('Posting', () => {
        it('returns the JSON', async () => {
          nock(microserviceUrl)
            .post('/json-body')
            .reply(201, {success: true})

          const response = await client.send('post', {url: '/json-body'})

          expect(response).to.eql({success: true})
        })
      })
    })

    describe('The JSON is not populated', () => {
      let client
      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      })

      describe('Getting', () => {
        it('throws an ‘ENOERROR’', async () => {
          try {
            nock(microserviceUrl)
              .get('/empty-json-body')
              .reply(201, {})

            await client.send('get', {url: '/empty-json-body'})
          } catch (e) {
            expect(e.name).to.equal('FBJWTClientError')
          }
        })
      })

      describe('Posting', () => {
        it('returns the JSON', async () => {
          nock(microserviceUrl)
            .post('/empty-json-body')
            .reply(201, {})

          const response = await client.send('post', {url: '/empty-json-body'})

          expect(response).to.eql({})
        })
      })
    })
  })

  describe('An endpoint returns a string', () => {
    describe('The string is populated', () => {
      let client
      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      })

      xdescribe('With mixed characters', () => {
        describe('Getting', () => {
          it('throws an ‘ENOERROR’', async () => {
            try {
              nock(microserviceUrl)
                .get('/non-empty-body')
                .reply(201, ' lorem ipsum ')

              await client.send('get', {url: '/non-empty-body'})
            } catch (e) {
              expect(e.name).to.equal('FBJWTClientError')
            }
          })
        })

        describe('Posting', () => {
          it('returns the response', async () => {
            nock(microserviceUrl)
              .post('/non-empty-body')
              .reply(201, ' lorem ipsum ')

            const response = await client.send('post', {url: '/non-empty-body'})

            expect(response).to.equal(' lorem ipsum ')
          })
        })
      })

      describe('With whitespace', () => {
        describe('Getting', () => {
          it('throws an ‘ENOERROR’', async () => {
            try {
              nock(microserviceUrl)
                .get('/spaces-body')
                .reply(201, '    ')

              await client.send('get', {url: '/spaces-body'})
            } catch (e) {
              expect(e.name).to.equal('FBJWTClientError')
            }
          })
        })

        describe('Posting', () => {
          it('returns an empty JSON object', async () => {
            nock(microserviceUrl)
              .post('/spaces-body')
              .reply(201, '    ')

            const response = await client.send('post', {url: '/spaces-body'})

            expect(response).to.eql({})
          })
        })
      })
    })

    describe('The string is not populated', () => {
      let client
      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      })

      describe('Getting', async () => {
        it('throws an ‘ENOERROR’', async () => {
          try {
            nock(microserviceUrl)
              .get('/empty-string-body')
              .reply(201, '')

            await client.send('get', {url: '/empty-string-body'})
          } catch (e) {
            expect(e.name).to.equal('FBJWTClientError')
          }
        })
      })

      describe('Posting', () => {
        it('returns an empty JSON object', async () => {
          nock(microserviceUrl)
            .post('/empty-string-body')
            .reply(201, '')

          const response = await client.send('post', {url: '/empty-string-body'})

          expect(response).to.eql({})
        })
      })
    })
  })

  describe('An endpoint returns undefined', () => {
    let client
    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
    })

    describe('Getting', () => {
      it('throws an ‘ENOERROR’', async () => {
        try {
          nock(microserviceUrl)
            .get('/undefined-body')
            .reply(201)

          await client.send('get', {url: '/undefined-body'})
        } catch (e) {
          expect(e.name).to.equal('FBJWTClientError')
        }
      })
    })

    describe('Posting', () => {
      it('returns an empty JSON object', async () => {
        nock(microserviceUrl)
          .post('/undefined-body')
          .reply(201)

        const response = await client.send('post', {url: '/undefined-body'})

        expect(response).to.eql({})
      })
    })
  })

  describe('`encrypt`', () => {
    let client
    let mockData
    let JSONStub
    let returnValue

    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      mockData = {}
      encryptStub.returns('mock encrypted data')
      JSONStub = sinon.stub(JSON, 'stringify').returns('mock serialised data')

      returnValue = client.encrypt('mock service secret', mockData, 'mock initialization vector')
    })

    afterEach(() => {
      JSONStub.restore()
    })

    it('calls `encrypt()`', () => {
      expect(encryptStub)
        .to.be.calledWith('mock service secret', 'mock serialised data', 'mock initialization vector')
    })

    it('calls `JSON.stringify()`', () => {
      expect(JSONStub)
        .to.be.calledWith(mockData)
    })

    it('returns a string', () => {
      expect(returnValue)
        .to.equal('mock encrypted data')
    })
  })

  describe('`decrypt`', () => {
    describe('`JSON.parse()` throws an error', () => {
      let client
      let JSONStub
      let throwRequestErrorStub
      let returnValue

      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
        decryptStub.returns('mock decrypted data')
        JSONStub = sinon.stub(JSON, 'parse').throws()
        throwRequestErrorStub = sinon.stub(client, 'throwRequestError')

        returnValue = client.decrypt('mock service secret', 'mock encrypted data')
      })

      afterEach(() => {
        JSONStub.restore()
      })

      it('calls `decrypt()`', () => {
        expect(decryptStub)
          .to.be.calledWith('mock service secret', 'mock encrypted data')
      })

      it('calls `JSON.parse()`', () => {
        expect(JSONStub)
          .to.be.calledWith('mock decrypted data')
      })

      it('calls `throwRequestError()`', () => {
        expect(throwRequestErrorStub)
          .to.be.calledWith(500, 'EINVALIDPAYLOAD')
      })

      it('returns a string', () => {
        expect(returnValue)
          .not.to.equal('mock parsed data')
      })
    })

    describe('`JSON.parse()` does not throw an error', () => {
      let client
      let JSONStub
      let throwRequestErrorStub
      let returnValue

      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
        decryptStub.returns('mock decrypted data')
        JSONStub = sinon.stub(JSON, 'parse').returns('mock parsed data')
        throwRequestErrorStub = sinon.stub(client, 'throwRequestError')

        returnValue = client.decrypt('mock service secret', 'mock encrypted data')
      })

      afterEach(() => {
        JSONStub.restore()
      })

      it('calls `decrypt()`', () => {
        expect(decryptStub)
          .to.be.calledWith('mock service secret', 'mock encrypted data')
      })

      it('calls `JSON.parse()`', () => {
        expect(JSONStub)
          .to.be.calledWith('mock decrypted data')
      })

      it('does not call `throwRequestError()`', () => {
        return expect(throwRequestErrorStub)
          .not.to.be.called
      })

      it('returns a string', () => {
        expect(returnValue)
          .to.equal('mock parsed data')
      })
    })
  })

  describe('`encryptUserIdAndToken`', () => {
    let client
    let encryptStub

    let returnValue

    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      encryptStub = sinon.stub(client, 'encrypt').returns('mock encrypted data')
      client.serviceSecret = 'mock service secret'

      returnValue = client.encryptUserIdAndToken('mock user id', 'mock user token')
    })

    it('calls `encrypt()`', () => {
      expect(encryptStub)
        .to.be.calledWith('mock service secret', {userId: 'mock user id', userToken: 'mock user token'}, 'mock user idmock user token')
    })

    it('returns a string', () => {
      expect(returnValue)
        .to.equal('mock encrypted data')
    })
  })

  describe('`decryptUserIdAndToken`', () => {
    let client
    let decryptStub

    let returnValue

    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      decryptStub = sinon.stub(client, 'decrypt').returns('mock decrypted data')
      client.serviceSecret = 'mock service secret'

      returnValue = client.decryptUserIdAndToken('mock encrypted data')
    })

    it('calls `decrypt()`', () => {
      expect(decryptStub)
        .to.be.calledWith('mock service secret', 'mock encrypted data')
    })

    it('returns a string', () => {
      expect(returnValue)
        .to.equal('mock decrypted data')
    })
  })

  describe('`logError()`', () => {
    let error

    let errorStub

    let client

    describe('GET', () => {
      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      })

      describe('With fields on the error instance', () => {
        beforeEach(() => {
          errorStub = sinon.stub()

          const type = 'API'
          error = new Error()
          error.code = 'mock error code'
          error.statusCode = 400
          error.statusMessage = 'mock status message'
          error.body = {
            name: 'mock error name',
            message: 'mock error message',
            code: 400
          }

          const labels = {client_name: 'FBJWTClient', method: 'get', base_url: 'https://microservice', url: '/url'}
          const logger = {error: errorStub}

          client.logError(type, error, labels, logger)
        })

        it('assigns the value of `error.body` to the field `error.error`', () => {
          expect(error.error).to.equal(error.body)
        })

        it('calls `logger.error()', () => {
          expect(errorStub)
            .to.be.calledWith({
              client_name: 'FBJWTClient',
              url: '/url',
              base_url: 'https://microservice',
              method: 'get',
              error
            }, 'JWT API request error: FBJWTClient: GET https://microservice/url - Error - mock error code - 400 - mock status message - {"name":"mock error name","message":"mock error message","code":400}')
        })
      })

      describe('Without fields on the error instance', () => {
        beforeEach(() => {
          errorStub = sinon.stub()

          const type = 'API'
          error = new Error()

          const labels = {client_name: 'FBJWTClient', method: 'get', base_url: 'https://microservice', url: '/url'}
          const logger = {error: errorStub}

          client.logError(type, error, labels, logger)
        })

        it('assigns the value of `error.body` to the field `error.error`', () => {
          expect(error.error).to.equal(error.body)
        })

        it('calls `logger.error()', () => {
          expect(errorStub)
            .to.be.calledWith({
              client_name: 'FBJWTClient',
              url: '/url',
              base_url: 'https://microservice',
              method: 'get',
              error
            }, 'JWT API request error: FBJWTClient: GET https://microservice/url - Error -  -  -  - ')
        })
      })
    })

    describe('POST', () => {
      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      })

      describe('With fields on the error instance', () => {
        beforeEach(() => {
          errorStub = sinon.stub()

          const type = 'API'
          error = new Error()
          error.code = 'mock error code'
          error.statusCode = 400
          error.statusMessage = 'mock status message'
          error.body = {
            name: 'mock error name',
            message: 'mock error message',
            code: 400
          }

          const labels = {client_name: 'FBJWTClient', method: 'post', base_url: 'https://microservice', url: '/url'}
          const logger = {error: errorStub}

          client.logError(type, error, labels, logger)
        })

        it('assigns the value of `error.body` to the field `error.error`', () => {
          expect(error.error).to.equal(error.body)
        })

        it('calls `logger.error()', () => {
          expect(errorStub)
            .to.be.calledWith({
              client_name: 'FBJWTClient',
              url: '/url',
              base_url: 'https://microservice',
              method: 'post',
              error
            }, 'JWT API request error: FBJWTClient: POST https://microservice/url - Error - mock error code - 400 - mock status message - {"name":"mock error name","message":"mock error message","code":400}')
        })
      })

      describe('Without fields on the error instance', () => {
        beforeEach(() => {
          errorStub = sinon.stub()

          const type = 'API'
          error = new Error()

          const labels = {client_name: 'FBJWTClient', method: 'post', base_url: 'https://microservice', url: '/url'}
          const logger = {error: errorStub}

          client.logError(type, error, labels, logger)
        })

        it('assigns the value of `error.body` to the field `error.error`', () => {
          expect(error.error).to.equal(error.body)
        })

        it('calls `logger.error()', () => {
          expect(errorStub)
            .to.be.calledWith({
              client_name: 'FBJWTClient',
              url: '/url',
              base_url: 'https://microservice',
              method: 'post',
              error
            }, 'JWT API request error: FBJWTClient: POST https://microservice/url - Error -  -  -  - ')
        })
      })
    })
  })

  describe('`sendGet()`', () => {
    let client
    let sendStub

    let mockArgs
    let mockLogger

    let returnValue

    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      sendStub = sinon.stub(client, 'send').returns('mock return value')

      mockArgs = {}
      mockLogger = {}

      /*
       *  Don't await -- test that the return is a promise
       */
      returnValue = client.sendGet(mockArgs, mockLogger)
    })

    it('calls `send`', () => {
      expect(sendStub).to.be.calledWith('get', mockArgs, mockLogger)
    })

    it('returns a `Promise`', () => {
      expect(returnValue).to.be.a('promise')
    })
  })

  describe('`sendPost()`', () => {
    let client
    let sendStub

    let mockArgs
    let mockLogger

    let returnValue

    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
      sendStub = sinon.stub(client, 'send').returns('mock return value')

      mockArgs = {}
      mockLogger = {}

      /*
       *  Don't await -- test that the return is a promise
       */
      returnValue = client.sendPost(mockArgs, mockLogger)
    })

    it('calls `send`', () => {
      expect(sendStub).to.be.calledWith('post', mockArgs, mockLogger)
    })

    it('returns a `Promise`', () => {
      expect(returnValue).to.be.a('promise')
    })
  })

  describe('`handleRequestError()`', () => {
    let client
    let throwRequestErrorStub

    describe('The client has a custom error', () => {
      describe('The error is an instance of the custom error', () => {
        it('throws the custom error', () => {
          class CustomError extends Error {}

          const client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl, CustomError)

          throwRequestErrorStub = sinon.stub(client, 'throwRequestError')

          expect(() => client.handleRequestError(new CustomError())).to.throw(CustomError)
        })
      })
    })

    describe('The client does not have a custom error', () => {
      beforeEach(() => {
        client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)

        throwRequestErrorStub = sinon.stub(client, 'throwRequestError')
      })

      describe('The error is an instance of the custom error', () => {
        it('does not throw the custom error', () => {
          class CustomError extends Error {}

          expect(() => client.handleRequestError(new CustomError())).not.to.throw(CustomError)
        })
      })

      describe('The error has a `body` field', () => {
        it('Assigns the value to an `error` field', () => {
          const mockBody = {}
          const mockError = {body: mockBody}

          client.handleRequestError(mockError)

          expect(mockError.error).to.equal(mockBody)
        })
      })

      describe('The error has a `statusCode`', () => {
        describe('400s', () => {
          describe('401', () => {
            it('throws a 401 request error', () => {
              client.handleRequestError({statusCode: 401})

              expect(throwRequestErrorStub).to.be.calledWith(401)
            })
          })

          describe('403', () => {
            it('throws a 403 request error', () => {
              client.handleRequestError({statusCode: 403})

              expect(throwRequestErrorStub).to.be.calledWith(403)
            })
          })

          describe('404', () => {
            it('throws a 404 request error', () => {
              client.handleRequestError({statusCode: 404})

              expect(throwRequestErrorStub).to.be.calledWith(404)
            })
          })
        })

        describe('500s', () => {
          describe('The error has an `error` field', () => {
            describe('The object on the error field has a `name` field', () => {
              it('throws a request error with the name', () => {
                client.handleRequestError({statusCode: 500, error: {name: 'mock name'}})

                expect(throwRequestErrorStub).to.be.calledWith(500, 'mock name')
              })
            })

            describe('The object on the error field does not have a `name` field but has a `code` field', () => {
              it('throws a request error with the code', () => {
                client.handleRequestError({statusCode: 500, error: {code: 'mock code'}})

                expect(throwRequestErrorStub).to.be.calledWith(500, 'mock code')
              })
            })

            describe('The object on the error field has neither a `name` field nor a `code` field', () => {
              it('throws a request error with the default code and the default type', () => {
                client.handleRequestError({statusCode: 500, error: { }})

                expect(throwRequestErrorStub).to.be.calledWith(500, 'EUNSPECIFIED')
              })
            })
          })

          describe('The error does not have an `error` field', () => {
            describe('The error has a `code` field', () => {
              it('throws a request error with the code', () => {
                client.handleRequestError({statusCode: 500, code: 'mock code'})

                expect(throwRequestErrorStub).to.be.calledWith(500, 'mock code')
              })
            })

            describe('The error does not have a `code` field', () => {
              it('throws a request error with the default code and the default type', () => {
                client.handleRequestError({statusCode: 500, error: { }})

                expect(throwRequestErrorStub).to.be.calledWith(500, 'EUNSPECIFIED')
              })
            })
          })
        })
      })

      describe('The error does not have a `statusCode`', () => {
        describe('The error has an `error` field', () => {
          describe('The object on the error field has a `name` field', () => {
            describe('Mapping the name to a status code', () => {
              describe('The name is `ENOERROR`', () => {
                it('throws a request error with the name', () => {
                  client.handleRequestError({error: {name: 'ENOERROR'}})

                  expect(throwRequestErrorStub).to.be.calledWith(500, 'ENOERROR')
                })
              })

              describe('The name is `ENOTFOUND`', () => {
                it('throws a request error with the name', () => {
                  client.handleRequestError({error: {name: 'ENOTFOUND'}})

                  expect(throwRequestErrorStub).to.be.calledWith(502, 'ENOTFOUND')
                })
              })

              describe('The name is `ECONNREFUSED`', () => {
                it('throws a request error with the name', () => {
                  client.handleRequestError({error: {name: 'ECONNREFUSED'}})

                  expect(throwRequestErrorStub).to.be.calledWith(503, 'ECONNREFUSED')
                })
              })
            })
          })

          describe('The object on the error field does not have a `name` field but has a `code` field', () => {
            describe('Mapping the code to a status code', () => {
              describe('The code is `ENOERROR`', () => {
                it('throws a request error with the name', () => {
                  client.handleRequestError({error: {code: 'ENOERROR'}})

                  expect(throwRequestErrorStub).to.be.calledWith(500, 'ENOERROR')
                })
              })

              describe('The code is `ENOTFOUND`', () => {
                it('throws a request error with the name', () => {
                  client.handleRequestError({error: {code: 'ENOTFOUND'}})

                  expect(throwRequestErrorStub).to.be.calledWith(502, 'ENOTFOUND')
                })
              })

              describe('The code is `ECONNREFUSED`', () => {
                it('throws a request error with the name', () => {
                  client.handleRequestError({error: {code: 'ECONNREFUSED'}})

                  expect(throwRequestErrorStub).to.be.calledWith(503, 'ECONNREFUSED')
                })
              })
            })
          })

          describe('The object on the error field has neither a `name` field nor a `code` field', () => {
            it('throws a request error with the default code and the default type', () => {
              client.handleRequestError({error: { }})

              expect(throwRequestErrorStub).to.be.calledWith(500, 'EUNSPECIFIED')
            })
          })
        })

        describe('The error does not have an `error` field', () => {
          describe('The error has a `code` field', () => {
            describe('Mapping the code to a status code', () => {
              describe('The code is `ENOERROR`', () => {
                it('throws a request error with the status code', () => {
                  client.handleRequestError({code: 'ENOERROR'})

                  expect(throwRequestErrorStub).to.be.calledWith(500, 'ENOERROR')
                })
              })

              describe('The code is `ENOTFOUND`', () => {
                it('throws a request error with the status code', () => {
                  client.handleRequestError({code: 'ENOTFOUND'})

                  expect(throwRequestErrorStub).to.be.calledWith(502, 'ENOTFOUND')
                })
              })

              describe('The code is `ECONNREFUSED`', () => {
                it('throws a request error with the status code', () => {
                  client.handleRequestError({code: 'ECONNREFUSED'})

                  expect(throwRequestErrorStub).to.be.calledWith(503, 'ECONNREFUSED')
                })
              })

              describe('The code is not recognised', () => {
                it('throws a request error with the default status code', () => {
                  client.handleRequestError({code: 'ENOERROR'})

                  expect(throwRequestErrorStub).to.be.calledWith(500, 'ENOERROR')
                })
              })
            })

            it('throws a request error with the code', () => {
              client.handleRequestError({code: 'mock code'})

              expect(throwRequestErrorStub).to.be.calledWith(500, 'mock code')
            })
          })

          describe('The error does not have a `code` field', () => {
            it('throws a request error with the default code and the default type', () => {
              client.handleRequestError({error: { }})

              expect(throwRequestErrorStub).to.be.calledWith(500, 'EUNSPECIFIED')
            })
          })
        })
      })
    })
  })

  describe('`throwRequestError()', () => {
    let client
    beforeEach(() => {
      client = new FBJWTClient(serviceSecret, serviceToken, serviceSlug, microserviceUrl)
    })

    describe('With a code', () => {
      it('throws an error', () => expect(() => client.throwRequestError('mock code')).to.throw(Error))

      describe('The error', () => {
        it('has the expected name', () => {
          try {
            client.throwRequestError('mock code')
          } catch ({name}) {
            expect(name)
              .to.equal('FBJWTClientError')
          }
        })

        it('has the expected code', () => {
          try {
            client.throwRequestError('mock code')
          } catch ({code}) { // {error: }) {
            expect(code)
              .to.equal('mock code')
          }
        })

        it('has the expected message', () => {
          try {
            client.throwRequestError('mock code')
          } catch ({message}) { // {error: }) {
            expect(message)
              .to.equal('mock code')
          }
        })
      })
    })

    describe('With a code and a message', () => {
      it('throws an error', () => expect(() => client.throwRequestError('mock code', 'mock message')).to.throw(Error))

      describe('The error', () => {
        it('has the expected name', () => {
          try {
            client.throwRequestError('mock code', 'mock message')
          } catch ({name}) {
            expect(name)
              .to.equal('FBJWTClientError')
          }
        })

        it('has the expected code', () => {
          try {
            client.throwRequestError('mock code', 'mock message')
          } catch ({code}) { // {error: }) {
            expect(code)
              .to.equal('mock code')
          }
        })

        it('has the expected message', () => {
          try {
            client.throwRequestError('mock code', 'mock message')
          } catch ({message}) { // {error: }) {
            expect(message)
              .to.equal('mock message')
          }
        })
      })
    })
  })
})

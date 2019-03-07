# Form Builder JSON Web Token client (Node)

Base client for making requests to Form Builder platform endpoints that require JSON Web Tokens for authenctication

## Requirements

Node

## Installation

`npm install @ministryofjustice/fb-jwt-client-node`

## Usage

### Loading and initialising basic client

``` javascript
// load client class
const {FBJWTClient} = require('@ministryofjustice/fb-jwt-client-node')

// initialise client
const jwtClient = new FBJWTClient(serviceToken, serviceSlug, microserviceUrl, [errorClass])
```

#### `serviceToken`

Constructor will throw an error if no service token is passed

#### `serviceSlug`

Constructor will throw an error if no service slug is passed

#### `microserviceUrl`

Constructor will throw an error if no service url is passed

#### `errorClass`

By default, uses FBJWTClientError

### Extending

``` javascript
// extend base class
class FBMyClient extends FBJWTClient {
  constructor (serviceToken, serviceSlug, microserviceUrl, myVar) {
    super(serviceToken, serviceSlug, microserviceUrl)
    // do something with additional constructor argument
    this.myVar = myVar
  }
}

const myClient = new FBMyClient('service token', 'myservice', 'http://myservice', 'my var')
```

``` javascript
// extend base class with custom error
class FBAnotherClient extends FBJWTClient {
  constructor (serviceToken, serviceSlug, microserviceUrl) {
    // create custom error class
    class FBAnotherClientError extends FBJWTClient.prototype.ErrorClass {}
    super(serviceToken, serviceSlug, microserviceUrl, FBAnotherClientError)
  }
}
```

### Methods

- generateAccessToken

  Generate JWT access token

- createEndpointUrl

  Return user-specific endpoint

- sendGet

  Handle client get requests

- sendPost

  Handle client post requests

- encrypt

  Encrypt data with AES 256

- decrypt

  Decrypt data

- handleRequestError

  Handle client response errors

- createRequestOptions

  Create request options

- throwRequestError

  Convenience function for throwing errors

### Loading and initialising  client with secret and associated methods

``` javascript
// load client class
const {FBJWTClientWithSecret} = require('@ministryofjustice/fb-jwt-client-node')

// initialise client
const jwtClientWithSecret = new FBJWTClientWithSecret(serviceSecret, serviceToken, serviceSlug, microserviceUrl, [errorClass])
```

#### Methods

- encryptUserIdAndToken

  Encrypt user ID and token using service secret

- decryptUserIdAndToken

  Decrypt user ID and token using service secret

## Further details

See documentation in code for further details and `fb-user-datastore-client-node` and `fb-submitter-client-node` for examples.
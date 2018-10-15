# Form Builder JSON Web Token client (Node)

Base client for making requests to Form Builder platform endpoints that require JSON Web Tokens for authenctication

## Requirements

Node

## Installation

`npm install @ministryofjustice/fb-jwt-client-node`

## Usage

### Loading and initialising

``` javascript
// load client class
const FBJWTClient = require('@ministryofjustice/fb-jwt-client-node')

// initialise client
const jwtClient = new FBJWTClient(serviceToken, [errorClass])
```

### `serviceToken`

Constructor will throw an error if no service token is passed

### `errorClass`

By default, uses FB

## Extending

``` javascript
// extend base class
class FBMyClient extends FBJWTClient {
  constructor (serviceToken, myVar) {
    super(serviceToken)
    // do something with additional constructor argument
    this.myVar = myVar
  }
}

const myClient = new FBMyClient('service token', 'my var')
```

``` javascript
// extend base class with custom error
class FBAnotherClient extends FBJWTClient {
  constructor (serviceToken) {
    // create custom error class
    class FBAnotherClientError extends FBJWTClient.prototype.ErrorClass {}
    super(serviceToken, FBAnotherClientError)
    super(serviceToken)
  }
}
```

## Methods

- generateAccessToken

  Generate JWT access token

- getEndpointUrl

  Create user-specific endpoint

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

See documentation in code for further details and `fb-user-datastore-client-node` and `fb-submitter-client-node` for examples.
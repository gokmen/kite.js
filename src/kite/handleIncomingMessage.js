const parse = require('try-json-parse')
const handleAuth = require('./auth')
const KiteError = require('./error')

const mungeCallbacks = (callbacks, n) => {
  // FIXME: this is an ugly hack; there must be a better way to implement it:
  for (let k of Object.keys(callbacks || {})) {
    const c = callbacks[k]
    if (c.join('.') === '0.responseCallback') {
      callbacks[k] = [n]
    }
    if (c[1] === 'withArgs') {
      // since we're rewriting the protocol for the withArgs case,
      // we need to remove everything up to withArgs
      callbacks[k] = c.slice(2)
    }
  }
  return callbacks
}

module.exports = function (proto, message) {
  let responseCallback
  let withArgs
  this.emit('debug', `Receiving: ${message}`)

  const req = parse(message)

  if (req == null) {
    this.emit('warning', new KiteError(`Invalid payload! (${message})`))
    return
  }

  let { arguments: args, links, callbacks, method, authentication: auth } = req

  if (args.length > 0) {
    [{ withArgs, responseCallback, authentication: auth }] = Array.from(args)
  }

  if (withArgs == null && responseCallback == null) {
    this.emit('debug', 'Handling a normal dnode message')
    return proto.handle(req)
  }

  this.emit('debug', 'Authenticating request')

  return handleAuth
    .call(this, method, auth, this.key)
    .then(
      function (token) {
        this.emit('debug', 'Authentication passed')

        if (withArgs == null) {
          withArgs = []
        }

        if (!Array.isArray(withArgs)) {
          withArgs = [withArgs]
        }

        mungeCallbacks(callbacks, withArgs.length)

        // set this as the current token for the duration of the synchronous
        // method call.
        // NOTE: this mechanism may be changed at some point in the future.
        this.currentToken = token

        proto.handle({
          method,
          arguments: [...Array.from(withArgs), responseCallback],
          links,
          callbacks,
        })

        return (this.currentToken = null)
      }.bind(this)
    )
    .catch(
      function (err) {
        this.emit('debug', 'Authentication failed')

        mungeCallbacks(callbacks, 1)

        return proto.handle({
          method   : 'kite.echo',
          arguments: [err, responseCallback],
          links,
          callbacks,
        })
      }.bind(this)
    )
}

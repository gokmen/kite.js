import Emitter from '../../kite/emitter'
import { State } from '../../constants'

export default class Session extends Emitter {
  constructor(connection) {
    super()

    this.connection = connection

    this.connection.on('message', message => {
      return this.emit('message', message)
    })

    this.connection.on('close', () => {
      return this.emit('close')
    })
  }

  getId() {
    return `${this.connection._socket.remoteAddress}:${this.connection._socket
      .remotePort}`
  }

  getState() {
    let state = this.connection.readyState

    // SockJS readyState
    // 0-connecting, 1-open, 2-closing, 3-closed.
    switch (state) {
      case 0:
        return State.CONNECTING
      case 1:
        return State.READY
      case 2:
        return State.CLOSING
      case 3:
        return State.CLOSED
      default:
        return State.NOTREADY
    }
  }

  send(message) {
    return this.connection.send(message)
  }

  close() {
    return this.connection.close()
  }
}

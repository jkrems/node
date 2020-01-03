/* eslint-disable */
let nextId = 1;
function getNewId() {
  const id = nextId;
  nextId++;
  return id;
}
class RPCIncomingBridge {
  pending = 0;
  port;
  constructor(port, handler) {
    this.port = port;
    port.on('message', async (msg) => {
      this.port.ref();
      this.pending++;
      const { id, body } = msg;
      try {
        const result = await handler(body);
        port.postMessage({
          id,
          result,
          hadThrow: false
        });
      } catch (e) {
        port.postMessage({
          id,
          result: e,
          hadThrow: true
        });
      } finally {
        this.pending--;
        if (this.pending <= 0) {
          this.pending = 0;
          this.port.unref();
        }
      }
    });
  }
}
class RPCOutgoingBridge {
  pending = new Map();
  port;
  constructor(port) {
    this.port = port;
    port.on('message', async (msg) => {
      const { id, result, hadThrow } = msg;
      if (this.pending.has(id)) {
        const handler = this.pending.get(id);
        this.pending.delete(id);

        if (this.pending.size === 0) {
          this.port.unref();
        }
        if (hadThrow) {
          handler.throw(result);
        } else {
          handler.return(result);
        }
      }
    });
    this.port.unref();
  }
  send(body) {
    const id = getNewId();
    this.port.postMessage({
      id,
      body
    });
    this.port.ref();
    return new Promise((f, r) => {
      this.pending.set(id, {
        return: f,
        throw: r
      });
    });
  }
}
class ResolveRequest {
  static type = 'resolve.request';
  type = ResolveRequest.type;
  specifier;
  base;
  conditions;
  constructor({ specifier, base, conditions }) {
    this.specifier = specifier;
    this.base = base;
    this.conditions = conditions;
  }
  static fromOrNull(o) {
    if (o.type !== ResolveRequest.type) return null;
    return new ResolveRequest(o);
  }
}
class ResolveResponse {
  static type = 'resolve.response';
  type = ResolveResponse.type;
  url;
  format;
  constructor({ url, format }) {
    this.url = url;
    this.format = format;
  }
  static fromOrNull(o) {
    if (o.type !== ResolveResponse.type) return null;
    return new ResolveResponse(o);
  }
}
module.exports = {
  ResolveRequest,
  ResolveResponse,
  RPCIncomingBridge,
  RPCOutgoingBridge,
  getNewId
};

/* eslint-disable */
const {
  ResolveRequest,
  ResolveResponse,
  RPCIncomingBridge,
  RPCOutgoingBridge
} = require('internal/modules/esm/ipc_types');
const {
  parentPort,
  workerData,
  MessageChannel
} = require('worker_threads');
const esmLoader = require('internal/process/esm_loader');
{
  let outsideAbovePort, insideAbovePort;
  if (workerData.nothingAbove !== true) {
    ({
      port1: outsideAbovePort,
      port2: insideAbovePort,
    } = new MessageChannel());
    addAbove(insideAbovePort);
  }
  const {
    port1: insideBelowPort,
    port2: outsideBelowPort,
  } = new MessageChannel();
  parentPort.postMessage({
    outsideAbovePort,
    outsideBelowPort
  }, outsideAbovePort ?
    [outsideAbovePort, outsideBelowPort] :
    [outsideBelowPort]);
  if (workerData.nothingAbove) {
    globalThis.parent = {
      async resolve(params) {
        return esmLoader.ESMLoader.resolve(params.specifier, params.base);
      }
    };
  } else {
    const aboveDelegates = [];
    let rpcIndex = 0;
    const pendingAbove = [];
    globalThis.parent = {
      resolve(params) {
        return new Promise((f, r) => {
          if (rpcIndex >= aboveDelegates.length) {
            pendingAbove.push({
              params,
              return: f,
              throw: r
            });
            return;
          }
          const rpcAbove = aboveDelegates[rpcIndex];
          rpcIndex++;
          sendAbove(params, rpcAbove, f, r);
        });
      }
    };
    function addAbove(port) {
      if (workerData.nothingAbove === true) throw new Error();
      port.on('close', () => {
        const i = aboveDelegates.indexOf(rpcAbove);
        aboveDelegates.splice(i, 1);
        if (i < rpcIndex) rpcIndex--;
      });
      let rpcAbove = new RPCOutgoingBridge(insideAbovePort);

      aboveDelegates.push(rpcAbove);
      const pending = [...pendingAbove];
      pendingAbove.length = 0;
      for (const { params, return: f, throw: r } of pending) {
        sendAbove(params, rpcAbove, f, r);
      }
    }

    async function sendAbove(params, rpcAbove, f, r) {
      try {
        const value = ResolveResponse.fromOrNull(
          await rpcAbove.send(new ResolveRequest(params))
        );
        if (value !== null) return f(value);
        else return r(new Error('unknown resolve response'));
      } catch (e) {
        return r(e);
      }
    }
  }

  function addBelow(port) {
    new RPCIncomingBridge(port, async (body) => {
      if (body.type === 'addBelowPort') {
        addBelow(body.port);
        return;
      }
      const o = ResolveRequest.fromOrNull(body);
      if (o !== null) {
        return new ResolveResponse(await hooks.resolve(o));
      } else {
        throw new Error('unknown loader hook: ' + body.type);
      }
    });
  }
  addBelow(insideBelowPort);
}
esmLoader.ESMLoader.import(workerData.loaderHREF).catch(
  (err) => {
    internalBinding('errors').triggerUncaughtException(
      err,
      true /* fromPromise */
    );
  }
);

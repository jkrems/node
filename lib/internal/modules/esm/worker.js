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
} = require('worker_threads');
if (!parentPort) return;
parentPort.close();
const esmLoader = require('internal/process/esm_loader');
{
  const {
    insideBelowPort,
    insideAbovePort
  } = workerData;
  let parentLoaderAPI;
  if (!insideAbovePort) {
    parentLoaderAPI = {
      async resolve(specifier, base) {
        let {
          url, format
        } = await esmLoader.ESMLoader.resolve(specifier, base);
        if (format === 'builtin') {
          // trim node:
          url = url.slice(5);
        }
        return { url, format };
      }
    };
  } else {
    const aboveDelegates = [];
    let rpcIndex = 0;
    const pendingAbove = [];
    parentLoaderAPI = {
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

    addAbove(insideAbovePort);
  }

  const userModule = esmLoader.ESMLoader.importWrapped(workerData.loaderHREF).catch(
    (err) => {
      // console.error({err})
      internalBinding('errors').triggerUncaughtException(
        err,
        true /* fromPromise */
      );
    }
  );

  function addBelow(port) {
    new RPCIncomingBridge(port, async (body) => {
      // console.log('BELOW GOT MESSAGE', body);
      if (body.type === 'addBelowPort') {
        addBelow(body.port);
        return;
      }
      // request could have come in prior to user loader finishing loading
      // e.g. entry points
      const { namespace: hooks} = await userModule;
      const o = ResolveRequest.fromOrNull(body);
      if (o !== null) {
        return new ResolveResponse(await hooks.resolve(o.specifier, o.base, parentLoaderAPI.resolve));
      } else {
        throw new Error('unknown loader hook: ' + body.type);
      }
    });
    port.ref();
  }
  // console.log('ADDED BELOW PORT')
  // insideBelowPort.on('message', console.dir)
  addBelow(insideBelowPort);
}

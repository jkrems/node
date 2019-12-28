'use strict';

const {
  ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING,
} = require('internal/errors').codes;
const assert = require('internal/assert');
const { Loader } = require('internal/modules/esm/loader');
const { pathToFileURL } = require('internal/url');
const {
  getModuleFromWrap,
} = require('internal/vm/module');
const { getOptionValue } = require('internal/options');
const userLoader = getOptionValue('--experimental-loader');

exports.initializeImportMetaObject = function(wrap, meta) {
  const { callbackMap } = internalBinding('module_wrap');
  if (callbackMap.has(wrap)) {
    const { initializeImportMeta } = callbackMap.get(wrap);
    if (initializeImportMeta !== undefined) {
      initializeImportMeta(meta, getModuleFromWrap(wrap) || wrap);
    }
  }
};

exports.importModuleDynamicallyCallback = async function(wrap, specifier) {
  assert(calledInitialize === true || !userLoader);
  if (!calledInitialize) {
    process.emitWarning(
      'The ESM module loader is experimental.',
      'ExperimentalWarning', undefined);
    calledInitialize = true;
  }
  const { callbackMap } = internalBinding('module_wrap');
  if (callbackMap.has(wrap)) {
    const { importModuleDynamically } = callbackMap.get(wrap);
    if (importModuleDynamically !== undefined) {
      return importModuleDynamically(
        specifier, getModuleFromWrap(wrap) || wrap);
    }
  }
  throw new ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING();
};

let ESMLoader = new Loader();
exports.ESMLoader = ESMLoader;

function addLoaderWorkerGlobals(loader) {
  globalThis.self = globalThis;

  class FetchEvent {
    constructor(type, init) {
      this._type = type;
      this._init = init;
      this.responsePromise = null;
    }

    get request() {
      return this._init.request;
    }

    respondWith(responsePromise) {
      this.responsePromise = responsePromise;
    }
  }
  globalThis.FetchEvent = FetchEvent;

  // TODO: Use full Headers API
  class Headers {
    constructor(values = []) {
      this.values = new Map(values);
    }

    set(key, value) {
      this.values.set(key, value);
    }
  }
  globalThis.Headers = Headers;

  // TODO: Use full Request API
  class Request {
    constructor(url) {
      this.url = url;
      this.method = 'GET';
    }
  }
  globalThis.Request = Request;

  // TODO: Use full Response API
  class Response {
    constructor(body, init = {}) {
      this.url = null;
      this.body = body;
      this.status = init.status || 200;
      this.headers = new Map();
    }

    evilAddURL(url) {
      this.url = url;
      return this;
    }

    async text() {
      return this.body;
    }
  }
  globalThis.Response = Response;

  async function fetch(request) {
    // TODO: Setting the URL shouldn't be exposed like this but *shrug*
    const url = new URL(request.url);

    if (url.protocol === 'file:') {
      return new Response(require('fs').readFileSync(url, 'utf8')).evilAddURL(request.url);
    }
    throw new TypeError('Failed to fetch');
  }
  globalThis.fetch = fetch;

  globalThis.addEventListener = (eventName, handler) => {
    if (eventName === 'fetch') {
      loader.setFetchListener(handler);
    }
  };
}

let calledInitialize = false;
exports.initializeLoader = initializeLoader;
async function initializeLoader() {
  assert(calledInitialize === false);
  process.emitWarning(
    'The ESM module loader is experimental.',
    'ExperimentalWarning', undefined);
  calledInitialize = true;
  if (!userLoader)
    return;
  let cwd;
  try {
    cwd = process.cwd() + '/';
  } catch {
    cwd = 'file:///';
  }
  // If --experimental-loader is specified, create a loader with user hooks.
  // Otherwise create the default loader.
  const { emitExperimentalWarning } = require('internal/util');
  emitExperimentalWarning('--experimental-loader');
  return (async () => {
    // TODO: In a perfect world the loader wouldn't run in the same realm
    const newLoader = new Loader();
    addLoaderWorkerGlobals(newLoader);
    const hooks =
        await ESMLoader.import(userLoader, pathToFileURL(cwd).href);
    ESMLoader = newLoader;
    ESMLoader.hook(hooks);
    return exports.ESMLoader = ESMLoader;
  })();
}

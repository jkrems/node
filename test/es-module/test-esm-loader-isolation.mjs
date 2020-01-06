// Flags: --experimental-loader ./test/fixtures/es-module-loaders/isolation-hook.mjs
import '../common/index.mjs';
import assert from 'assert';

import {parentPort, workerData} from 'test!worker_threads';
import {globalValue} from 'test!globalValue';

assert.strictEqual(parentPort, null);
assert.strictEqual(workerData, null);

assert.notStrictEqual(globalThis.globalValue, globalValue);

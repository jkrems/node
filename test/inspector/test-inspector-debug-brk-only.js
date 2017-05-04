'use strict';
const assert = require('assert');
const execFile = require('child_process').execFile;
const path = require('path');

const common = require('../common');

const mainScript = path.join(common.fixturesDir, 'loop.js');

execFile(process.execPath, [ '--debug-brk', mainScript ], common.mustCall((error, stdout, stderr) => {
  assert.equal(error.code, 9);
  assert.notEqual(stderr.indexOf('Using --debug-brk without --inspect is no longer supported', -1));
}));

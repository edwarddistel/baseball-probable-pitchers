#!/usr/bin/env node
'use strict';

const { runCli } = require('./src/cli');

// Set the exit code only after all async IO finishes, so stdout can flush.
if (require.main === module) {
  runCli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = { runCli };

/** main.js */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';
global.Log = Log;

import './os/core/constants';			// Required for RUNTIME_ID

import { ENV } from '/os/core/macros';

import '/os/core/errors';	// Required here to get the stack trace size increase
import '/global';
import '/commands/default';
import '/proto/index';
import '/os/proto/spawn';

import Player from '/Player';
global.Player = Player;

import '/experiment/index';

/* 
global.Group = require('Group');
global.Time = require('Time');
*/
import memhack from '/os/core/memhack';
import Kernel from '/os/core/kernel';
const kernel = new Kernel();
global.kernel = kernel; // Publish to global scope for commands

const coro = kernel.loop();
module.exports.loop = function () {
	try {
		coro.next();
	} catch (e) {
		if (e.message === 'Generator is already running') {
			Log.error(`Generator is already running, halting cpu`);
			Game.cpu.halt();
		} else {
			throw e;
		}
	}
};

if (ENV('runtime.enable_memhack', true)) {
	module.exports.loop = memhack(module.exports.loop);
}
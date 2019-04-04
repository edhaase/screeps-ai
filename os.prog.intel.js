/** os.prog.intel.js */
'use strict';

const Pager = require('os.core.pager');
const Process = require('os.core.process');

class IntelProc extends Process {
	*run() {
		while (true) {
			yield;
			if (Game.time & 255)
				continue;
			global.Intel.evict();
		}
	}
}

module.exports = IntelProc;
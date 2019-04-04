/** os.prog.planner.js - Room planner */
'use strict';

const Process = require('os.core.process');

class Planner extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
	}

	*run() {
		// Cleanup memory
	}
}

module.exports = Planner;
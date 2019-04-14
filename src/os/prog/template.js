/** os.prog.template.js */
'use strict';

const Process = require('os.core.process');

exports.Template = class Template extends Process {

	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
	}

	*run() {
		while (true) {
			yield;
		}
	}
};
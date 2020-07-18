/** os.prog.overlay.js - Draw visuals */
'use strict';

const Process = require('os.core.process');

class Pixels extends Process {

	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.title = 'Pixel factory';
	}

	*run() {
		while (true) {
			yield;
			if (Game.cpu.bucket >= BUCKET_MAX && Game.cpu.generatePixel)
				Game.cpu.generatePixel();
		}
	}
}

module.exports = Pixels;
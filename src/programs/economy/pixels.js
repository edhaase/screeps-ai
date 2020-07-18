/** os.prog.overlay.js - Draw visuals */
'use strict';

import Process from '/os/core/process';

export default  class Pixels extends Process {

	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.title = 'Pixel factory';
	}

	*run() {
		if (Game.cpu.generatePixel == null)
			return this.warn(`Can't generate pixels, shutting down`);
		while (true) {
			yield;
			if (Game.cpu.bucket >= BUCKET_MAX && Game.cpu.generatePixel)
				Game.cpu.generatePixel();
		}
	}
}
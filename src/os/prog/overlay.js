/** os.prog.overlay.js - Draw visuals */
'use strict';

const Process = require('os.core.process');
const Hud = require('visual.hud');

class Overlay extends Process {

	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.title = 'Visual Hud overlay';
	}

	*run() {
		while (true) {
			yield this.draw();
		}
	}

	draw() {
		Hud.drawEmpireVisuals();
		Hud.drawConstructionProgress();
		Hud.drawConstructionSites();
	}
}

module.exports = Overlay;
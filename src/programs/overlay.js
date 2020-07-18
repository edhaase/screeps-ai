/** os.prog.overlay.js - Draw visuals */
'use strict';

import Process from '/os/core/process';
import * as Hud from '/visual/hud';

export default class Overlay extends Process {

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
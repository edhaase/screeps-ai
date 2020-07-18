/**
 * role.reclaimer - Releases and reclaims a room a higher upgrade throughput
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';

/* eslint-disable consistent-return */
export default {
	minBody: [CLAIM,MOVE],
	/* eslint-disable consistent-return */
	run: function () {
		const controller = Game.getObjectById(this.memory.controller);
		if (!controller || (controller.my && controller.level <= 1))
			return this.setRole('recycle');
		if (!this.pos.isNearTo(controller))
			return this.pushState('MoveTo', { pos: controller.pos, range: 1 });		
		if (controller.my)
			return controller.unclaim();
		
		const status = this.claimController(controller);
		if(status !== OK)
			Log.error(`${this.name}/${this.pos} Reclaimer failed to claim controller with status ${status}`, 'Creep');
	}
};
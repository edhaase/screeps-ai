/**
 * role.reserver.js
 */
'use strict';

import { PLAYER_STATUS } from '/Player';

/* eslint-disable consistent-return */

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	minBody: [CLAIM, CLAIM, MOVE, MOVE],
	minCost: UNIT_COST([CLAIM, CLAIM, MOVE, MOVE]),
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		this.pushStates([
			['EvadeMove', { pos: this.memory.site, range: 1 }]
		]);
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { controller } = this.room;
		if (!controller || this.pos.roomName !== this.memory.site.roomName)
			return this.pushState('EvadeMove', { pos: this.memory.site, range: 1, allowIncomplete: true });
		this.room.memory.reservation = Game.time + _.get(controller, 'reservation.ticksToEnd', 0);
		if (this.flee(10) === OK)
			return;
		// @todo if combat hostiles, flee room?
		let status;
		if (controller.owner && controller.owner.username && !controller.my)
			status = this.attackController(controller);
		else if (controller.reservation && Player.status(controller.reservation.username) <= PLAYER_STATUS.NEUTRAL)
			status = this.attackController(controller);
		else
			status = this.reserveController(controller);
		if (status === ERR_NOT_IN_RANGE)
			this.moveTo(controller, { range: 1 });
		else if (status === OK && controller && controller.sign && controller.sign.text)
			this.signController(controller, '');
	}
};
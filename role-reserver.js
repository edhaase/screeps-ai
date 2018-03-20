/**
 * role-reserver.js
 */
'use strict';

/* eslint-disable consistent-return */
module.exports = {
	init: function (creep) {
		creep.pushStates([
			['MoveTo', {pos: creep.memory.site, range: 1}]
		]);
	},
	run: function () {
		const { controller } = this.room;
		if (!controller || this.pos.roomName !== this.memory.site.roomName)
			return this.pushState('MoveTo', {pos: this.memory.site, range: 1});
		this.room.memory.reservation = Game.time + _.get(controller, 'reservation.ticksToEnd', 0);
		if (this.flee(10) === OK)
			return;
		// @todo if combat hostiles, flee room?
		let status;
		if (controller.owner && controller.owner.username && !controller.my)
			status = this.attackController(controller);
		else if (controller.reservation && Player.status(controller.reservation.username) === PLAYER_HOSTILE)
			status = this.attackController(controller);
		else
			status = this.reserveController(controller);
		if (status === ERR_NOT_IN_RANGE)
			this.moveTo(controller, { range: 1 });
	}
};
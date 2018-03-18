/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role-upgrader');
 * mod.thing == 'a thing'; // true
 */
'use strict';

module.exports = {
	boosts: ['GH','GH2O','XGH2O'],
	init: function (creep) {

	},
	run: function (creep) {
		const { controller } = creep.room;
		if (creep.carry[RESOURCE_ENERGY] === 0) {
			creep.say('\u26FD', true);
			const provider = this.getTarget(
				// +1 to range for providers, in case we opt to park them in less obtrusive spots.
				() => _.map(controller.lookForNear(LOOK_STRUCTURES, true, CREEP_UPGRADE_RANGE+1), LOOK_STRUCTURES),
				(c) => Filter.canProvideEnergy(c)
			);
			if (!provider)
				return creep.moveTo(controller, { range: CREEP_UPGRADE_RANGE });;
			if (this.pull(provider, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
				this.moveTo(provider, { range: 1, maxRooms: 1 });
		} else if (controller && !controller.upgradeBlocked) {
			if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE)
				creep.moveTo(controller, { range: CREEP_UPGRADE_RANGE, maxRooms: 1 });
		} else if (controller && controller.upgradeBlocked > creep.ticksToLive) {
			Log.warn(`${this.pos.roomName}: Upgrade block exeeds creep ttl, recycling ${this.name}`, 'Creep');
			creep.setRole('recycle');
		}
	}
};
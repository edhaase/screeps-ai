/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role-upgrader');
 * mod.thing == 'a thing'; // true
 */
'use strict';

/* global Empire, Filter, CREEP_UPGRADE_RANGE, MAX_ROOM_LEVEL */

const MIN_WAIT_TIME = 3;
const MAX_WAIT_TIME = 5;
const MAX_UPGRADE_PARTS_PER_ROOM = 50;
const MIN_ENERGY_FOR_ACTION = 25;
const MIN_TTL_UNBOOST = 30;

module.exports = {
	boosts: ['GH', 'GH2O', 'XGH2O'],
	have: function (census) {
		return _.sum(census.creeps[`${census.roomName}_upgrader`], c => c.getBodyParts(WORK));
	},
	want: function (census) {
		const { controller } = census;
		if (controller.upgradeBlocked && controller.upgradeBlocked > CREEP_SPAWN_TIME * 6)
			return 0;
		if (controller.level === MAX_ROOM_LEVEL) // Empire at expansion goal?
			return Empire.isAtExpansionGoal() ? CONTROLLER_MAX_UPGRADE_PER_TICK : 0;
		return Math.min(MAX_UPGRADE_PARTS_PER_ROOM, Infinity);
		// let workDesired = 10 * (numSources / 2);
		/* let workDesired = allotedUpgrade;
		if (this.level === MAX_ROOM_LEVEL) {
			if (workAssigned < CONTROLLER_MAX_UPGRADE_PER_TICK && (this.ticksToDowngrade < CONTROLLER_EMERGENCY_THRESHOLD || storedEnergy > 700000))
				require('Unit').requestUpgrader(spawn, roomName, 90, CONTROLLER_MAX_UPGRADE_PER_TICK);
		} else {
			if (this.room.storage)
				workDesired = Math.floor(workDesired * this.room.storage.stock);
			if (workDesired > 1) {
				const workDiff = workDesired - workAssigned;
				const pctWork = _.round(workAssigned / workDesired, 3);
				Log.debug(`${this.pos.roomName} Upgraders: ${workAssigned} assigned, ${workDesired} desired, ${workDiff} diff (${pctWork})`, 'Controller');
				if (pctWork < 0.80 && upgraders.length < MAX_UPGRADER_COUNT)
					require('Unit').requestUpgrader(spawn, roomName, 25, (workDesired));
			} else {
				Log.debug(`${this.pos.roomName} Upgraders: No upgraders desired, ${workAssigned} assigned.`, 'Controller');
			}
		} */

	},
	minBody: [CARRY, MOVE, WORK, WORK],
	body: function ({ spawn, room, home, memory }) {
		var body = [];
		/* if (workDiff <= 0)
			return ERR_INVALID_ARGS;
		// energy use is  active work * UPGRADE_CONTROLLER_POWER, so 11 work parts is 11 ept, over half a room's normal production
		// let max = 2500;
		// @todo Are we sure we're sizing this right?
		const avail = Math.max(250, room.energyCapacityAvailable - (SPAWN_ENERGY_CAPACITY * 0.20));
		if (home && spawn.pos.roomName !== home) {
			body = Arr.repeat([WORK, CARRY, MOVE], avail);
		} else {
			var count = Math.min(workDiff, 1 + Math.floor((avail - 300) / BODYPART_COST[WORK])) || 1;
			let ccarry = 1;
			if (count > 5) {
				ccarry += 2;
				count -= 2;
			}
			if (ccarry + count + 3 > MAX_CREEP_SIZE)
				count = MAX_CREEP_SIZE - (ccarry + 3);
			body = Util.RLD([ccarry, CARRY, count, WORK, 3, MOVE])
		}
		return body; */
	},
	init: function () {
		this.pushState("EnsureStructure", { pos: this.room.controller.pos, structureType: STRUCTURE_CONTAINER, range: CREEP_UPGRADE_RANGE, allowBuild: false });
		this.pushState("EvadeMove", { pos: this.room.controller.pos, range: CREEP_UPGRADE_RANGE });
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { controller } = this.room;
		if (this.ticksToLive < MIN_TTL_UNBOOST && this.isBoosted()) {
			return this.pushState("UnboostSelf");
		}

		if (this.carry[RESOURCE_ENERGY] <= MIN_ENERGY_FOR_ACTION) {
			if (this.carry[RESOURCE_ENERGY] <= 0)
				this.say('\u26FD', true);
			else
				this.upgradeController(this.room.controller);
			const provider = this.getTarget(
				// +1 to range for providers, in case we opt to park them in less obtrusive spots.
				() => _.map(controller.lookForNear(LOOK_STRUCTURES, true, CREEP_UPGRADE_RANGE + 1), LOOK_STRUCTURES),
				(c) => Filter.canProvideEnergy(c)
			);
			if (!provider) {
				const status = this.moveTo(controller, { range: CREEP_UPGRADE_RANGE });
				if (status === ERR_NO_PATH)
					this.defer(_.random(MIN_WAIT_TIME, MAX_WAIT_TIME));
			}
			if (this.take(provider, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
				this.moveTo(provider, {
					range: 1, maxRooms: 1, ignoreRoads: this.pos.inRangeTo(controller, CREEP_UPGRADE_RANGE + 1)
				});
		} else if (controller && !controller.upgradeBlocked) {
			if (this.upgradeController(this.room.controller) === ERR_NOT_IN_RANGE)
				this.moveTo(controller, {
					range: CREEP_UPGRADE_RANGE, maxRooms: 1, ignoreRoads: this.pos.inRangeTo(controller, CREEP_UPGRADE_RANGE + 1)
				});
		} else if (controller && controller.upgradeBlocked > this.ticksToLive) {
			Log.warn(`${this.pos.roomName}: Upgrade block exeeds creep ttl, recycling ${this.name}`, 'Creep');
			this.setRole('recycle');
		}
	}
};
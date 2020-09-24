/*
 * Module code goes here. Use 'export default' to export things:
 * export default.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.upgrader');
 * mod.thing == 'a thing'; // true
 */
'use strict';

import Body from '/ds/Body';
import { canProvideEnergy } from '/lib/filter';
import { ICON_FUEL } from '/lib/icons';
import { Log, LOG_LEVEL } from '/os/core/Log';

/* global Empire, Filter, CREEP_UPGRADE_RANGE, MAX_ROOM_LEVEL */

const MIN_WAIT_TIME = 3;
const MAX_WAIT_TIME = 5;
const MAX_UPGRADE_PARTS_PER_ROOM = 50;
const MIN_ENERGY_FOR_ACTION = 25;
const MIN_TTL_UNBOOST = 30;

export default {
	boosts: ['GH', 'GH2O', 'XGH2O'],
	have: function (census) {
		return _.sum(census.creeps[`${census.roomName}_upgrader`], c => c.getBodyParts(WORK));
	},
	want: function (census) {
		const { controller } = census;
		if (controller.upgradeBlocked && controller.upgradeBlocked > CREEP_SPAWN_TIME * 6)
			return 0;
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
	body: function ({ room }) {
		var body = [];
	},
	init: function (job) {
		const room = Game.rooms[job.memory.home];
		if (!room)
			return Log.error(`${this.name}/${this.pos} Unable to init upgrader`, 'Creep');
		this.pushState("EnsureStructure", { pos: room.controller.pos, structureType: STRUCTURE_CONTAINER, range: CREEP_UPGRADE_RANGE, allowBuild: false });
		this.pushState("EvadeMove", { pos: room.controller.pos, range: CREEP_UPGRADE_RANGE });
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { controller } = this.room;
		if (this.ticksToLive === MIN_TTL_UNBOOST && this.isBoosted()) {
			return this.pushState("UnboostSelf");
		}

		if (this.carry[RESOURCE_ENERGY] <= MIN_ENERGY_FOR_ACTION) {
			if (this.carry[RESOURCE_ENERGY] <= 0)
				this.say(ICON_FUEL, true);
			else
				this.upgradeController(this.room.controller);
			const provider = this.getTarget(
				// +1 to range for providers, in case we opt to park them in less obtrusive spots.
				() => _.map(controller.lookForNear(LOOK_STRUCTURES, true, CREEP_UPGRADE_RANGE + 1), LOOK_STRUCTURES),
				(c) => canProvideEnergy(c),
				(c) => {
					const link = _.find(c, 'structureType', STRUCTURE_LINK);
					if (link) return link;
					const { container } = controller;
					if (container && canProvideEnergy(container)) return container;
					return _.find(c, 'structureType', STRUCTURE_CONTAINER) || _.first(c)
				}
			);
			if (!provider) {
				const status = this.moveTo(controller, { range: CREEP_UPGRADE_RANGE });
				if (status === ERR_NO_PATH)
					this.defer(_.random(MIN_WAIT_TIME, MAX_WAIT_TIME));
			}
			const status = this.take(provider, RESOURCE_ENERGY);
			if (status === ERR_NOT_IN_RANGE)
				this.moveTo(provider, {
					range: 1, maxRooms: 1, ignoreRoads: this.pos.inRangeTo(controller, CREEP_UPGRADE_RANGE + 1)
				});
			else if (status === OK && provider.hitPct < 1.0)
				return this.pushState('Repair', { target: provider.id, allowMove: false, allowGather: false }, false);
		} else if (controller && !controller.upgradeBlocked) {
			if (this.upgradeController(this.room.controller) === ERR_NOT_IN_RANGE)
				this.moveTo(controller, {
					range: CREEP_UPGRADE_RANGE, maxRooms: 1, ignoreRoads: this.pos.inRangeTo(controller, CREEP_UPGRADE_RANGE + 1)
				});
		} else if (controller && controller.upgradeBlocked > this.ticksToLive) {
			Log.warn(`${this.name}/${this.pos}: Upgrade block exceeds creep ttl -- recycling`, 'Creep');
			this.setRole('recycle');
		}
	}
};
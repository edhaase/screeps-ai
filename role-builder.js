/**
 * role-builder.js
 *
 * Creep role dedicated to building construction sites.
 */
'use strict';
var ignoreCreeps = false;

/* global UNIT_COST, Arr */

/**
 * Average cpu
 * @todo: do we want to do a max carry / dist deal?
 */
const MINIMUM_DECAY_CYCLES = 20;
const BUILDER_MAX_FORTIFY_HITS = RAMPART_DECAY_AMOUNT * MINIMUM_DECAY_CYCLES;

const STATE_UNLOAD = 'u';
const STATE_FORTIFY = 'f';
const STATE_DEFAULT = STATE_UNLOAD;

/* eslint-disable consistent-return */
module.exports = {
	boosts: ['LH', 'LH2O', 'XLH2O'],
	have: function (census) {
		return (census.creeps[`${census.roomName}_builder`] || []).length;
	},
	want: function (census) {
		const sites = census.room.find(FIND_MY_CONSTRUCTION_SITES);
		if (!sites || !sites.length)
			return 0;
		return 2;
	},
	body: function (census) {
		const { spawn } = census;
		const partLimit = Math.floor(elimit / BUILD_POWER);
		const avail = Math.max(SPAWN_ENERGY_START, spawn.room.energyCapacityAvailable * 0.80);
		const pattern = [MOVE, MOVE, MOVE, WORK, WORK, CARRY];
		const cost = UNIT_COST(pattern);
		const al = Math.min(Math.floor(cost * (partLimit / 2)), avail);
		let	body = Arr.repeat(pattern, al); // 400 energy gets me 2 work parts.
		if (_.isEmpty(body)) {
			body = [WORK, CARRY, MOVE, MOVE];
		}
		return body;
	},
	init: function () {
		this.memory.ignoreRoads = (this.plainSpeed === this.roadSpeed);
	},
	run: function () {
		var status;
		if (this.carry[RESOURCE_ENERGY] <= 0)
			return this.pushState('AcquireEnergy', { allowMove: true, allowHarvest: true });
		const state = this.getState(STATE_DEFAULT);
		if (state === STATE_UNLOAD) {
			if (this.pos.hasConstructionSite()) {
				return this.move(_.random(0, 8));
			}
			const site = this.getTarget(
				({ room }) => room.find(FIND_MY_CONSTRUCTION_SITES),
				(s) => s instanceof ConstructionSite,
				(sites) => _.max(sites, s => ((s.progressPct || STRUCTURE_BUILD_PRIORITY[s.structureType] || DEFAULT_BUILD_JOB_PRIORITY) ** 2) / this.pos.getRangeTo(s))
			);
			if (site) {
				if ((status = this.build(site)) === ERR_NOT_IN_RANGE)
					this.moveTo(site, {
						reusePath: 5,
						ignoreRoads: this.memory.ignoreRoads || true,
						ignoreCreeps: ((this.memory.stuck < 3) ? ignoreCreeps : false),
						range: CREEP_BUILD_RANGE,
						maxRooms: 1
						// ignoreCreeps: false
					});
				else if (status !== OK) {
					// Clear obstacles out of the way
					if (OBSTACLE_OBJECT_TYPES.includes(site.structureType)) {
						const obstruction = site.pos.getCreep();
						if (obstruction)
							return obstruction.scatter();
					}
					Log.warn(`build status: ${status} for ${this.name} at ${this.pos}`);
					this.defer(15);
				} else if (site.structureType === STRUCTURE_RAMPART || site.structureType === STRUCTURE_WALL) {
					this.say('Fortify!');
					this.setState(STATE_FORTIFY, { pos: site.pos });
				}
			} else if (this.room.isBuildQueueEmpty()) {
				this.setRole('recycle');
			}
		} else if (state === STATE_FORTIFY) {
			const pos = _.create(RoomPosition.prototype, this.getStateParams().pos);
			const target = pos.getStructure(STRUCTURE_RAMPART) || pos.getStructure(STRUCTURE_WALL);
			if (!target || target.hits > BUILDER_MAX_FORTIFY_HITS)
				return this.setState(STATE_UNLOAD);
			status = this.repair(target);
			Log.debug(`Builder ${this.name} fortifying ${target} with status ${status}`, 'Creep');
			if (status === ERR_NOT_IN_RANGE)
				this.pushState("MoveTo", { pos, range: CREEP_REPAIR_RANGE });
			else if (status !== OK)
				Log.warn(`Builder ${this.name} failed to fortify ${target} with status ${status}`, 'Creep');
		}
	}
};
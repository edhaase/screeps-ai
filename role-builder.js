/**
 * role-builder.js
 *
 * @todo: Add mining state for this creep
 */
'use strict';
var ignoreCreeps = false;

/**
 * Average cpu
 * @todo: do we want to to a max carry / dist deal?
 */
const BUILDER_MAX_FORTIFY_HITS = 10000;

const STATE_UNLOAD = 'u';
const STATE_FORTIFY = 'f';
const STATE_DEFAULT = STATE_UNLOAD;

/* eslint-disable consistent-return */
module.exports = {
	boosts: ['LH','LH2O','XLH2O'],
	init: function () {
		this.memory.ignoreRoads = (this.plainSpeed === this.roadSpeed);
	},
	run: function () {
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
				(sites) => _.max(sites, s => (STRUCTURE_BUILD_PRIORITY[s.structureType] || 1) / this.pos.getRangeTo(s))
			);
			if (site) {
				var status;
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
					console.log(`build status: ${status} for ${this.name} at ${this.pos}`);
					this.defer(15);
				} else if (site.structureType === STRUCTURE_RAMPART || site.structureType === STRUCTURE_WALL) {
					this.say('Fortify!');
					this.setState(STATE_FORTIFY);
				}
			} else if (this.room.isBuildQueueEmpty()) {
				this.setRole('recycle');
			}
		} else if (state === STATE_FORTIFY) {
			var structs = _.map(this.lookForNear(LOOK_STRUCTURES, true, CREEP_REPAIR_RANGE), LOOK_STRUCTURES);
			structs = _.filter(structs, s => s.hits < s.hitsMax && s.hits < BUILDER_MAX_FORTIFY_HITS);
			if (_.isEmpty(structs))
				return this.setState(STATE_UNLOAD);
			this.repair(_.min(structs, 'hits'));
		}
	}
};
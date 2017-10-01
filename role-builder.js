/**
 * role-builder.js
 *
 * @todo: Add mining state for this creep
 */
"use strict";
var ignoreCreeps = false;

/**
 * Average cpu
 * @todo: do we want to to a max carry / dist deal?
 */
const BUILDER_MAX_FORTIFY_HITS = 10000;

module.exports = {
	// Called once on new creep.
	init: function (creep) {
		this.memory.ignoreRoads = (creep.plainSpeed === creep.roadSpeed);
	},
	// Called to calculate body
	body: function (energyCapacity, energyAvailable, room, spawn) {

	},
	// Role function
	run: function run(creep) {
		if (!creep.memory.state)
			creep.memory.state = 'gather';
		if (creep.carry[RESOURCE_ENERGY] >= creep.carryCapacity)
			creep.memory.state = 'unload';
		else if (creep.carry[RESOURCE_ENERGY] === 0 && creep.memory.state !== 'harvest' && creep.memory.state !== 'gather')
			creep.memory.state = 'gather';

		if (creep.memory.state === 'gather') {
			if(creep.gatherEnergy() === ERR_INVALID_TARGET)
				this.setState('harvest');
		} else if(creep.memory.state === 'harvest') {
			const source = this.getTarget(
				({ room }) => room.find(FIND_SOURCES_ACTIVE),
				(s) => (s instanceof Source) && (s.energy > 0 || s.ticksToRegeneration < this.pos.getRangeTo(s)),
				(sources) => this.pos.findClosestByPath(sources)
			);
			creep.harvestOrMove(source);
		} else if (creep.memory.state === 'fortify') {
			var structs = _.map(this.lookForNear(LOOK_STRUCTURES, true, 3), LOOK_STRUCTURES);
			structs = _.filter(structs, s => s.hits < s.hitsMax && s.hits < BUILDER_MAX_FORTIFY_HITS);
			if(_.isEmpty(structs)) {
				this.memory.state = 'unload';
				return;
			}
			var target = _.min(structs, 'hits');
			this.repair(target);
		} else {
			if (this.pos.hasConstructionSite()) {
				return this.move(_.random(0, 8));
			}
			const site = creep.getTarget(
				({ room }) => room.find(FIND_MY_CONSTRUCTION_SITES),
				(s) => s instanceof ConstructionSite,
				(sites) => _.max(sites, s => (STRUCTURE_BUILD_PRIORITY[s.structureType] || 1) / creep.pos.getRangeTo(s))
			);
			if (site) {
				var status;
				if ((status = creep.build(site)) === ERR_NOT_IN_RANGE)
					creep.moveTo(site, {
						reusePath: 5,
						ignoreRoads: this.memory.ignoreRoads || true,
						ignoreCreeps: ((creep.memory.stuck < 3) ? ignoreCreeps : false),
						range: CREEP_BUILD_RANGE,
						maxRooms: 1
						// ignoreCreeps: false
					});
				else if (status !== OK) {
					console.log(`build status: ${status} for ${this.name} at ${this.pos}`);
					this.defer(15);
				} else if (site.structureType === STRUCTURE_RAMPART || site.structureType === STRUCTURE_WALL) {
					this.say('Fortify!');
					this.memory.state = 'fortify';
				}
			} else if (this.room.isBuildQueueEmpty()) {
				creep.setRole('recycle');
			}
		}
	}

};

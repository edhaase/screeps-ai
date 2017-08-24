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
		if (creep.carry.energy >= creep.carryCapacity)
			creep.memory.state = 'unload';
		if (creep.carry.energy === 0)
			creep.memory.state = 'gather';

		if (creep.memory.state === 'gather') {
			creep.gatherEnergy();
		} else {
			if (this.pos.hasConstructionSite()) {
				return this.move(_.random(0, 8));
			}
			const site = creep.getTarget(
				({ room }) => room.find(FIND_MY_CONSTRUCTION_SITES),
				(site) => site instanceof ConstructionSite,
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
				}
			} else {
				if (this.room.isBuildQueueEmpty())
					creep.setRole('recycle');
			}
		}
	}

};

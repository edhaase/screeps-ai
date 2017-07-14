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
module.exports = function run(creep) {
    if(!creep.memory.state)
        creep.memory.state = 'gather';
    if(creep.carry.energy >= creep.carryCapacity)
        creep.memory.state = 'unload';
    if(creep.carry.energy === 0)
        creep.memory.state = 'gather';	
        
    if(creep.memory.state === 'gather') {			
		/* let target = creep.getTarget(
			({room,pos}) => [...room.structures, ...room.resources],
			(candidate) => Filter.canProvideEnergy(candidate),
			(candidates) => creep.pos.findClosestByRange(candidates)
		);
	
		if(target) {
			switch( creep.pull(target, RESOURCE_ENERGY) ) {
				case ERR_NOT_IN_RANGE:
					creep.moveTo(target, { reusePath: 5, ignoreCreeps: false, maxRooms: 1 });
					break;
				case ERR_NOT_ENOUGH_ENERGY:
				case ERR_NOT_ENOUGH_RESOURCES:
					delete creep.cache.target;
					return;
			}
		} */
		creep.gatherEnergy();
    } else {
		if(this.pos.hasConstructionSite()) {
			return this.move(_.random(0,8));
		}
		let site = creep.getTarget(
			({room,pos}) => room.find(FIND_MY_CONSTRUCTION_SITES),
			(site) => site instanceof ConstructionSite,
			(sites) => _.max(sites, s => (STRUCTURE_BUILD_PRIORITY[s.structureType] || 1) / creep.pos.getRangeTo(s))
		);
		if(site) {
			var status;
			if( (status=creep.build(site)) === ERR_NOT_IN_RANGE )        
				creep.moveTo(site, {
					reusePath: 5,
					// ignoreRoads: true,
					ignoreCreeps: ((creep.memory.stuck < 3)?ignoreCreeps:false),
					range: CREEP_BUILD_RANGE,
					maxRooms: 1
					// ignoreCreeps: false
				});
			else if(status !== OK) {
				console.log('build status: ' + status + ' for ' + this.name + ' at ' + this.pos);
				this.defer(15);
			}
		} else {
			if(this.room.isBuildQueueEmpty())
				creep.setRole('recycle');
		}		
    }

};



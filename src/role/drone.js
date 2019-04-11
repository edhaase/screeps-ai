/**
 * role.drone.js - Simple eval programmable drone role
 *
 * Example: Game.spawns.Spawn1.createCreep([MOVE], null, {role: 'drone', program: '() => this.move(LEFT)'});
 * Game.spawns.Spawn1.submit({body: [WORK,MOVE], memory: {home:'E62S46', role: 'drone', program: ' '}})
 * () => { const target = this.pos.findClosestByRange(FIND_STRUCTURES,{filter:s=>s.structureType===STRUCTURE_WALL}); (this.dismantle(target) === OK) || this.moveTo(target, {range:1}); }
 */
'use strict';

module.exports = {
	run: function () {
		// Code was causing stale scope behavior, so no caching
		const program = eval(this.memory.program);
		program.call(this, this);
	}
};
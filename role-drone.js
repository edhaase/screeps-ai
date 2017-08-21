/**
 * role-drone.js - Simple eval programmable drone role
 *
 * Example: Game.spawns.Spawn1.createCreep([MOVE], null, {role: 'drone', program: '() => this.move(LEFT)'});
 */
"use strict";

module.exports = {
	run: function () {
		if (!this.cache.code && this.memory.program)
			this.cache.code = eval(this.memory.program);
		if (this.cache.code)
			this.cache.code.call(this, this);
	}
};
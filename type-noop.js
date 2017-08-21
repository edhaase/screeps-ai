/**
 * type-noop.js
 * No-OP creep. Doesn't do anything.
 *
 * Game.spawns.Spawn7.enqueue([MOVE], null, {type: 'noop'})
 */
"use strict";

class CreepNoop extends Creep {
	/**
	 * Entry point of logic for this creep.
	 */
	runRole() {

	}

	toString() {
		return `[creep noop ${this.name}]`;
	}
}

module.exports = CreepNoop;
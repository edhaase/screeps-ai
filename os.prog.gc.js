/** os.prog.gc.js - Garbage collection process */
'use strict';

/* global Log */

const Process = require('os.core.process');

class GCP extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
	}

	*run() {
		// Cleanup memory
		this.cleanupCreepMemory();
		this.cleanupGroups();
		this.cleanupFlags();
		this.cleanupSpawns();
		this.cleanupRooms();
		this.cleanupStructures();
		yield;
	}

	cleanupCreepMemory() {
		for (const name in Memory.creeps) {
			if (Game.creeps[name])
				continue;
			this.debug(`Garbage collecting creep ${name}`);
			// const age = Game.time - Memory.creeps[name].born;
			// if (Memory.creeps[name].gid)
			//	_.remove(Memory.groups[members], id => id === name);
			const memory = Memory.creeps[name];
			const roleName = memory.role;
			Memory.creeps[name] = undefined;
			try {
				const role = require(`role-${roleName}`);
				if (!role.onCleanup)
					continue;
				role.onCleanup(memory, name);
			} catch (e) {
				Log.error(e.stack, 'Creep');
			}
		}
	}

	cleanupGroups() {
		for (const name in Memory.groups.members) {
			if (Memory.group.members[name].length > 0)
				continue;
			this.debug(`Garbage collecting group ${name}`);
			Memory.group.members[name] = undefined;
			Memory.group.memory[name] = undefined;
		}
	}

	cleanupFlags() {
		for (const name in Memory.flags) {
			if (Game.flags[name] && !_.isEmpty(Memory.flags[name]))
				continue;
			this.debug(`Garbage collecting flag ${name}`);
			Memory.flags[name] = undefined;
		}
	}

	cleanupSpawns() {
		for (const name in Memory.spawns) {
			if (Game.spawns[name])
				continue;
			this.debug(`Garbage collecting spawn ${name}`);
			Memory.spawns[name] = undefined;
		}
	}

	cleanupRooms() {
		Memory.rooms = _.omit(Memory.rooms, _.isEmpty);
	}

	cleanupStructures() {
		for (const id in Memory.structures) {
			if (Game.structures[id])
				continue;
			this.debug(`Garbage collecting structure ${id}, ${JSON.stringify(Memory.structures[id])}`);
			Memory.structures[id] = undefined;
		}
	}
}

module.exports = GCP;
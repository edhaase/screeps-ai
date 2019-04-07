/** os.gc.js - Memory garbage collection*/
'use strict';

/* global ENVC, Log */

const DEFAULT_GC_FREQ = 100;

class GCP {
	static *tick() {
		// Cleanup memory
		while (true) {
			yield* GCP.cleanupCreepMemory();
			yield GCP.cleanupGroups();
			yield GCP.cleanupFlags();
			yield GCP.cleanupSpawns();
			yield GCP.cleanupRooms();
			yield GCP.cleanupStructures();
			global.kernel.getCurrentThread().sleep = Game.time + ENVC('memory.gc_freq', DEFAULT_GC_FREQ, 0);
		}
	}

	static *cleanupCreepMemory() {
		for (const name in Memory.creeps) {
			yield true;
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

	static cleanupGroups() {
		for (const name in Memory.groups.members) {
			if (Memory.group.members[name].length > 0)
				continue;
			this.debug(`Garbage collecting group ${name}`);
			Memory.group.members[name] = undefined;
			Memory.group.memory[name] = undefined;
		}
	}

	static cleanupFlags() {
		for (const name in Memory.flags) {
			if (Game.flags[name] && !_.isEmpty(Memory.flags[name]))
				continue;
			this.debug(`Garbage collecting flag ${name}`);
			Memory.flags[name] = undefined;
		}
	}

	static cleanupSpawns() {
		for (const name in Memory.spawns) {
			if (Game.spawns[name])
				continue;
			this.debug(`Garbage collecting spawn ${name}`);
			Memory.spawns[name] = undefined;
		}
	}

	static cleanupRooms() {
		Memory.rooms = _.omit(Memory.rooms, _.isEmpty);
	}

	static cleanupStructures() {
		for (const id in Memory.structures) {
			if (Game.structures[id])
				continue;
			this.debug(`Garbage collecting structure ${id}, ${JSON.stringify(Memory.structures[id])}`);
			Memory.structures[id] = undefined;
		}
	}

	static debug(msg) {
		Log.debug(msg, 'GC');
	}
}

module.exports = GCP;
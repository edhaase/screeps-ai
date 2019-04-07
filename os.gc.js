/** os.gc.js - Memory garbage collection*/
'use strict';

/* global ENVC, Log */

const DEFAULT_GC_FREQ = 100;

class GCP {
	static *tick() {
		// Cleanup memory
		while (!(yield)) {
			Log.debug(`Running cleanup`, 'GC');
			GCP.cleanupCreepMemory();
			GCP.cleanupGroups();
			GCP.cleanupFlags();
			GCP.cleanupSpawns();
			GCP.cleanupRooms();
			GCP.cleanupStructures();
			global.kernel.getCurrentThread().sleep = Game.time + ENVC('memory.gc_freq', DEFAULT_GC_FREQ, 0);
			Log.debug(`Cleanup complete`, 'GC');
		}
	}

	static cleanupCreepMemory() {
		for (const name in Memory.creeps) {
			if (Game.creeps[name])
				continue;
			this.debug(`Garbage collecting creep ${name}`);
			// const age = Game.time - Memory.creeps[name].born;
			// if (Memory.creeps[name].gid)
			//	_.remove(Memory.groups[members], id => id === name);
			try {
				const memory = Memory.creeps[name];
				const roleName = memory.role;
				delete Memory.creeps[name]; // Don't set to undefined, if memhack enabled the key will still be iterable
				try {
					const role = require(`role-${roleName}`);
					if (!role.onCleanup)
						continue;
					role.onCleanup(memory, name);
				} catch (e) {
					Log.error(e.stack, 'Creep');
				}
			} catch (e) {
				Log.error(`Error garbage collecting ${name}`, 'GC');
				Log.error(e.stack);
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
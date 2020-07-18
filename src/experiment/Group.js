/** Group.js - Unit Groups */
'use strict';

/* global DEFINE_CACHED_GETTER, Log */
import { Log, LOG_LEVEL } from '/os/core/Log';

DEFINE_CACHED_GETTER(Creep.prototype, 'squad', function(ro) {
	const { gid } = ro.memory;
	if (!gid || !Memory.groups.members[gid] || !!Memory.groups.members[gid].length)
		return []; // always a membef of it's own group
	return Memory.groups.members[gid].filter(m => m !== this.name).map(m => Game.creeps[m]);
});



/**
 * Wrap spawnCreep (again), we don't care which order this happens in.
 * 
 * Creates groups and adds units at spawn time.
 */
const { spawnCreep } = StructureSpawn.prototype;
StructureSpawn.prototype.spawnCreep = function (body, name, opts = {}) {
	// opts.energyStructures = this.getProviderCache();
	const result = spawnCreep.call(this, body, name, opts);
	if (result === OK && opts.group) {
		if (!Memory.groups.members[opts.group]) {
			Log.debug(`Creating group entry for ${opts.group}`, 'Group');
			Memory.groups.memory[opts.group] = {};
			Memory.groups.members[opts.group] = [];
		}
		Memory.groups.members[opts.group].push(name);
	}
	return result;
};

Object.defineProperty(RoomObject.prototype, 'gmem', {
	get: function () {
		const id = this.memory.gid;
		if (this === RoomObject.prototype || id == null)
			return null;
		if (!Memory.groups.memory[id])
			Memory.groups.memory[id] = {};
		return Memory.groups.memory[id];
	},
	set: function (v) {
		Memory.groups.memory[this.memory.gid] = v;
	},
	configurable: true
});

module.exports = {
	getNextGroupId: function () {
		return Memory.groups.nextId++;
	}
};
/**
 * ext.source.js
 *
 * All prototype extensions for Source
 */
'use strict';

/* global DEFINE_CACHED_GETTER, Log */

DEFINE_CACHED_GETTER(Source.prototype, 'ept', s => s.energyCapacity / ENERGY_REGEN_TIME);
DEFINE_CACHED_GETTER(Source.prototype, 'harvestParts', s => s.energyCapacity / HARVEST_POWER / ENERGY_REGEN_TIME);

/**
 * Double layer cache?
 */
/* DEFINE_CACHED_GETTER(Source.prototype, 'container', function(source) {
	let {cid} = source.cache;
	let container = Game.getObjectById(cid);
	if(!container) {
		Log.warn('[Source] Cache miss on container at ' + this.pos);
		let {room,pos} = source;
		container = _.find(room.structures, x => x.structureType === STRUCTURE_CONTAINER && pos.inRangeTo(x,1));
		if(container) {
			Log.info('[Source] container found at ' + container.pos);
			source.cache.cid = container.id;
		} else {
			Log.warn('[Source] No container found');
		}
	}
	return container;
}); */

DEFINE_CACHED_GETTER(Source.prototype, 'container', function (source) {
	var { cid } = source.memory || {};
	var container = Game.getObjectById(cid);
	if (!cid || !container) {
		Log.debug(`Cache miss on container at ${this.pos}`, "Source");
		var { room, pos } = source;
		// container = _.find(room.structures, x => x.structureType === STRUCTURE_CONTAINER && pos.inRangeTo(x, 1));
		container = this.pos.getStructure(STRUCTURE_CONTAINER, 1);
		if (container) {
			Log.debug(`Container found at ${container.pos}`, "Source");
			source.memory = { cid: container.id };
		} else {
			Log.debug('No container found', 'Source');
			Memory.sources[this.id] = undefined;
		}
	}
	return container;
});

/**
 * Provides source memory.
 */
if (!Memory.sources) {
	Log.warn('[Memory] Initializing source memory');
	Memory.sources = {};
}

Object.defineProperty(Source.prototype, "memory", {
	get: function () {
		return Memory.sources[this.id];
	},
	set: function (v) {
		return _.set(Memory, ['sources', this.id], v);
	},
	configurable: true,
	enumerable: false
});
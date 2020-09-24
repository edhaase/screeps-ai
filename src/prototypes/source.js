/**
 * ext/source.js
 *
 * All prototype extensions for Source
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';

/* global DEFINE_CACHED_GETTER, Log */

DEFINE_CACHED_GETTER(Source.prototype, 'ept', s => s.getAvgEnergyPerTick());
DEFINE_CACHED_GETTER(Source.prototype, 'harvestParts', s => s.ept / HARVEST_POWER);
// DEFINE_CACHED_GETTER(Source.prototype, 'harvestParts', s => s.getCapacity() / HARVEST_POWER / ENERGY_REGEN_TIME);

Source.prototype.getAvgEnergyPerTick = function () {
	const base = this.energyCapacity / ENERGY_REGEN_TIME;
	const { level = 0 } = _.find(this.effects, ({ effect }) => effect === PWR_REGEN_SOURCE) || {};
	if (!level)
		return base;
	const { period, effect } = POWER_INFO[PWR_REGEN_SOURCE];
	const bonus = effect[level - 1] / period;
	return base + bonus;
}

Source.prototype.getCapacity = function () {
	const { level = 0 } = _.find(this.effects, ({ effect }) => effect === PWR_REGEN_SOURCE) || {};
	if (!level)
		return this.energyCapacity;
	const { duration, period, effect } = POWER_INFO[PWR_REGEN_SOURCE];
	return this.energyCapacity + (duration * (effect[level - 1] / period));
}


/**
 * Double layer cache?
 */
DEFINE_CACHED_GETTER(Source.prototype, 'container', function (source) {
	var { cid } = source.memory || {};
	var container = Game.getObjectById(cid);
	if (!cid || !container) {
		Log.debug(`Cache miss on container at ${this.pos}`, "Source");
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
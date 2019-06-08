/**
 * ext.structure.storage.js - Now with adjustable reserve
 * 
 * During times of conflict the reserve can raise, maintaining a stockpile for defenses.
 *
 * Note: Don't tick this structure to change states.
 * If the storage is lost we could get stuck in a state.
 * But we _could_ track the previous tick's energy and report the state change.
 */
'use strict';

/* global DEFINE_CACHED_GETTER */

const DEFAULT_STORAGE_RESERVE = 100000;
const MAX_OVERSTOCK_PCT = 10.0;

Object.defineProperty(StructureStorage.prototype, 'reserve', {
	set: function (value) {
		if (value === null) {
			this.memory.r = undefined;
			return;
		}
		if (!(typeof value === 'number'))
			throw new TypeError(`Expected number, got ${value}`);
		this.memory.r = Math.min(this.storeCapacity, value);		
	},
	get: function () {
		if (this === StructureStorage.prototype)
			return 0;
		if (this.memory.r == null)
			return Math.min(DEFAULT_STORAGE_RESERVE, this.storeCapacity || 1);
		return this.memory.r;
	},
	configurable: true,
	enumerable: false
});

// Sliding scale - Possibly exponential decay at lower levels
DEFINE_CACHED_GETTER(StructureStorage.prototype, 'stock', (s) => CLAMP(0.0, (s.store[RESOURCE_ENERGY] || 0) / s.reserve, MAX_OVERSTOCK_PCT));
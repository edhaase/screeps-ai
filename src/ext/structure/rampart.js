/**
 * ext.structure.rampart.js - Rampart overrides
 */
'use strict';

/* global RAMPART_UPKEEP */

StructureRampart.prototype.decay = RAMPART_DECAY_AMOUNT / RAMPART_DECAY_TIME;
StructureRampart.prototype.upkeep = RAMPART_UPKEEP;

/**
 * Fix for a missing rampart is public check.
 */
const { setPublic } = StructureRampart.prototype;
StructureRampart.prototype.setPublic = function (status) {
	if (status !== this.isPublic)
		return setPublic.call(this, status);
	return OK;
};
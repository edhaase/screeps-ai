/**
 * ext.js
 *
 * General purpose extensions, or prototype extensions that don't fit anywhere else.
 */
'use strict';

/* global DEFINE_CACHED_GETTER */

DEFINE_CACHED_GETTER(ConstructionSite.prototype, 'progressPct', c => c.progress / c.progressTotal);

ConstructionSite.prototype.draw = function () {
	const { room, pos, structureType } = this;
	if (room)
		this.room.visual.structure(pos.x, pos.y, structureType);
};
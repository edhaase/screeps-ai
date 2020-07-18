/**  */
'use strict';

/* global DEFINE_CACHED_GETTER */

DEFINE_CACHED_GETTER(Ruin.prototype, 'storedTotal', s => s.store.getUsedCapacity());
DEFINE_CACHED_GETTER(Ruin.prototype, 'storedPct', ({ storedTotal, storeCapacity }) => storedTotal / storeCapacity);
DEFINE_CACHED_GETTER(Ruin.prototype, 'storedNonEnergyResources', s => s.mineralAmount || (s.store && s.storedTotal - (s.store[RESOURCE_ENERGY] || 0) || 0));

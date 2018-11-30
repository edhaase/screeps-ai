/** ext-tombstone.js */
'use strict';

/* global DEFINE_CACHED_GETTER, Log, STACK_TRACE, Tombstone */

DEFINE_CACHED_GETTER(Tombstone.prototype, 'storedTotal', t => _.sum(t.store));
DEFINE_CACHED_GETTER(Tombstone.prototype, 'storedPct', ({ storedTotal, storeCapacity }) => storedTotal / storeCapacity);
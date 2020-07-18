/** ext/store - prototype extensions for the store class */
'use strict';

/** global Store */

DEFINE_CACHED_GETTER(Store.prototype, 'total', s => s.getUsedCapacity());

Store.prototype.hasNonEnergyResource = function () {
	return !!_.any(this, (amt, key) => amt > 0 && key !== RESOURCE_ENERGY);
};
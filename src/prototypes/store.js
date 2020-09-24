/** ext/store - prototype extensions for the store class */
'use strict';

import { HIDE_PROPERTY } from '/os/core/macros';

/** global Store */

DEFINE_CACHED_GETTER(Store.prototype, 'total', s => s.getUsedCapacity());

Store.prototype.hasNonEnergyResource = function () {
	return !!_.any(this, (amt, key) => amt > 0 && key !== RESOURCE_ENERGY);
};

HIDE_PROPERTY(Store.prototype, 'hasNonEnergyResource');

Store.prototype.getUsedPct = function (resource) {
	return this.getUsedCapacity(resource) / this.getCapacity(resource);
};

HIDE_PROPERTY(Store.prototype, 'getUsedPct');

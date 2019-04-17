/** os.core.macros.js */
'use strict';

global.MAKE_CONSTANT = (obj, name, value, enumerable = true) => {
	Object.defineProperty(obj, name, { value, writable: false, configurable: false, enumerable });
};

global.MAKE_CONSTANTS = (obj, mapping, enumerable = true) => {
	const desc = {};
	for (const key in mapping)
		desc[key] = { value: mapping[key], configurable: false, writable: false, enumerable };
	Object.defineProperties(obj, desc);
};

const DEFAULT_AVG_SAMPLES = 100;
global.CM_AVG = (n, p = n, s = DEFAULT_AVG_SAMPLES) => p + (n - p) / s; // Cumulutive moving average.
global.MM_AVG = (n, p = n, s = DEFAULT_AVG_SAMPLES) => ((s - 1) * p + n) / s; // Modified moving average.
global.M_AVG = (n, p = n, s = DEFAULT_AVG_SAMPLES, w = 1) => p + (n / s / w) - (p / s);


global.CLAMP = function (low, value, high) {
	return Math.max(low, Math.min(value, high));
};


global.ENV = (path, defaultValue) => (_.get(Memory.env, path, defaultValue));
global.ENVC = (path, defaultValue, min = 0, max = Infinity) => global.CLAMP(min, global.ENV(path, defaultValue), max);

global.DEFERRED_MODULES = [];
global.DEFER_REQUIRE = (name) => global.DEFERRED_MODULES.push(name);

global.ROOM_LINK = (roomName, shard = Game.shard.name, tag = roomName) => `<a href='#!/room/${shard}/${roomName}'>${tag}</a>`;

global.DEFINE_CACHED_GETTER = function (proto, propertyName, fn, enumerable = false) {
	Object.defineProperty(proto, propertyName, {
		get: function () {
			if (this === proto || this == null)
				return null;
			var result = fn.call(this, this);
			Object.defineProperty(this, propertyName, {
				value: result,
				configurable: true,
				enumerable: false
			});
			return result;
		},
		configurable: true,
		enumerable: enumerable
	});
};

global.DEFINE_GETTER = function (proto, propertyName, fn, enumerable = false) {
	Object.defineProperty(proto, propertyName, {
		get: function () {
			return fn.call(this, this);
		},
		configurable: true,
		enumerable: enumerable
	});
};
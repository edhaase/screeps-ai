/** /os/core/macros.js */
'use strict';

import { CLAMP } from './math';

export const MAKE_CONSTANT = (obj, name, value, enumerable = true) => {
	Object.defineProperty(obj, name, { value, writable: false, configurable: true, enumerable });
};

export const MAKE_CONSTANTS = (obj, mapping, enumerable = true) => {
	const desc = {};
	for (const key in mapping)
		desc[key] = { value: mapping[key], writable: false, configurable: true, enumerable };
	Object.defineProperties(obj, desc);
};

export const ENV = (path, defaultValue) => (_.get(Memory.env, path, defaultValue));
export const ENVC = (path, defaultValue, min = 0, max = Infinity) => CLAMP(min, ENV(path, defaultValue), max);

export const ROOM_LINK = (roomName, shard = Game.shard.name, tag = roomName) => `<a href='#!/room/${shard}/${roomName}'>${tag}</a>`;

export const DEFINE_CACHED_GETTER = function (proto, propertyName, fn, enumerable = false) {
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

export const DEFINE_GETTER = function (proto, propertyName, fn, enumerable = false) {
	Object.defineProperty(proto, propertyName, {
		get: function () {
			return fn.call(this, this);
		},
		configurable: true,
		enumerable: enumerable
	});
};

/**
 * Marks an existing property as non-enumerable
 * 
 * @param {*} proto 
 * @param {*} propertyName 
 */
export const HIDE_PROPERTY = function (proto, propertyName) {
	const desc = Object.getOwnPropertyDescriptor(proto, propertyName);
	desc.enumerable = false;
	return Object.defineProperty(proto, propertyName, desc);
}
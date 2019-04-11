/** os.core.rng.js - random number generation utilities */
'use strict';

/* eslint-disable no-magic-numbers */

/**
 * 
 * @param {*} count 
 * @param {*} min 
 * @param {*} max 
 */
exports.getBytes = function getBytes(count, min = 0, max = 256) {
	const arr = [];
	for (var i = 0; i < count; i++)
		arr.push(_.random(min, max));
	return arr;
};

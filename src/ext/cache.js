/**
 * Cache.js - Now with LRU cache 
 */
'use strict';

/** */
/* global DEFINE_CACHED_GETTER */
const LRU = require('os.ds.lru');
const TTL = 1500;
const MAX = 1500;
const map = new LRU({ ttl: TTL, max: MAX });
const volatile = new WeakMap();

DEFINE_CACHED_GETTER(RoomObject.prototype, 'cache', ro => {
	const key = ro.id || ro.name;
	if (!map.has(key))
		map.set(key, {});
	return map.get(key);
});

DEFINE_CACHED_GETTER(Room.prototype, 'cache', r => {
	const key = r.name;
	if (!map.has(key))
		map.set(key, {});
	return map.get(key);
});

// Weak maps for associated data
DEFINE_CACHED_GETTER(RoomObject.prototype, 'volatile', ro => {
	if (!volatile.has(ro))
		volatile.set(ro, {});
	return volatile.get(ro);
});

DEFINE_CACHED_GETTER(Room.prototype, 'volatile', r => {
	if (!volatile.has(r))
		volatile.set(r, {});
	return volatile.get(r);
});

// module.exports = Cache;
module.exports = map;
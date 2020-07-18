/**
 * Cache.js - Now with LRU cache 
 */
'use strict';

import LRU from '/ds/Lru';

/** */
/* global DEFINE_CACHED_GETTER */
const TTL = CREEP_LIFE_TIME;
const MAX = 5000;
const map = new LRU({ name: 'CreepCache', ttl: TTL, max: MAX });
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

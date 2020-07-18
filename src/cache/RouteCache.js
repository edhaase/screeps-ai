/**
 * RouteCache.js - High level route planning and caching.
 * 
 * @example JSON.stringify(Transport.newPlan('E57S47', 'E58S48'))
 *
 * @todo: room cost per type
 * @todo: consider intel
 * @todo: delegate callback to another object
 */
'use strict';

import { ENV } from '/os/core/macros';
import Route from '/ds/Route';
import { scoreTerrain } from '/Intel';
import DelegatingLazyMap from '/ds/dele/DelegatingLazyMap';
import LRU from '/ds/Lru';
import { Log, LOG_LEVEL } from '/os/core/Log';

const ROUTE_EXPIRATION = ENV('route.cache_expire', 150); // Ticks before a route expires
const ROUTE_CACHE_SIZE = ENV('route.cache_size', 150); // Number of route entries to cache

const TERRAIN_SCORE_MULTIPLIER = 2; // 5 is too significant. 

/**
 * Room conditions:
 *   Newbie walls - complete inaccessible
 *   Allied rooms - inaccessible, attack block, 
 */
export default class RouteCache {
	/**
	 * Help pathfinding by narrowing down which rooms we want to use (or can).
	 * 
	 * @param {string} to - Destination room name
	 * @param {string} from - Origin room name
	 * @param {object} opts - Additional options
	 */
	static findRoute(from, to, opts) {
		/* global Log */
		if (to === from)
			return new Route();	 // if we're not leaving the room, return the same room.			
		const key = JSON.stringify(arguments);
		var result = RouteCache.cache.get(key);
		if (result == null) {
			result = Route.search(from, to, opts);
			RouteCache.cache.set(key, result);
		}
		Log.debug(`Find route for ${from} ${to} ${result}`, 'Route');
		return result;
	}
}

RouteCache.cache = new LRU({ name: 'RouteCache', ttl: ROUTE_EXPIRATION, max: ROUTE_CACHE_SIZE });
RouteCache.terrain = new DelegatingLazyMap(
	(roomName) => scoreTerrain(roomName),
	new LRU({ name: 'RouteTerrainCache', ttl: ROUTE_EXPIRATION, max: ROUTE_CACHE_SIZE })
);
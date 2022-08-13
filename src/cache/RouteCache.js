/**
 * @module
 */
import { ENV } from '/os/core/macros';
import Route from '/ds/Route';
import { scoreTerrain } from '/Intel';
import DelegatingLazyMap from '/ds/dele/DelegatingLazyMap';
import LRU from '/ds/Lru';
import { Log, LOG_LEVEL } from '/os/core/Log';

/**
 * @constant {number} - Time before a route expires
 * @default 150
 */
export const ROUTE_EXPIRATION = ENV('route.cache_expire', 150); //

/**
 * @constant {number} - Number of route entries to cache
 * @default 150
 */
export const ROUTE_CACHE_SIZE = ENV('route.cache_size', 500); // 

const TERRAIN_SCORE_MULTIPLIER = 2; // 5 is too significant. 

/**
 * @class
 * @classdesc High level route planning and caching.
 * @namespace RouteCache
 * 
 * @example JSON.stringify(RouteCache.findRoute('E57S47', 'E58S48'))
 *
 * @todo room cost per type
 * @todo consider intel
 * @todo delegate callback to another object
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
		const start =  Game.cpu.getUsed();
		const key = JSON.stringify(arguments);
		var result = RouteCache.cache.get(key);
		const hit = !!result;
		if (result == null) {
			result = Route.search(from, to, opts);
			RouteCache.cache.set(key, result);
		}
		const delta = Game.cpu.getUsed() - start;
		Log.debug(`Find route for ${from} ${to} ${result} took ${delta} cpu [hit: ${hit}]`, 'Route');
		return result;
	}
}

/**
 * @property {LRU} - The actual cache of entries
 */
RouteCache.cache = new LRU({ name: 'RouteCache', ttl: ROUTE_EXPIRATION, max: ROUTE_CACHE_SIZE });

/**
 * @property {LRU} - Terrain cache of room
 * @todo make a LazyLRU instance
 */
RouteCache.terrain = new DelegatingLazyMap(
	(roomName) => scoreTerrain(roomName),
	new LRU({ name: 'RouteTerrainCache', ttl: ROUTE_EXPIRATION, max: ROUTE_CACHE_SIZE })
);
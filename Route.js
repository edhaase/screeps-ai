/**
 * Route.js - High level route planning and caching.
 * 
 * @example JSON.stringify(Transport.newPlan('E57S47', 'E58S48'))
 *
 * @todo: room cost per type
 * @todo: consider intel
 * @todo: delegate callback to another object
 */
'use strict';

const Intel = require('Intel');
const { LazyMap } = require('DataStructures');
const LRU = require('LRU');

const ROUTE_EXPIRATION = 150;	// Ticks before a route expires
const ROUTE_CACHE_SIZE = 150;			// Number of route entries to cache

const TERRAIN_SCORE_MULTIPLIER = 2; // 5 is too significant. 

function getFindRouteOptions(avoid = [], prefer = []) {
	/**
	 * Return a score for a room. Lower is better.
	 * @param {*} roomName 
	 * @param {*} fromRoom 
	 * @todo Do we take floating point numbers?
	 * @todo Terrain score?
	 */
	return function routeCallback(roomName, fromRoom) {
		var score = 1;
		if (!Game.map.isRoomAvailable(roomName) || avoid.includes(roomName))
			return Infinity;
		const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
		const isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
		const isMyRoom = _.get(Game.rooms, `${roomName}.controller.my`, false);
		if (isHighway || isMyRoom || prefer.includes(roomName))
			score = 1;
		else if (Intel.isHostileRoom(roomName))
			score = 3;
		else if (Intel.hasOwner(roomName))
			score = 2;
		if (Game.rooms[roomName] && Game.rooms[roomName].isOnHighAlert())
			score += 3.0;

		// const terrainScore = Route.terrain.get(roomName);
		// score += Math.floor(TERRAIN_SCORE_MULTIPLIER * (1 - terrainScore));
		Log.debug(`Scoring ${roomName} ${fromRoom} at ${score}`, 'Route');
		return score;
	};
}

/**
 * Room conditions:
 *   Newbie walls - complete inaccessible
 *   Allied rooms - inaccessible, attack block, 
 */
class Route {
	/**
	 * Help pathfinding by narrowing down which rooms we want to use (or can).
	 * 
	 * @param {string} to - Destination room name
	 * @param {string} from - Origin room name
	 * @param {object} opts - Additional options
	 */
	static findRoute(from, to, rs = null) {
		/* global Log */
		if (to === from)
			return [];	 // if we're not leaving the room, return the same room.		
		Log.debug(`Find route for ${from} ${to}`, 'Route');
		const key = JSON.stringify(arguments);
		var result = Route.cache.get(key);
		if (!result) {
			const { avoid, prefer, routeCallback } = (rs || {});
			if (avoid && avoid.includes(to)) {
				Log.warn(`Trying to route to unreachable room ${from} to ${to}`, 'Route');
				return ERR_NO_PATH;
			}
			result = Game.map.findRoute(from, to, rs || { routeCallback: getFindRouteOptions(avoid, prefer) });
			Log.debug(`New route: ${JSON.stringify(result)}`, 'Route');
			Route.cache.set(key, result);
		}
		return result;
	}
}

Route.cache = new LRU({ ttl: ROUTE_EXPIRATION, max: ROUTE_CACHE_SIZE });
Route.terrain = new LazyMap(
	(roomName) => Intel.scoreTerrain(roomName),
	new LRU({ tt: ROUTE_EXPIRATION, max: ROUTE_CACHE_SIZE })
);

module.exports = Route;

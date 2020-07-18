/** /ds/route.js */
'use strict';

import { isHostileRoom, hasOwner } from '/Intel';
import { IS_SAME_ROOM_TYPE } from '/os/core/macros';
import { Log, LOG_LEVEL } from '/os/core/Log';

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
		if (!IS_SAME_ROOM_TYPE(roomName, fromRoom) || avoid.includes(roomName))
			return Infinity;
		const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
		const isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
		const isMyRoom = _.get(Game.rooms, `${roomName}.controller.my`, false);
		if (isHighway || isMyRoom || prefer.includes(roomName))
			score = 1;
		else if (isHostileRoom(roomName))
			score = 3;
		else if (hasOwner(roomName))
			score = 2;
		if (Game.rooms[roomName] && Game.rooms[roomName].isOnHighAlert())
			score += 3.0;

		// const terrainScore = RouteCache.terrain.get(roomName);
		// score += Math.floor(TERRAIN_SCORE_MULTIPLIER * (1 - terrainScore));
		Log.debug(`Scoring ${roomName} ${fromRoom} at ${score}`, 'Route');
		return score;
	};
}

export default class Route extends Array {
	/**
	 * @param {*} fromRoom 
	 * @param {*} toRoom 
	 * @param {*} opts 
	 */
	static search(fromRoom, toRoom, opts) {
		const { avoid, prefer, routeCallback = getFindRouteOptions(avoid, prefer) } = opts || Memory.routing || {};
		if (avoid && avoid.includes(toRoom)) {
			Log.warn(`Trying to route to unreachable room ${fromRoom} to ${toRoom}`, 'Route');
			return ERR_NO_PATH;
		}
		const route = Game.map.findRoute(fromRoom, toRoom, { routeCallback });
		Log.debug(`New route: ${JSON.stringify(route)}`, 'Route');
		if (route === ERR_NO_PATH)
			return ERR_NO_PATH;
		if (route == null)
			return null;
		const shaped = Object.setPrototypeOf(route, this.prototype);
		Object.freeze(shaped); // Freeze it to prevent issues with cached objects getting manipulated.
		return shaped;
	}

	clone() {
		return new this.constructor(...this);
	}

	isAvailable() {
		// return _.all(this, rn => Game.map.isRoomAvailable(rn));
	}

	toString() {
		return `[Route ${this.length}]`;
	}
}
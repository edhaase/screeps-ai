/**
 * Route.js
 *
 * High level route planning and caching.
 * 
 * @TODO: Make scout unit mark RCL 3+ rooms I don't control as 'avoid'. Might screw up attack plan though.
 * @example JSON.stringify(Transport.newPlan('E57S47', 'E58S48'))
 *
 * @todo: room cost per type (block attacks against allies, but not against a 'trusted' player) 
 */
"use strict";

global.DEFAULT_ROUTE_EXPIRATION = 150; // 150 ticks before a route expires 

global.ROUTE_PLAN_GENERIC = 0;
global.ROUTE_PLAN_ATTACK = 1;
global.ROUTE_PLAN_LOGISTICS = 2;

// Memory.rooms[roomName].avoid
class AbstractRouteScore {
	constructor() {

	}

	routeCallback(from, to) {
		throw new Error("Abstract class called");
	}
}

class RouteScore extends AbstractRouteScore {
	constructor(dest) {
		super();
		if (!_.isString(dest))
			throw new TypeError("RouteScore constructor expected destination room name");
		this.dest = dest;
	}

	routeCallback(roomName, fromRoom) {
		// if(Game.map.isRoomProtected(roomName))		
		let score = 2;
		let avoid = _.get(Memory, 'routing.avoid', []);

		if (_.contains(avoid, roomName)) {
			// console.log('room ' + roomName + ' blocked for routing');
			score = Infinity;
		} else if (!Game.map.isRoomAvailable(roomName)) {
			return Infinity;
		} else {
			let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
			let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
			let isMyRoom = _.get(Game.rooms, roomName + '.controller.my', false);
			// abs % 10 avoid room center?	
			if (isHighway || isMyRoom)
				score = 1;
		}

		// avoid rooms under threat?
		if (Game.rooms[roomName] && Game.rooms[roomName].isOnHighAlert())
			score += 3.0;

		// if room is under threat, raise cost to consider avoiding the room
		// consider average terrain type
		return score + Game.map.getRoomLinearDistance(this.dest, roomName);
	}

}

/**
 * Room conditions:
 *   Newbie walls - complete inaccessible
 *   Allied rooms - inaccessible, attack block, 
 */
class Route {
	/**
	 * Used by walk state, high level route plan
	 * with checks for same-room
	 * findRoute('E57S47', 'E59S42')
	 * Route.findRoute('E57S47', 'E54S47')
	 * E58S47,E58S48,E59S48,E60S48,E60S47,E60S46,E60S45,E60S44,E60S43,E60S42,E59S42
	 */
	static findRoute(from, to, rs) {
		let avoid = _.get(Memory, 'routing.avoid', []);
		if (_.contains(avoid, to)) {
			Log.warn('Trying to route to unreachable room ' + from + ' ==> ' + to);
			return ERR_NO_PATH;
		}
		if (from === to) return [from];	 // if we're not leaving the room, return the same room.	
		if (!rs || !rs.routeCallback)
			rs = new RouteScore(to);
		let route = Game.map.findRoute(from, to, { routeCallback: (a, b) => rs.routeCallback(a, b) });
		return (route == ERR_NO_PATH) ? ERR_NO_PATH : _.map(route, 'room');
	}

	// Wrap pathfinder results in lodash chain for AWESOME STUFF.
	static findPath(from, to) {
		let p = ERR_NO_PATH;
		if (p === ERR_NO_PATH)
			return p;
		return _(p);
	}


	// adjustObstacleMatrix(roomPos, )

	/**
	 * Reduce PathFinder.search results into compact list of directions.
	 * @todo May be faster with UIntArray
	 */
	static compact(arr) {
		// Keep first room position		
		var list = [];
		var i = 1;
		for (i = 1; i < arr.length; i++) {
			var a = arr[i - 1];
			var b = arr[i];
			var dir = a.getDirectionTo(b);
			if (a.roomName === b.roomName) // no path on borders
				list.push(dir);
		}
		return list.join("");
	}

	static block(roomName) {
		let avoid = _.get(Memory, 'routing.avoid', []);
		avoid.push(roomName);
		_.set(Memory, 'routing.avoid', avoid);
	}

	/**
	 * Set a room cost
	 */
	static setCost(roomName, cost) {
		_.set(Memory, `rooms.${roomName}.rcost`, cost);
	}

	static getCost(roomName) {
		return _.get(Memory, `rooms.${roomName}.rcost`, 2);
	}
}

module.exports = Route;

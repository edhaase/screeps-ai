/**
 * ext-creep-actor-rts.js
 *
 * RTS-like abilities for creeps
 */
'use strict';

/* global LOGISTICS_MATRIX */

global.serializePath = function (arr) {
	// Keep first room position		
	var list = "";
	var i = 1;
	for (i = 1; i < arr.length; i++) {
		var a = arr[i - 1];
		var b = arr[i];
		var dir = a.getDirectionTo(b);
		if (a.roomName === b.roomName) // no path on borders
			list += dir;
	}
	return list;
};

/**
 * Find the optimal path for this creep to reach it's goal.
 *
 * If we're going to cache pathfinding, this is probably the place.
 * Expensive or not, must be CPU-efficient before we can release. This includes serialization.
 *
 * @todo: Perhaps let the creep set it's own max ops (some may be more expensive?)
 */
Creep.prototype.getPathTo = function (pos, range = 1, opts = {}) {
	/* global Route */
	if (!(pos instanceof RoomPosition))
		throw new TypeError('Expected RoomPosition');

	var result;
	try {
		// Cheap enough to run for same room.
		// var route = Route.findRoute(this.pos.roomName, pos.roomName, { routeCallback: (a, b) => this.routeCallback(a, b) });
		var route = Route.findRoute(this.pos.roomName, pos.roomName);
		if (route === ERR_NO_PATH)
			return ERR_NO_PATH;
		else
			route = _.map(route, 'room');
		// Current room is always pathable.
		route.unshift(this.pos.roomName);
		// @todo: load cost matrix from memory
		result = PathFinder.search(this.pos, ({ pos, range }), {
			plainCost: this.plainSpeed,
			swampCost: this.swampSpeed,
			maxCost: this.ticksToLive,
			roomCallback: r => route.includes(r) ? LOGISTICS_MATRIX.get(r) : false,
			maxOps: 32000,
			maxRooms: opts.maxRooms || PATHFINDER_MAX_ROOMS,
			heuristicWeight: 0.8 + (Math.random() * 1.2)
			// roomCallback: (roomName) => ((opts.avoid || []).includes(roomName))?false:this.getCostMatrix(roomName)
		});
		
		//this.room.visual.poly(_.filter(result.path,'roomName',this.pos.roomName));
		result.route = route;
		var { ops, cost, incomplete } = result;
		Log.debug(`New path for ${this.name}: ops ${ops} cost ${cost} incomplete ${incomplete}`, 'Creep');
	} catch (e) {
		Log.error(`Unable to find path to ${pos}: ${e}`, 'Creep');
		throw e;
	}	
	return result;
};

Creep.prototype.routeCallback = function (roomName, fromRoom) {
	// this.log(`${this.name}: ${roomName} from ${fromRoom}`, Log.LEVEL_INFO);
	// Log.info(`${this.name}: ${roomName} from ${fromRoom}`, 'Creep');
	if (Game.rooms[roomName] && Game.rooms[roomName].my)
		return 1;
	return 2;
};

/**
 * Pure cache based movement - No serialization
 *
 * @param Object goal - pos and optionally range
 *
 * Game.creeps['noop498'].walkTo({pos: new RoomPosition(16,24,'W7N4'), range: 1})
 */
Creep.prototype.walkTo = function (goal, opts) {
	var { dest, walk } = this.cache;
	if (this.fatigue)
		return ERR_TIRED;
	if (goal.range === undefined)
		goal.range = 1;
	if (this.pos.inRangeTo(goal.pos, goal.range))
		return ERR_NO_PATH;
	if (!_.isMatch(goal, dest) || !walk || _.isEmpty(walk.path)
		|| (this.memory.stuck && this.memory.stuck >= 3)) { // If the current goal doesn't match our goal.
		// console.log('Cache miss');
		walk = this.getPathTo(goal.pos, goal.range, opts);
		if (!walk || _.isEmpty(walk.path)) {
			Log.warn(`No path found for ${this.name} at ${this.pos} for goal ${goal.pos}, range: ${goal.range}, route: ${walk.route}`);			
			this.say(UNICODE_ARROWS.ARROW_BARS);
			return ERR_NO_PATH;
		}
		this.say(UNICODE_ARROWS.THREE_RIGHT);
		// console.log('New path');
		walk.path.unshift(this.pos);
		this.cache.walk = walk;
		this.cache.dest = goal;
		this.cache.step = 0;
		this.memory.stuck = 0;
	}
	const result = this.walkByPath(walk.path);
	if (result === ERR_NO_PATH) {
		// console.log('No path');
		delete this.cache.walk;
		delete this.cache.dest;
		delete this.cache.step;
		this.say(UNICODE_ARROWS.ARROW_BARS);
	}
	return result;
};

/**
 * Because the built in _.findIndex usage is terrible.
 */
Creep.prototype.walkByPath = function (path) {
	if (this.fatigue > 0)
		return ERR_TIRED;
	// Maintain last position
	var i = this.cache.step;
	if (i == null || path[i] == null || !this.pos.isEqualTo(path[i])) {
		Log.debug(`${this.name}/${this.pos} has to re-find position in path ${i} ${path[i]}`, 'Creep');
		i = _.findKey(path, p => p.isEqualTo(this.pos));
	}
	if (i < 0 || ++i >= path.length)
		return ERR_NO_PATH;
	this.cache.step = i;
	return this.move(this.pos.getDirectionTo(path[i]));
};

/* Creep.prototype.moveByPath = function(path) {
	if(typeof path === 'string')
		return this.walkByPath(Room.deserializePath(path));
	else
		return this.walkByPath(path);
}; */

// || 1 doesn't work correctly if range is supposed to be 0.
// Otherwise? Mostly works.
Creep.prototype.moveTo = function (goal, opts = {}) {
	if (goal instanceof RoomPosition)
		return this.walkTo({ pos: goal, range: opts.range }, opts);
	else
		return this.walkTo({ pos: goal.pos, range: opts.range }, opts);
};
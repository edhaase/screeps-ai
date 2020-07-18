/**
 * ext/creep/actor.rts.js
 *
 * RTS-like abilities for creeps
 */
'use strict';

import RouteCache from '/cache/RouteCache';
import { LOGISTICS_MATRIX } from '/CostMatrix';
import { ICON_ARROW_BARS, ICON_THREE_RIGHT, ICON_COMPASS } from '/lib/icons';
import { MINIMUM_TTL_TO_BITCH_ABOUT_PATHING_FAILURES } from '/proto/livingentity';
import { DEFAULT_ROAD_SCORE } from '../../ds/costmatrix/RoomCostMatrix';
import { Log, LOG_LEVEL } from '/os/core/Log';

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
RoomObject.prototype.getPathTo = function (pos, range = 1, opts = {}) {
	/* global Route */
	if (!(pos instanceof RoomPosition))
		throw new TypeError('Expected RoomPosition');

	var result;
	try {
		// Cheap enough to run for same room.
		// var route = RouteCache.findRoute(this.pos.roomName, pos.roomName, { routeCallback: (a, b) => this.routeCallback(a, b) });
		if (!opts.roomCallback)
			opts.roomCallback = (r) => LOGISTICS_MATRIX.get(r) || false;
		var route = null;
		if (opts.route !== false) {
			route = RouteCache.findRoute(this.pos.roomName, pos.roomName);
			if (route === ERR_NO_PATH)
				return ERR_NO_PATH;
			else
				route = _.map(route, 'room');
			// Current room is always pathable.
			route.unshift(this.pos.roomName);
			const orc = opts.roomCallback;
			opts.roomCallback = (r) => route.includes(r) ? orc(r) : false;
		}
		const plainCost = opts.plainCost || this.plainSpeed;
		const swampCost = opts.swampCost || this.swampSpeed;
		// These costs only work if road costs 2
		result = PathFinder.search(this.pos, ({ pos, range }), {
			plainCost: (plainCost===2) ? 3 : plainCost, // This is wrong for plainSpeed 2
			swampCost: (swampCost===2) ? 3 : swampCost,
			maxCost: this.ticksToLive,
			roomCallback: opts.roomCallback,
			maxOps: 32000,
			maxRooms: opts.maxRooms || PATHFINDER_MAX_ROOMS,
			heuristicWeight: 0.8 + (Math.random() * 1.2)
		});
		//this.room.visual.poly(_.filter(result.path,'roomName',this.pos.roomName));
		result.route = route;
		var { path, ops, cost, incomplete } = result;
		/* if (opts.repathPerRoom !== false && path && path.length) {
			const [next] = path;
			const index = _.findIndex(path, p => p.roomName !== next/roomName);
			const limit =  (index > -1) ? index : path.length - 1;
			if(limit < path.length - 1) {
				Log.debug(`Repath per room: Next ${next/roomName}, limit ${limit}/${path.length-1}`);
				const rooms = _.map(path, 'roomName');
				Log.debug(`Path: ${rooms}`);
			}
			path.length = limit + 1;
		} */
		if (incomplete && !opts.allowIncomplete) {
			this.room.visual.poly(_.filter(path, 'roomName', this.pos.roomName));
			return ERR_NO_PATH;
		}
		Log.debug(`New path for ${this.name}/${this.pos}: ops ${ops} cost ${cost} incomplete ${incomplete}`, 'Creep');
	} catch (e) {
		Log.error(`Unable to find path to ${pos}: ${e}`, 'Creep');
		throw e;
	}
	return result;
};

RoomObject.prototype.routeCallback = function (roomName, fromRoom) {
	// this.log(`${this.name}: ${roomName} from ${fromRoom}`, LOG_LEVEL.INFO);
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
RoomObject.prototype.walkTo = function (goal, opts) {
	var { dest, walk } = this.cache;
	if (this.fatigue)
		return ERR_TIRED;
	if (goal.range === undefined)
		goal.range = 1;
	if (this.pos.inRangeTo(goal.pos, goal.range))
		return ERR_NO_PATH;
	if (!dest || !walk || dest.range !== goal.range || !goal.pos.isEqualToPlain(dest.pos) || _.isEmpty(walk.path)
		|| (this.memory.stuck && this.memory.stuck >= 3)) { // If the current goal doesn't match our goal.
		// console.log('Cache miss');
		walk = this.getPathTo(goal.pos, goal.range, opts);
		if (!walk || _.isEmpty(walk.path)) {
			if (this.ticksToLive > MINIMUM_TTL_TO_BITCH_ABOUT_PATHING_FAILURES)
				Log.warn(`No path found for ${this.name} at ${this.pos} for goal ${goal.pos}, range: ${goal.range}, route: ${walk.route}, ttl: ${this.ticksToLive}`, 'LivingEntity');
			this.say(ICON_ARROW_BARS);
			return ERR_NO_PATH;
		}
		this.say(ICON_THREE_RIGHT);
		// console.log('New path');
		walk.path.unshift(this.pos);
		this.cache.walk = walk;
		this.cache.dest = goal;
		this.cache.step = 0;
		// this.memory.stuck = 0; // Don't reset or we can get a 4-way-stop jamup
	}
	const result = this.walkByPath(walk.path);
	if (result === ERR_NO_PATH) {
		// console.log('No path');
		delete this.cache.walk;
		delete this.cache.dest;
		delete this.cache.step;
		this.say(ICON_ARROW_BARS);
	}
	return result;
};

/**
 * Because the built in _.findIndex usage is terrible.
 */
RoomObject.prototype.walkByPath = function (path) {
	if (this.fatigue > 0)
		return ERR_TIRED;
	// Maintain last position
	var i = this.cache.step;
	if (i == null || path[i] == null || !this.pos.isEqualTo(path[i])) {
		Log.debug(`${this.name}/${this.pos} has to re-find position in path ${i} ${path[i]}`, 'Creep');
		i = _.findKey(path, p => p.isEqualTo(this.pos));
	}
	if (isNaN(i) || i == null || i < 0 || ++i >= path.length)
		return ERR_NO_PATH;
	this.cache.step = i;
	try {
		return this.move(this.pos.getDirectionTo(path[i]));
	} catch (e) {
		const dir = this.pos.getDirectionTo(path[i]);
		Log.error(`${this.name}/${this.pos} move error ${this.pos} --> ${path[i]} (${dir}) (i: ${i})`);
		throw e;
	}
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

/**
 * 
 */
Creep.prototype.runPullee = function (opts = {}) {
	if (this.fatigue)
		return; // Wait
	const { dest, engine, range = 1 } = opts;
	const pos = new RoomPosition(dest.x, dest.y, dest.roomName);
	if (this.pos.inRangeTo(pos, range)) {
		this.popState();
		return;
	}
	const creep = Game.creeps[engine];
	if (!creep || creep.getState() !== 'Puller')
		this.popState();
	if (this.pos.isNearTo(creep)) {
		return this.move(this.pos.getDirectionTo(creep));
	} else if (this.hasActiveBodypart(MOVE)) {
		this.moveTo(pos, { range });
	}
};

Creep.prototype.runPuller = function (opts = {}) {
	if (this.fatigue)
		return; // Wait
	const { dest, cargo, range = 1 } = opts;
	const pos = new RoomPosition(dest.x, dest.y, dest.roomName);
	const creep = Game.creeps[cargo];
	if (!creep) {
		this.popState();
		return;
	}

	this.pull(creep);
	var status = OK;
	if (this.pos.inRangeTo(pos, range)) {
		this.move(this.pos.getDirectionTo(creep)); // Swap with the creep and exit state	
		this.popState(false);
		return;
	} else if (this.pos.isOnRoomBorder()) {
		if (this.pos.isNearTo(creep))
			this.move(this.pos.getDirectionTo(creep));
		else
			status = this.moveTo(pos, { range });
	} else if (!this.pos.isNearTo(creep)) { // If we're not near the creep, move to the creep
		status = this.moveTo(creep, { range: 1 });
	} else {
		status = this.moveTo(pos, { range });
	}

	if (status === ERR_NO_PATH) {
		if (opts.failed == null)
			opts.failed = 0;
		if (opts.failed++ < 5)
			return;
		Log.warn(`${this.name}/${this.pos} failed pulling ${creep} (ttl: ${this.ticksToLive})`, 'LivingEntity');
		this.popState(false);
	}
};
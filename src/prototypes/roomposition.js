/**
 *
 */
'use strict';

/* global DEFINE_CACHED_GETTER */

import { STATIC_OBSTACLE_MATRIX } from '/cache/costmatrix/StaticObstacleMatrixCache';
import { VisibilityError } from '/os/core/errors';
import { isObstacle } from '/lib/filter';
import { in_numeric_range } from '/lib/util';
import EnclosureTestingMatrix from '/ds/costmatrix/EnclosureTestingMatrix';
import { DEFAULT_ROAD_SCORE } from '../ds/costmatrix/RoomCostMatrix';
import { Log, LOG_LEVEL } from '/os/core/Log';
import Path from '/ds/Path';

DEFINE_CACHED_GETTER(RoomPosition.prototype, 'room', rp => Game.rooms[rp.roomName]);

/**
 * Because isEqualTo expects a room position and that doesn't
 * really make sense. Changing the behavior of that might be worse.
 *
 * @param {RoomPosition} pos
 * @return bool
 */
RoomPosition.prototype.isEqualToPlain = function ({ x, y, roomName } = {}) {
	return this.x === x && this.y === y && this.roomName === roomName;
};

/**
 * @param {number} x
 * @param {number} y
 * @param {string} roomName
 * @return bool
 */
RoomPosition.prototype.isEqualToPlainXY = function (x, y, roomName) {
	return this.x === x && this.y === y && this.roomName === roomName;
};

/**
 * Adjacent points
 */
RoomPosition.prototype.getAdjacentPoints = function () {
	var { x, y, roomName } = this;
	var points = _.map(DIR_TABLE, ([dx, dy]) => new RoomPosition(x + dx, y + dy, roomName));
	return _.filter(points, p => p.isValid());
};

RoomPosition.prototype.isValid = function () {
	var { x, y } = this;
	return x >= 0 && x <= 49 && y >= 0 && y <= 49;
};

/**
 * inRangeTo micro-optimizations
 * @todo fix
 */
RoomPosition.prototype.inRangeTo = function (a, b, c) {
	if (c === undefined) {
		if (a.pos !== undefined)
			return this.inRangeToPos(a.pos, b);
		else
			return this.inRangeToPos(a, b);
	}
	return this.inRangeToXY(a, b, c);
};

/**
 * Per the API this just doesn't even consider rooms
 */
RoomPosition.prototype.inRangeToXY = function (x, y, range) {
	return Math.abs(x - this.x) <= range && Math.abs(y - this.y) <= range;
};

RoomPosition.prototype.inRangeToPos = function (pos, range) {
	return Math.abs(pos.x - this.x) <= range && Math.abs(pos.y - this.y) <= range && pos.roomName === this.roomName;
};

/**
 * findClosestByRange micro-optimizations
 * @todo replace with our min version with early-stop
 */
RoomPosition.prototype.findClosestByRange = function (ft, opts) {
	const room = Game.rooms[this.roomName];
	if (room == null) {
		throw new VisibilityError(this.roomName);
	}
	if (typeof ft === 'number')
		return this.findClosestByRange(room.find(ft, opts));
	else if (Array.isArray(ft)) {
		if (opts && opts.filter)
			ft = _.filter(ft, opts.filter);
		// ft = ft.filter(opts.filter);
		if (ft.length > 0)
			return _.min(ft, f => this.getRangeTo(f));
	}
	return null;
};

RoomPosition.prototype.addDirection = function (dir) {
	var [dx, dy] = DIR_TABLE[dir];
	var { x, y, roomName } = this;
	return new RoomPosition(x + dx, y + dy, roomName);
};

RoomPosition.prototype.getRangeToPlain = function ({ x, y, roomName }) {
	return this.getRangeTo(new RoomPosition(x, y, roomName));
};

RoomPosition.prototype.findFirstInRange = function (a, range, filter = _.identity) {
	if (a == null || range == null)
		return ERR_INVALID_ARGS;
	if (Game.rooms[this.roomName] == null)
		return ERR_NOT_FOUND;
	const results = Game.rooms[this.roomName].find(a);
	return _.find(results, x => this.getRangeTo(x) <= range && filter(x));
};

/**
 * Enclosure testing - Test if a position is enclosed by protective structures,
 * or reachable from an exit tile. VERY HIGH CPU.
 * 
 * Ex: Time.measure( () => Game.getObjectById('5819e4a890f301c3709ad5fe').pos.isEnclosed() )
 * about .5 - 4 cpu
 */
RoomPosition.prototype.isEnclosed = function () {
	const room = Game.rooms[this.roomName];
	const exits = room.find(FIND_EXIT);
	const goals = _.map(exits, e => ({ pos: e, range: 0 }));
	const opts = {
		plainCost: 1,
		swampCost: 1,
		maxRooms: 1,
		maxCost: CREEP_LIFE_TIME,
		roomCallback: (r) => {
			if (r !== this.roomName)
				return false;
			return new EnclosureTestingMatrix(r);
		}
	};
	const result = this.search(goals, opts);
	/* if(result.path)
		delete result.path;
	console.log('isEnclosed: '+ JSON.stringify(result)); */
	return result.incomplete;
};

RoomPosition.prototype.search = function (goals, opts) {
	return Path.search(this, goals, opts);
};

/**
 * Check if a room position is on the border to the room,
 * so we can prevent stupid mistakes like getting tricked out of the room.
 */
RoomPosition.prototype.isOnRoomBorder = function () {
	return (this.x <= 0 || this.x >= 49 || this.y <= 0 || this.y >= 49);
};

/**
 * Tile inspection methods
 */
RoomPosition.prototype.getCreep = function (range = 0, validator = () => true) {
	if (range === 0)
		return _.find(this.lookFor(LOOK_CREEPS), validator);
	else
		return this.room.findOne(FIND_CREEPS, { filter: c => c.pos.inRangeTo(this, range) && validator(c) });
};

RoomPosition.prototype.getLivingEntity = function (range = 0, validator = () => true) {
	if (range === 0) {
		const creep = _.find(this.lookFor(LOOK_CREEPS), validator);
		const powerCreep = _.find(this.lookFor(LOOK_POWER_CREEPS), validator);
		return creep || powerCreep;
	} else {
		const creep = this.room.findOne(FIND_CREEPS, { filter: c => c.pos.inRangeTo(this, range) && validator(c) });
		const powerCreep = this.room.findOne(FIND_POWER_CREEPS, { filter: c => c.pos.inRangeTo(this, range) && validator(c) });
		return creep || powerCreep;
	}
};

/**
 * Check for a structure.
 */
RoomPosition.prototype.getStructure = function (structureType, maxRange = 0, minRange = 0, validator = () => true) {
	if (maxRange === 0)
		return _.find(this.lookFor(LOOK_STRUCTURES), s => s.structureType === structureType && validator(s));
	else
		return this.room.findOne(FIND_STRUCTURES, { filter: s => s.structureType === structureType && in_numeric_range(minRange, s.pos.getRangeTo(this), maxRange) && validator(s) });
};

RoomPosition.prototype.getStructures = function () {
	return this.lookFor(LOOK_STRUCTURES);
};

RoomPosition.prototype.hasStructure = function (structureType, range = 0, minRange = 0, validator = () => true) {
	return this.getStructure(structureType, range, minRange, validator) != null;
};

RoomPosition.prototype.hasRampart = function (fn) {
	return this.hasStructure(STRUCTURE_RAMPART, 0, 0, fn);
};

RoomPosition.prototype.hasWithdrawAccess = function () {
	const rampart = this.getStructure(STRUCTURE_RAMPART);
	if (!rampart)
		return true;
	return rampart.my || rampart.isPublic;
}

RoomPosition.prototype.getConstructionSite = function (structureType = null, range = 0, validator = () => true) {
	if (range === 0) {
		return _.find(this.lookFor(LOOK_CONSTRUCTION_SITES), c => (structureType == null || c.structureType === structureType) && validator(c));
	} else {
		return this.room.findOne(FIND_MY_CONSTRUCTION_SITES, { filter: s => (structureType == null || s.structureType === structureType) && s.pos.inRangeTo(this, range) && validator(s) });
	}
};

RoomPosition.prototype.hasConstructionSite = function (structureType, range = 0, validator = () => true) {
	return this.getConstructionSite(structureType, range, validator) != null;
};

RoomPosition.prototype.hasObstacle = function (includeTerrain = true) {
	return _.any(this.lookFor(LOOK_STRUCTURES), isObstacle)
		|| _.any(this.lookFor(LOOK_CONSTRUCTION_SITES), isObstacle)
		|| (includeTerrain && (Game.map.getRoomTerrain(this.roomName).get(this.x, this.y) & TERRAIN_MASK_WALL));
};

RoomPosition.prototype.hasCreep = function () {
	return !_.isEmpty(this.lookFor(LOOK_CREEPS));
};

RoomPosition.prototype.getFlag = function (color, secondaryColor) {
	return _.find(this.lookFor(LOOK_FLAGS), f => f.color === color && f.secondaryColor === secondaryColor);
};

RoomPosition.prototype.hasFlag = function (color, secondaryColor) {
	return !!this.getFlag(color, secondaryColor);
}

/**
 * Is open for building.
 */
RoomPosition.prototype.isOpen = function () {
	return this.isValid()
		&& !this.hasObstacle(true)
		&& !this.isOnRoomBorder();
};

RoomPosition.prototype.getOpenNeighbor = function () {
	return _.find(this.getAdjacentPoints(), p => p.isOpen());
};

RoomPosition.prototype.getOpenNeighbors = function () {
	return _.filter(this.getAdjacentPoints(), p => p.isOpen());
};

RoomPosition.prototype.getOpenNeighborDiagonal = function () {
	var points = _.map(DIAGONALS, (d) => this.addDirection(d));
	return _.find(points, p => p.isOpen());
};

RoomPosition.prototype.getOpenNeighborHorizontal = function () {
	var points = _.map(HORIZONTALS, (d) => this.addDirection(d));
	return _.find(points, p => p.isOpen());
};

/**
 * High-cpu (but _accurate_) step count to destination.
 */
RoomPosition.prototype.getStepsTo = function (dest, opts = {}) {
	if (!dest)
		throw new TypeError('Expected destination');
	opts = _.defaults(opts, {
		plainCost: DEFAULT_ROAD_SCORE + 1,
		swampCost: 5
	});
	if (!opts.roomCallback)
		opts.roomCallback = r => STATIC_OBSTACLE_MATRIX.get(r) || new PathFinder.CostMatrix;
	try {
		const { path, incomplete } = Path.search(this, dest, opts);
		if (incomplete)
			return ERR_NO_PATH;
		return path.length;
	} catch (e) {
		Log.error(`getStepsTo failed on: ${JSON.stringify(dest)}`);
		Log.error(e.stack);
		throw e;
	}
};

/**
 * Since findClosestByPath is a limited to a single room, we have this.
 *
 * @param {Object} goals - collection of RoomPositions or targets
 * @param {function} itr - iteratee function, called per goal object
 * @todo Add cost matrix support
 * @todo Add maxCost support
 * @todo replace with roomCallback
 * @todo maxCost testing
 * @todo allow routing
 */
RoomPosition.prototype.findClosestByPathFinder = function (goals, itr = ({ pos }) => ({ pos, range: 1 }), opts = {}) {
	// Map goals to position/range values
	const mapping = [];
	for (const g of Object.values(goals)) {
		const itm = itr(g);
		// Return early if we can
		if (this.getRangeTo(itm.pos) <= itm.range) {
			Log.debug(`FCBPF returned early with goal ${g}/${itm.pos} for ${this} range ${itm.range}`, 'RoomPosition');
			return { goal: g, cost: 0, ops: 0, incomplete: false, path: [] };
		}
		mapping.push(itm);
	}
	// const mapping = _.map(goals, itr);
	if (_.isEmpty(mapping))
		return { goal: null };
	_.defaults(opts, {
		maxOps: 32000,
		plainCost: 2,
		swampCost: 10,
		maxRooms: 64,
		roomCallback: r => STATIC_OBSTACLE_MATRIX.get(r) || new PathFinder.CostMatrix
	});
	const result = Path.search(this, mapping, opts);
	if (!result.path || !result.path.length) {
		Log.warn(`findClosestByPathFinder was unable to find a solution originating from ${this}`, 'RoomPosition');
	}
	if (!result.path || (result.incomplete && opts.maxCost))
		return { goal: null, cost: result.cost, ops: result.ops, incomplete: true, path: [] };
	//	throw new Error('Path incomplete');
	const last = _.last(result.path) || this;
	// return {goal: null};
	const goal = _.min(goals, g => last.getRangeTo(g.pos || g));
	return {
		goal: (Math.abs(goal) !== Infinity) ? goal : null,
		cost: result.cost,
		ops: result.ops,
		incomplete: result.incomplete,
		path: (opts.noPath) ? [] : result.path
	};
};

RoomPosition.prototype.getAverageRange = function (points) {
	return _.sum(points, p => this.getRangeTo(p)) / points.length;
};

/**
 * Shortcut to findClosestByPathFinder.
 */
RoomPosition.prototype.getClosest = function (collection, filter = _.identity, range = 1) {
	var candidates = _.filter(collection, filter);
	return this.findClosestByPathFinder(candidates, ({ pos }) => ({ pos, range }));
};

RoomPosition.prototype.findClosestConstructionSite = function () {
	return this.findClosestByPathFinder(Game.constructionSites,
		(cs) => ({ pos: cs.pos, range: CREEP_BUILD_RANGE })).goal;
};

RoomPosition.prototype.findClosestStructureType = function (structureType, range = 1, filter = _.identity) {
	const candidates = _.filter(Game.structures, s => s.structureType === structureType && filter(s));
	return this.findClosestByPathFinder(candidates, s => ({ pos: s.pos, range })).goal;
};

RoomPosition.prototype.findClosestSpawn = function () {
	const spawns = _.reject(Game.spawns, s => s.isDefunct());
	return this.findClosestByPathFinder(spawns, (spawn) => ({ pos: spawn.pos, range: 1 })).goal;
};

RoomPosition.prototype.findClosestTerminal = function (mustBeActive = true, range = 1) {
	if (mustBeActive)
		return this.findClosestStructureType(STRUCTURE_TERMINAL, range, s => s.isActive());
	else
		return this.findClosestStructureType(STRUCTURE_TERMINAL, range);
	// const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL && s.isActive());
	// return this.findClosestByPathFinder(terminals, s => ({ pos: s.pos, range: 1 })).goal;
};

RoomPosition.prototype.findClosestCreep = function () {
	return this.findClosestByPathFinder(Game.creeps,
		(c) => ({ pos: c.pos, range: 1 })).goal;
};

RoomPosition.prototype.findPositionNear = function (otherPos, range = 1, opts = {}, offset = 2) {
	if (!opts.roomCallback)
		opts.roomCallback = (r) => STATIC_OBSTACLE_MATRIX.get(r) || new PathFinder.CostMatrix;
	const { path, incomplete } = Path.search(this, { pos: otherPos, range }, opts);
	if (incomplete)
		throw new Error('Unable to find path');
	return path[path.length - offset];
};
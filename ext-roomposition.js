/**
 *
 */
'use strict';

/* global DEFINE_CACHED_GETTER */

const { VisibilityError } = require('Error');

DEFINE_CACHED_GETTER(RoomPosition.prototype, 'room', rp => Game.rooms[rp.roomName]);

/**
 * Because isEqualTo expects a room position and that doesn't
 * really make sense. Changing the behavior of that might be worse.
 *
 * @param RoomPosition pos
 * @return bool
 */
RoomPosition.prototype.isEqualToPlain = function ({ x, y, roomName } = {}) {
	return this.x === x && this.y === y && this.roomName === roomName;
};

/**
 * @param number x
 * @param number y
 * @param string roomName
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

RoomPosition.prototype.inRangeToXY = function (x, y, range) {
	return Math.abs(x - this.x) <= range && Math.abs(y - this.y) <= range && roomName === this.roomName;
};

RoomPosition.prototype.inRangeToPos = function (pos, range) {
	return Math.abs(pos.x - this.x) <= range && Math.abs(pos.y - this.y) <= range && pos.roomName === this.roomName;
};

/**
 * findClosestByRange micro-optimizations
 */
RoomPosition.prototype.findClosestByRange = function (ft, opts) {
	var room = Game.rooms[this.roomName];
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

// Game.getObjectById('581fb1807e33108a198eee33').pos.findFirstInRange(FIND_DROPPED_RESOURCES, 3)
// because find in range finds all
RoomPosition.prototype.firstInRange = function (a, range, opts) {
	if (a == null || range == null)
		return ERR_INVALID_ARGS;
	if (Game.rooms[this.roomName] == null)
		return ERR_NOT_FOUND;
	const results = Game.rooms[this.roomName].find(a, opts);
	return _.find(results, x => this.getRangeTo(x) <= range);
};

RoomPosition.prototype.getRangeToPlain = function ({ x, y, roomName }) {
	return this.getRangeTo(new RoomPosition(x, y, roomName));
};

RoomPosition.prototype.findFirstInRange = function (a, range, filter = _.Identity) {
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
	var room = Game.rooms[this.roomName];
	var exits = room.find(FIND_EXIT);
	var opts = {
		plainCost: 1,
		swampCost: 1,
		maxRooms: 1,
		maxCost: CREEP_LIFE_TIME,
		roomCallback: function (r) {
			const cm = new PathFinder.CostMatrix;
			_(room.find(FIND_STRUCTURES))
				// .filter(i => i.structureType === STRUCTURE_RAMPART || i.structureType === STRUCTURE_WALL)
				.filter(i => i instanceof StructureRampart || i instanceof StructureWall)
				.each(s => cm.set(s.pos.x, s.pos.y, 255)).commit();
			return cm;
		}
	};
	var result = this.search(
		_.map(exits, e => ({ pos: e, range: 0 })),
		opts
	);
	/* if(result.path)
		delete result.path;
	console.log('isEnclosed: '+ JSON.stringify(result)); */
	return result.incomplete;
};

RoomPosition.prototype.search = function (goals, opts) {
	return PathFinder.search(this, goals, opts);
};

/**
 * Check if a room position is on the border to the room,
 * so we can prevent stupid mistakes like getting tricked out of the room.
 */
RoomPosition.prototype.isOnRoomBorder = function () {
	return (this.x <= 0 || this.x >= 49 || this.y <= 0 || this.y >= 49);
};

RoomPosition.prototype.getCreep = function (range = 0, validator = () => true) {
	if (range === 0)
		return _.find(this.lookFor(LOOK_CREEPS), validator);
	else
		return this.room.findOne(FIND_CREEPS, { filter: c => c.pos.inRangeTo(this, range) && validator(c) });
};

/**
 * Check for a structure.
 */
RoomPosition.prototype.getStructure = function (structureType, range = 0, validator = () => true) {
	if (range === 0)
		return _.find(this.lookFor(LOOK_STRUCTURES), s => s.structureType === structureType && validator(s));
	else
		return this.room.findOne(FIND_STRUCTURES, { filter: s => s.structureType === structureType && s.pos.inRangeTo(this, range) && validator(s) });
};

RoomPosition.prototype.getStructures = function () {
	return this.lookFor(LOOK_STRUCTURES);
};

RoomPosition.prototype.hasStructure = function (structureType, range = 0, validator = () => true) {
	return this.getStructure(structureType, range, validator) != null;
};

RoomPosition.prototype.hasRampart = function (fn) {
	return this.hasStructure(STRUCTURE_RAMPART, fn);
};

RoomPosition.prototype.hasRoad = function () {
	return this.hasStructure(STRUCTURE_ROAD);
};

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
	return _.any(this.lookFor(LOOK_STRUCTURES), require('Filter').isObstacle)
		|| _.any(this.lookFor(LOOK_CONSTRUCTION_SITES), require('Filter').isObstacle)
		|| (includeTerrain && (Game.map.getRoomTerrain(this.roomName).get(this.x, this.y) & TERRAIN_MASK_WALL));
};

RoomPosition.prototype.hasCreep = function () {
	return !_.isEmpty(this.lookFor(LOOK_CREEPS));
};

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
		plainCost: 2,
		swampCost: 5
	});
	if (!opts.roomCallback)
		opts.roomCallback = r => FIXED_OBSTACLE_MATRIX.get(r);
	try {
		const { path, incomplete } = PathFinder.search(this, dest, opts);
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
 * @todo: Add cost matrix support
 * @todo: Add maxCost support
 * @todo: replace with roomCallback
 * @todo: maxCost testing
 */
RoomPosition.prototype.findClosestByPathFinder = function (goals, itr = _.identity, opts = {}) {
	const mapping = _.map(goals, itr);
	if (_.isEmpty(mapping))
		return { goal: null };
	_.defaults(opts, {
		maxOps: 16000,
		plainCost: 2,
		swampCost: 10,
		roomCallback: r => FIXED_OBSTACLE_MATRIX.get(r)
	});
	const result = PathFinder.search(this, mapping, opts);
	if (!result.path.length) {
		Log.error('findClosestByPathFinder was unable to find a solution');
		Log.error(ex(mapping));
		Log.error(ex(opts));
		Log.error(ex(result));
	}
	// if(result.incomplete)
	//	throw new Error('Path incomplete');
	const last = _.last(result.path) || this;
	// return {goal: null};
	const goal = _.min(goals, g => last.getRangeTo(g.pos));
	return {
		goal: (Math.abs(goal) !== Infinity) ? goal : null,
		cost: result.cost,
		ops: result.ops,
		incomplete: result.incomplete,
		path: result.path
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

RoomPosition.prototype.findClosestSpawn = function () {
	const spawns = _.reject(Game.spawns, s => s.isDefunct());
	return this.findClosestByPathFinder(spawns, (spawn) => ({ pos: spawn.pos, range: 1 })).goal;
};

RoomPosition.prototype.findClosestConstructionSite = function () {
	return this.findClosestByPathFinder(Game.constructionSites,
		(cs) => ({ pos: cs.pos, range: CREEP_BUILD_RANGE })).goal;
};

RoomPosition.prototype.findClosestStorage = function () {
	const storages = _.filter(Game.structures, 'structureType', STRUCTURE_STORAGE);
	return this.findClosestByPathFinder(storages, s => ({ pos: s.pos, range: 1 })).goal;
};

RoomPosition.prototype.findClosestCreep = function () {
	return this.findClosestByPathFinder(Game.creeps,
		(c) => ({ pos: c.pos, range: 1 })).goal;
};

RoomPosition.prototype.findPositionNear = function (otherPos, range = 1, opts = {}, offset = 2) {
	if (!opts.roomCallback)
		opts.roomCallback = (r) => FIXED_OBSTACLE_MATRIX.get(r);
	const { path, incomplete } = PathFinder.search(this, { pos: otherPos, range }, opts);
	if (incomplete)
		throw new Error('Unable to find path');
	return path[path.length - offset];
};
/**
 * ext.structure.observer.js
 */
'use strict';

/* global DEFINE_MEMORY_BACKED_PROPERTY */

DEFINE_MEMORY_BACKED_PROPERTY(StructureObserver.prototype, 'lastRoom', { key: 'last' });

global.COORD_TO_ROOM_NAME = function (wx, wy) {
	var result = "";
	result += (wx < 0 ? "W" + String(~wx) : "E" + String(wx));
	result += (wy < 0 ? "N" + String(~wy) : "S" + String(wy));
	return result;
};

global.ROOM_NAME_TO_COORD = function (roomName) {
	var [, h, wx, v, wy] = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/);
	wx = parseInt(wx);
	wy = parseInt(wy);
	if (h === 'W') wx = ~wx;
	if (v === 'N') wy = ~wy;
	return [wx, wy];
};

//  The question isn't so much what can I do with the observer, but what's best to do with it.
//  I can implement pursuit mode to track hostiles,
//  I can stalk a room,
//  I can track the economy around me,
//  track hostile and allied construction progress,
//  tell when they're under attack,
//  launch intercept missions against creeps on the highway,
//  find power banks,
//  help a creep find thing in an adjacent room, etc
// eval command queue with room visibility
global.OBSERVER_MODE_RADAR = 1;
global.OBSERVER_MODE_WATCH = 2;

global.BIT_OBSERVER_UPDATE_CM = (1 << 1);
global.BIT_OBSERVER_MARK_TARGETS = (1 << 2);

const Intel = require('Intel');

/**
 * Observer run method, called by each observer every tick.
 *
 * Modes of operation: Radar, Watch, Stored program, Pursuit
 * If idle defaults to radar sweep.
 */
StructureObserver.prototype.run = function () {
	if (CPU_LIMITER || this.isDeferred() || !this.isActive())
		return;

	const { memory } = this;
	const prevTickRoomName = this.lastRoom;
	const prevRoom = Game.rooms[prevTickRoomName];
	this.lastRoom = undefined; // clear early, in case we set it later

	if (prevRoom) {
		Intel.scanRoom(prevRoom);
		Intel.markCandidateForRemoteMining(prevRoom);
	}

	if  (this.memory.roomName) {	// OS override
		this.observeRoom(this.memory.roomName);
		delete this.memory.roomName;
	}

	if (memory.mode === OBSERVER_MODE_WATCH) {
		this.watch();
		return;
	}

	this.sweep();
};

/**
 * Get this observer's room position in the world
 * (Not it's fine-grained world position, just room coordinates)
 * This is here so we can find rooms in range.
 */
StructureObserver.prototype.getRoomCoordinates = function () {
	if (!this.memory.coord)
		this.memory.coord = ROOM_NAME_TO_COORD(this.pos.roomName);
	return this.memory.coord;
};

// W8N3,W7N3,W6N3,W8N2,W7N2,W6N2,W8N1,W7N1,W6N1
/**
 * Cpu-efficent calls to find observer's range
 */
// const INTEL_RANGE = OBSERVER_RANGE; //2; // 121 at half dist, 441 rooms

StructureObserver.prototype.getTopLeftCoords = function () {
	var [rx, ry] = this.getRoomCoordinates();
	var range = this.getRange();
	return [rx - range, ry - range];
};

StructureObserver.prototype.getTopLeftRoomName = function () {
	var [rx, ry] = this.getTopLeftCoords();
	return COORD_TO_ROOM_NAME(rx, ry);
};

StructureObserver.prototype.getBottomRightCoords = function () {
	var [rx, ry] = this.getRoomCoordinates();
	var range = this.getRange();
	return [rx + range, ry + range];
};

StructureObserver.prototype.getBottomRightRoomName = function () {
	var [rx, ry] = this.getBottomRightCoords();
	return COORD_TO_ROOM_NAME(rx, ry);
};

/**
 * Cpu-efficient calculation of room names in range.
 * Roughly 1 cpu without caching.
 * W12N7 to W2S2
 * goid('b56773695470608').getRoomsInRange().includes('W9N1')
 */
StructureObserver.prototype.getRoomsInRange = function () {
	if (this.cache.rooms)
		return this.cache.rooms;
	var [left, top] = this.getTopLeftCoords();
	var [right, bottom] = this.getBottomRightCoords();
	var x, y, roomName;
	var rooms = [];
	for (y = top; y <= bottom; y++) {
		for (x = left; x <= right; x++) {
			roomName = COORD_TO_ROOM_NAME(x, y);
			rooms.push(roomName);
		}
	}
	this.cache.rooms = rooms;
	return rooms;
};

/**
 *
 */
StructureObserver.prototype.getRange = function () {
	if (this.memory && this.memory.range)
		return Math.min(this.memory.range, OBSERVER_RANGE);
	return OBSERVER_RANGE;
};

/**
 *
 */
StructureObserver.prototype.setRange = function (range) {
	if (!_.isNumber(range))
		throw new TypeError("Invalid type");
	if (range > OBSERVER_RANGE)
		throw new RangeError("Range may not exceed OBSERVER_RANGE");
	if (range < 1)
		throw new RangeError("Range may not be less than 1");
	delete this.cache.rooms;
	delete this.cache.avail;
	return (this.memory.range = range);
};

/**
 * Filter the rooms in range for real rooms and rooms we don't own.
 */
StructureObserver.prototype.getAvailRoomsInRange = function () {
	if (!this.cache.avail)
		this.cache.avail = _.filter(this.getRoomsInRange(), rn => this.isValidObservationTarget(rn));
	return this.cache.avail;
};

/**
 * Checks
 */
StructureObserver.prototype.isValidObservationTarget = function (roomName) {
	if (Game.rooms[roomName] && Game.rooms[roomName].my)
		return false;
	const roomStatus = Game.map.getRoomStatus(roomName);
	return roomStatus && roomStatus.status !== 'closed';
};

StructureObserver.prototype.isInRange = function (roomName) {
	return Game.map.getRoomLinearDistance(this.pos.roomName, roomName, false) <= this.getRange();
};

/**
 * Execute a command in a room we don't yet have visibility on.
 * Works by converting the function to a string and rebuilding it with eval.
 *
 * @param {string} roomName - Room to observe
 * @param {Function} fn - Function to execute, takes one argument (room name)
 *
 * observer.exec('E57S49', (room) => room.find(FIND_SOURCES));
 */
StructureObserver.prototype.exec = function (roomName, fn = () => 1) {
	const status = this.observeRoom(roomName);
	if (status === OK)
		this.memory.cmd = fn.toString();
	return status;
};

StructureObserver.prototype.watch = function () {
	const { watch } = this.memory;
	if (!watch)
		return;

	/* if(Array.isArray(watch)) {
		watch = watch[Game.time % watch.length];
	} */

	if (Game.rooms[watch] && _.get(Game.rooms[watch], 'controller.my', false) === true) {
		Log.info(`Already have visibility in ${watch}. Ending watch operations.`, 'Observer');
		this.memory.watch = undefined;
		return;
	}

	if (!(Game.time % 250))
		Log.info(`Observer at ${this.pos} watching room ${watch}`, 'Observer');

	this.observeRoom(watch);
};

// Game.getObjectById('57e1ff70294823be1c0623f6')
StructureObserver.prototype.sweep = function () {
	var rooms = this.getAvailRoomsInRange();
	var room = rooms[Game.time % rooms.length];
	this.observeRoom(room);
};

const { observeRoom } = StructureObserver.prototype;
StructureObserver.prototype.observeRoom = function (roomName) {
	if (this.isBusy)
		return ERR_BUSY;

	const status = observeRoom.apply(this, arguments);
	if (status === OK) {
		this.isBusy = true;
		this.lastRoom = roomName;
		this.room.visual.text(roomName, this.pos, {
			color: 'white',
			background: 'black',
		});
	} else {
		Log.warn(`Observer ${this.pos.roomName} unable to observe ${roomName} status ${status}`, 'Observer');
	}
	return status;
};

StructureObserver.prototype.reset = function () {
	this.memory.watch = undefined;
	this.memory.mode = undefined;
};
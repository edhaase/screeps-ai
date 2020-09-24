/**
 * ext/structure.observer.js
 */
'use strict';

/* global DEFINE_MEMORY_BACKED_PROPERTY */

// import * as Intel from '/Intel';
import { Log, LOG_LEVEL } from '/os/core/Log';
import { scanRoom } from '/Intel';
import Region from '/ds/Region';
import { ICON_SATELLITE } from '/lib/icons';
import { MAP_ICON_SIZE, MAP_ICON_OPACITY } from '/os/core/constants';

DEFINE_MEMORY_BACKED_PROPERTY(StructureObserver.prototype, 'lastRoom', { key: 'last' });

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

/**
 * Observer run method, called by each observer every tick.
 *
 * Modes of operation: Radar, Watch, Stored program, Pursuit
 * If idle defaults to radar sweep.
 */
StructureObserver.prototype.run = function () {
	if (this.isDeferred() || !this.isActive())
		return;

	const { memory } = this;
	const prevTickRoomName = this.lastRoom;
	const prevRoom = Game.rooms[prevTickRoomName];
	this.lastRoom = undefined; // clear early, in case we set it later

	if (prevRoom) {
		scanRoom(prevRoom);
		markCandidateForRemoteMining(prevRoom);
		markCandidateForCommodityMining(prevRoom);
		markCandidateForLooting(prevRoom);
	}

	if (this.memory.nextRoom) {	// OS override
		if (this.observeRoom(this.memory.nextRoom) === OK)
			delete this.memory.nextRoom;
	} else if (memory.mode === OBSERVER_MODE_WATCH) {
		this.watch();
		return;
	} else {
		this.sweep();
	}
};

/**
 *
 */
StructureObserver.prototype.getRange = function () {
	if (this.hasEffect(PWR_OPERATE_OBSERVER))
		return Infinity;
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
	if (!this.cache.avail) {
		const range = Math.min(OBSERVER_RANGE, this.getRange());
		const region = Region.fromCenter(this.pos.roomName, range);
		const itr = region.getRoomsInRange(n => !Game.rooms[n] || !Game.rooms[n].my);
		this.cache.avail = [...itr];
	}
	return this.cache.avail;
};

StructureObserver.prototype.isInRange = function (nextRoom) {
	return Game.map.getRoomLinearDistance(this.pos.roomName, nextRoom, false) <= this.getRange();
};

/**
 * Execute a command in a room we don't yet have visibility on.
 * Works by converting the function to a string and rebuilding it with eval.
 *
 * @param {string} nextRoom - Room to observe
 * @param {Function} fn - Function to execute, takes one argument (room name)
 *
 * observer.exec('E57S49', (room) => room.find(FIND_SOURCES));
 */
StructureObserver.prototype.exec = function (nextRoom, fn = () => 1) {
	const status = this.observeRoom(nextRoom);
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
StructureObserver.prototype.observeRoom = function (nextRoom, force = false) {
	if (this.isBusy && !force)
		return ERR_BUSY;

	const status = observeRoom.apply(this, arguments);
	if (status === OK) {
		this.isBusy = true;
		this.lastRoom = nextRoom;
		this.room.visual.text(nextRoom, this.pos, {
			color: 'white',
			background: 'black',
		});
		if (Game.map.visual) // Leaks so much memory
			Game.map.visual.text(ICON_SATELLITE, new RoomPosition(25, 25, nextRoom), { opacity: MAP_ICON_OPACITY, fontSize: MAP_ICON_SIZE });
	} else {
		Log.warn(`Observer ${this.pos.roomName} unable to observe ${nextRoom} status ${status}`, 'Observer');
	}
	return status;
};

StructureObserver.prototype.reset = function () {
	this.memory.watch = undefined;
	this.memory.mode = undefined;
};
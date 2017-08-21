/**
 * StructureObserver
 *
 * No further intel gathering at this level. Just room visibility. 
 * Leave the intel stage to room visibility changes. 
 * That way we can also use scouts if an observer is not available.
 * (Also, that keeps this code _much_ simpler)
 */
"use strict";

global.getRoomNameFromCoord = function(wx,wy) {
	var result = "";
	result += (wx < 0 ? "W" + String(~wx) : "E" + String(wx));
	result += (wy < 0 ? "N" + String(~wy) : "S" + String(wy));
	return result;
}

global.getRoomCoordFromName = function(roomName) {
	var [name,h,wx,v,wy] = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/);
	wx = parseInt(wx);
	wy = parseInt(wy);
	if(h === 'W') wx = ~wx;
	if(v === 'N') wy = ~wy;
	return [wx,wy];
}

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
StructureObserver.prototype.run = function() {
	if(BUCKET_LIMITER || CPU_LIMITER || this.isDeferred())
		return;
	
	let memory = this.memory;	
	
	// Run stored command
	if(memory.cmd !== undefined
	&& memory.last !== undefined
	) { // && Game.rooms[this.memory.last] !== undefined) {
		console.log('Observer running stored program');
		try {
			let fn = eval(memory.cmd);
			fn.call(this, Game.rooms[memory.last]);			
		} catch(e) {
			Log.error(e);
			Log.error(e.stack);
		}
		delete this.memory.last;
		delete this.memory.cmd;
		return;
	}
	
	if(memory.mode === OBSERVER_MODE_WATCH)
		return this.watch();
	
	this.sweep();
}

/**
 * Get this observer's room position in the world
 * (Not it's fine-grained world position, just room coordinates)
 * This is here so we can find rooms in range.
 */
StructureObserver.prototype.getRoomCoordinates = function() {
	if(!this.memory.coord)
		this.memory.coord = getRoomCoordFromName(this.pos.roomName);
	return this.memory.coord;
}
// W8N3,W7N3,W6N3,W8N2,W7N2,W6N2,W8N1,W7N1,W6N1
/**
 * Cpu-efficent calls to find observer's range
 */
const INTEL_RANGE = OBSERVER_RANGE; //2; // 121 at half dist, 441 rooms

StructureObserver.prototype.getTopLeftCoords = function() {
	var [rx,ry] = this.getRoomCoordinates();
	var range = this.getRange();
	return [rx-range, ry-range];
}

StructureObserver.prototype.getTopLeftRoomName = function() {
	var [rx,ry] = this.getTopLeftCoords();
	return getRoomNameFromCoord(rx,ry);
}

StructureObserver.prototype.getBottomRightCoords = function() {
	var [rx,ry] = this.getRoomCoordinates();
	var range = this.getRange();
	return [rx+range, ry+range];
}

StructureObserver.prototype.getBottomRightRoomName = function() {
	var [rx,ry] = this.getBottomRightCoords();
	return getRoomNameFromCoord(rx,ry);
}

/**
 * Cpu-efficient calculation of room names in range.
 * Roughly 1 cpu without caching.
 * W12N7 to W2S2
 * goid('b56773695470608').getRoomsInRange().includes('W9N1')
 */
StructureObserver.prototype.getRoomsInRange = function() {
	if(this.cache.rooms)
		return this.cache.rooms;
	var [left,top] = this.getTopLeftCoords();
	var [right,bottom] = this.getBottomRightCoords();	
	var x,y,roomName;
	var rooms = [];
	for(y=top; y<=bottom; y++) {		
		for(x=left; x<=right; x++) {			
			roomName = getRoomNameFromCoord(x,y);
			rooms.push(roomName);
		}			
	}
	this.cache.rooms = rooms;
	return rooms;
}

/**
 *
 */
StructureObserver.prototype.getRange = function() {
	if(this.memory && this.memory.range)
		return Math.min(this.memory.range, OBSERVER_RANGE);
	return OBSERVER_RANGE;
}

/**
 *
 */
StructureObserver.prototype.setRange = function(range) {
	if(!_.isNumber(range))
		throw new Error("Invalid type");
	if(range > OBSERVER_RANGE)
		throw new RangeError("Range may not exceed OBSERVER_RANGE");
	if(range < 1)
		throw new RangeError("Range may not be less than 1");	
	delete this.cache.rooms;
	delete this.cache.avail;
	return (this.memory.range = range);
}

/**
 * Filter the rooms in range for real rooms and rooms we don't own.
 */
StructureObserver.prototype.getAvailRoomsInRange = function() {
	if(!this.cache.avail)		
		this.cache.avail = _.filter(this.getRoomsInRange(), rn => this.isValidObservationTarget(rn));
	return this.cache.avail;
}

/**
 * Checks
 */
StructureObserver.prototype.isValidObservationTarget = function(roomName) {
	if(Game.rooms[roomName] && Game.rooms[roomName].my)
		return false;
	return Game.map.isRoomAvailable(roomName);
}

StructureObserver.prototype.isInRange = function(roomName) {
	return Game.map.getRoomLinearDistance(this.pos.roomName, roomName, false) <= this.getRange();
}

/**
 * Execute a command in a room we don't yet have visibility on.
 * Works by converting the function to a string and rebuilding it with eval.
 *
 * @param {string} roomName - Room to observe
 * @param {Function} fn - Function to execute, takes one argument (room name)
 *
 * observer.exec('E57S49', (room) => room.find(FIND_SOURCES));
 */
StructureObserver.prototype.exec = function(roomName, fn=()=>1) {	
	if(this.observeRoom(roomName) === OK)
		this.memory.cmd = fn.toString();
}

StructureObserver.prototype.watch = function() {
	let watch = this.memory.watch;
	if(!watch)
		return;
	
	/* if(Array.isArray(watch)) {
		watch = watch[Game.time % watch.length];
	} */
	
	if(Game.rooms[watch] && _.get(Game.rooms[watch], 'controller.my', false) == true) {
		Log.info('[OBSERVER] Already have visibility in this room. Ending watch operations.');
		delete this.memory.watch;
		return;
	}
	
	if(!(Game.time % 250))
		Log.info('Observer at ' + this.pos + ' watching room '  + watch);
	
	return this.observeRoom(watch);		
}

// Game.getObjectById('57e1ff70294823be1c0623f6')
StructureObserver.prototype.sweep = function() {
	var rooms = this.getAvailRoomsInRange();
	var room = rooms[Game.time % rooms.length];	
	this.observeRoom(room);
}

let observeRoom = StructureObserver.prototype.observeRoom;
StructureObserver.prototype.observeRoom = function(roomName) {
	if(this.isBusy)
		return ERR_BUSY;
	
	let status = observeRoom.apply(this, arguments);
	if(status === OK) {
		this.isBusy = true;
		this.memory.last = roomName;
		this.room.visual.text(roomName, this.pos, {
			color: 'white',
			background: 'black',
		});
	} else {
		Log.debug(`Observer ${this.pos.roomName} unable to observe ${roomName} status ${status}`, 'Observer');
	}
	return status;
}

StructureObserver.prototype.reset = function() {
	delete this.memory.watch;
	delete this.memory.mode;
}
/**
 * ext-structure-storage.js - Now with adjustable reserve
 * 
 * During times of conflict the reserve can raise, maintaining a stockpile for 
 *
 * Note: Don't tick this structure to change states.
 * If the storage is lost we could get stuck in a state.
 * But we _could_ track the previous tick's energy and report the state change.
 */
'use strict';

const DEFAULT_STORAGE_RESERVE = 100000;


/* StructureStorage.prototype.isActive = function() {
	return (!this.room.controller || this.room.controller.level >= 4);
};

StructureStorage.prototype.run = function() {
	if(Game.time % 5 !== 0 || this.isDeferred())
		return;
	if(this.store[RESOURCE_ENERGY] < 25000)
		Log.warn('[Storage] Storage ' + this.pos.roomName + ' low on energy!');
	
	// @todo: If RCL 6 and working terminal and we have other minerals, spawn a filler.
	this.defer(CREEP_LIFE_TIME * 2);
	let {terminal} = this.room;
	if(!terminal)
		return;
	let resource = _.findKey(this.store, (amt,key) => amt > 0 && key != RESOURCE_ENERGY);
	if(!resource)
		return;
	let amount = this.store[resource];
	Log.notify('[Storage] Storage ' + this.pos.roomName + ' excess ' + resource + ', ' + amount);
	
	let spawn = this.getClosestSpawn();
	// @todo: Check if we have one first.
	if(spawn)
		spawn.enqueue(Util.RLD([4,CARRY,4,MOVE]), null, {role: 'filler', src: this.id, dest: terminal.id, res: resource, amt: amount})	
};

*/

Object.defineProperty(StructureStorage.prototype, 'reserve', {
	set: function (value) {
		if (value === null) {
			delete this.memory.r;
			return;
		}
		if (!(typeof value === 'number'))
			throw new TypeError(`Expected number, got ${value}`);
		this.memory.r = Math.min(this.storeCapacity, value);		
	},
	get: function () {
		if (this === StructureStorage.prototype)
			return 0;
		if (this.memory.r == null)
			return Math.min(DEFAULT_STORAGE_RESERVE, this.storeCapacity);
		return this.memory.r;
	},
	configurable: true,
	enumerable: false
});

/** Sliding scale - Possibly exponential decay at lower levels */
Object.defineProperty(StructureStorage.prototype, 'stock', {
	get: function() {
		return (this.store[RESOURCE_ENERGY] || 0) / this.reserve;
	},
	configurable: true,
	enumerable: false
});

// scav gen4 - Instead of doing everything in pickup and dropoff states,
// break it up into more states. State changes may cause problems?
// HAUL - Pick up from containers, take to storage/terminal/controller
// EXT - Fill spawns/extensions (Take from anything)
// UPG - Upgrade controller
// HVST - We have work parts and no miners or stored energy. Let's be useful.
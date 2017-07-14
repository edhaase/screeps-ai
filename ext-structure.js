/**
 * Creates property energyPct on structures, that we can group and sort by
 */
'use strict';

defineCachedGetter(Structure.prototype, 'cost', ({structureType}) => CONSTRUCTION_COST[structureType]);
defineCachedGetter(Structure.prototype, 'energyPct', s => s.energy / s.energyCapacity);
defineCachedGetter(Structure.prototype, 'hitPct', s => s.hits / s.hitsMax);
defineCachedGetter(Structure.prototype, 'storedTotal', s => _.sum(s.store));

/* Object.defineProperty(Structure.prototype, "dismantleReturn", {
	get: function() {
		return (this.hits / DISMANTLE_POWER) * DISMANTLE_COST;
	},
	configurable: true
})  */
 
 
/**
 * All owned structures can be 'run'.
 */
OwnedStructure.prototype.logic = function() {
	var name = 's-' + this.structureType;
	Volatile[name] = _.round((Volatile[name] || 0) + Time.measure( () => this.run() ), 3);
} 
 
OwnedStructure.prototype.run = function () {

}

/**
 * Monkey patch isActive to cache.
 * @todo: Invalidate periodically?
 */
let isActive = Structure.prototype.isActive;
Structure.prototype.isActive = function() {
	if(this.cache.active === undefined) {
		this.cache.active = isActive.apply(this,arguments);
		// Log.warn('isActive check: ' + this.structureType + ' at ' + this.pos);
	}	
	return this.cache.active;
}

Structure.prototype.say = function(msg) {
	var {x,y,roomName} = this.pos;
	var newPos = new RoomPosition(x,y-0.75,roomName);
	this.room.visual.text(msg, newPos, {color: 'yellow'});
}

/**
 * All owned structures can "sleep". But it's up to individual structure logic
 * to decide if it wants to make that check at all.
 */
OwnedStructure.prototype.defer = function(ticks) {
	if(!_.isNumber(ticks))
		throw new Error('OwnedStructure.defer expects numbers');
	if(ticks >= Game.time)
		Log.notify('[WARNING] Structure ' + this.id + ' at ' + this.pos + ' deferring for unusually high ticks!');
	if(Memory.structures[this.id] === undefined)
		Memory.structures[this.id] = {};
	if(!this.isDeferred())
		this.onDefer(ticks);
	Memory.structures[this.id].defer = Game.time + ticks;
}

OwnedStructure.prototype.clearDefer = function() {
	if(Memory.structures[this.id] && Memory.structures[this.id].defer)
		delete Memory.structures[this.id].defer;
}

OwnedStructure.prototype.isDeferred = function() {
	if(this.my === true) {	
		let memory = Memory.structures[this.id];
		if(memory !== undefined && memory.defer !== undefined && Game.time < memory.defer)
			return true;	
		else if(memory !== undefined && memory.defer) {
			delete Memory.structures[this.id].defer;
			this.onWake();
		}
	}
	return false;
}

OwnedStructure.prototype.onDefer = function(ticks) {
	// console.log(`${this.structureType} ${this.id} going to sleep for ${ticks} at ${Game.time}`);
}

OwnedStructure.prototype.onWake = function() {
	// console.log(`${this.structureType} ${this.id} waking up at tick ${Game.time}`);
}

/**
 * Provides structure memory.
 */
if(!Memory.structures) {
	Log.warn('Initializing structure memory','Memory');
	Memory.structures = {}; 
}
 
Object.defineProperty(OwnedStructure.prototype, "memory", {
    get: function () {      
		if(!Memory.structures[this.id])
			Memory.structures[this.id] = {};
		return Memory.structures[this.id];
    },
	set: function(v) {
		return _.set(Memory, 'structures.' + this.id, v);
	},
	configurable: true,
	enumerable: false
});
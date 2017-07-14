/**
 * Cache.js
 */
'use strict';
 
let Cache = {};

Object.defineProperty(Room.prototype, "cache", {
	get: function() {
		if(this == undefined || this === Room.prototype)
			return;
		if(!Cache.rooms)
			Cache.rooms = {};
		if(!Cache.rooms[this.name])
			Cache.rooms[this.name] = {};
		return Cache.rooms[this.name];
		
	},
	set: function(value) {
		if(!Cache.rooms)
			Cache.rooms = {};			
		Cache.rooms[this.name] = value;
	},
	configurable: true,
	enumerable: false
});

/**
 * For the sake of cpu and features we're adding this to everything at once.
 */
Object.defineProperty(RoomObject.prototype, "cache", {
	get: function() {
		if(this == undefined || !(this instanceof RoomObject))
			return;
		if(this.id === undefined)
			throw new Error("This object doesn't have an id");
		if(!Cache.obj)
			Cache.obj = {};
		if(!Cache.obj[this.id])
			Cache.obj[this.id] = {};
		return Cache.obj[this.id];
		
	},
	set: function(value) {
		if(this.id === undefined)
			throw new Error("This object doesn't have an id");
		if(!Cache.obj)
			Cache.obj = {};
		Cache.obj[this.id] = value;
	},
	configurable: true,
	enumerable: false
});

RoomObject.prototype.clearCache = function() {
	delete Cache.obj[this.id];
}

Object.defineProperty(Flag.prototype, "cache", {
	get: function() {
		if(this == undefined || this === Flag.prototype)
			return;
		if(!Cache.flags)
			Cache.flags = {};
		if(!Cache.flags[this.name])
			Cache.flags[this.name] = {};
		return Cache.flags[this.name];
		
	},
	set: function(value) {
		if(!Cache.flags)
			Cache.flags = {};			
		Cache.flags[this.name] = value;
	},
	configurable: true,
	enumerable: false
});


/* Object.defineProperty(Creep.prototype, "cache", {
	get: function() {	
		if(this == undefined || this === Creep.prototype)
			return;	
		if(!Cache.creeps)
			Cache.creeps = {};
		if(!Cache.creeps[this.name])
			Cache.creeps[this.name] = {};
		return Cache.creeps[this.name];
		
	},
	set: function(value) {
		if(!Cache.creeps[this.name])
			Cache.creeps[this.name] = {};			
		Cache.creeps[this.name] = value;
	},
	configurable: true,
	enumerable: false
});

Object.defineProperty(Structure.prototype, "cache", {
	get: function() {
		if(this == undefined || this === Structure.prototype)
			return;
		if(!Cache.structures)
			Cache.structures = {};
		if(!Cache.structures[this.id])
			Cache.structures[this.id] = {};
		return Cache.structures[this.id];
		
	},
	set: function(value) {
		if(!Cache.structures)
			Cache.structures = {};			
		Cache.structures[this.id] = value;
	},
	configurable: true,
	enumerable: false
});

Object.defineProperty(Source.prototype, "cache", {
	get: function() {
		if(this == undefined || this === Source.prototype)
			return;
		if(!Cache.sources)
			Cache.sources = {};
		if(!Cache.sources[this.id])
			Cache.sources[this.id] = {};
		return Cache.sources[this.id];
		
	},
	set: function(value) {
		if(!Cache.sources)
			Cache.sources = {};			
		Cache.sources[this.id] = value;
	},
	configurable: true,
	enumerable: false
});
*/

module.exports = Cache;
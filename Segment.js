/**
 * Segment.js - Memory segments controller
 *
 * 
 */
'use strict';

/**
 * Memory segment globals.
 */
global.SEGMENT_MAX_COUNT = 100;
global.SEGMENT_MAX_SIZE = 100 * 1024;

global.SEGMENT_STATS = 0;
global.SEGMENT_COSTMATRIX = 1;
global.SEGMENT_INTEL = 2;				// Room intel (mostly observer data)
global.SEGMENT_BUILD = 3;
global.SEGMENT_ROAD = 4;
global.DEFAULT_SEGMENTS = [0,1,2,3,4];

/** Stores an object for each active segment */
global.SEGMENTS = {};


String.prototype.splitOnce = function(token="_") {
	var pos = this.indexOf(token);
	return [ this.slice(0,pos),
			 this.slice(pos+1) ];
}

/**
 *
 */
class MemorySegment
{
	constructor(id,ts=Game.time,data) {
		this.id = parseInt(id);
		this.ts = parseInt(ts) || Game.time;
		this.data = _.isEmpty(data)?{}:JSON.parse(data);
	}
	
	isDirty() {
		return this.ts >= Game.time;
	}
	
	commit(force=false) {
		if(this.ts < Game.time && !force)
			return;
		var used,start = Game.cpu.getUsed();
		RawMemory.segments[this.id] = this.serialize();
		used = Game.cpu.getUsed() - start;
		Log.debug(`Saved segment ${this.id} in ${_.round(used,3)} (Tick ${Game.time})`, 'Memory');
	}
	
	serialize() {
		var str = `${this.ts}_${JSON.stringify(this.data)}`;
		if(str.length > SEGMENT_MAX_SIZE)
			throw new Error('String size would exceed segment size limit');
		return str;
	}
	
	static deserialize(id,str) {
		var [ts,data] = str.splitOnce('_');
		return new MemorySegment(id,ts,data);
	}
	
	toString() {
		return `[MemorySegment ${this.id} ${this.ts}]`;
	}
	
	get size() {
		return this.serialize().length;
	}
}

class Segments
{
	static update() {
		if(_.size(RawMemory.segments) <= 0) {
			Log.info('Loading default memory segments', 'Memory');
			return RawMemory.setActiveSegments(DEFAULT_SEGMENTS);
		}
		let seg = this.getActiveSegments();
		_.each(this.getActiveSegments(), (id) => this.refresh(id));		
	}
	
	static refresh(id) {
		try {
			var str = RawMemory.segments[id];	
			var [ts,data] = str.splitOnce('_');
			ts = parseInt(ts);
			var used,start = Game.cpu.getUsed();
			if(!SEGMENTS[id] || SEGMENTS[id].ts < ts) {			
				SEGMENTS[id] = new MemorySegment(id,ts,data);
				used = Game.cpu.getUsed() - start;
				Log.debug(`Loading segment ${id} in ${_.round(used,3)} (Tick ${Game.time})`, 'Memory');
			} else if(SEGMENTS[id].ts > ts) {			
				SEGMENTS[id].commit(true);
				// var data =  JSON.stringify(SEGMENTS[id].data);
				// data = Lzw.encode(data);				
			}
		} catch(e) {
			Log.error('Error loading segment ' + id, 'Memory');
			Log.error(e);
			Log.error(e.stack);
		}
	}
	
	static clearSegment(id) {
		RawMemory.segments[id] = "";
	}
	
	static getActiveSegments() {
		return Object.keys(RawMemory.segments);
	}
	
	static setActiveSegments(arr) {
		return RawMemory.setActiveSegments(arr);
	}
}

module.exports = Segments;
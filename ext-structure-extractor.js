/**
 * ext-structure-extractor.js
 *
 * @todo - auto rampart container
 * @todo - if we only have one access point, auto-build the container
 * 2016-11-06: Thanks to NPC buy order nerf, we need another check for full terminals
 */
'use strict';
 
StructureExtractor.prototype.run = function() {
	if(this.isDeferred())
		return;
	
	// We don't need to run very often, and if we've downgraded, don't bother runnng.
	if(Game.time%5 || !this.isActive() || BUCKET_LIMITER)
		return;
	
	// (Optional) if we don't have a terminal in the room, don't run.
	var terminal = this.room.terminal;
	if(terminal == undefined) {
		Log.warn(`No terminal in ${this.pos.roomName}, operations disabled.`, 'Extractor');		
		return this.defer(500);
	}
	
	var mineral = this.mineral;
	// if mineral density changed, notify
	if(mineral.density && mineral.density !== this.memory.density) {
		Log.info('Mineral density in ' + this.pos.roomName + ' changed to ' + mineral.density, 'Extractor');
		this.memory.density = mineral.density;
	}
		
	// If exhausted, defer	
	if(mineral && mineral.mineralAmount === 0) {
		Log.info(`Mineral site at ${this.pos} empty. Going to sleep for ${mineral.ticksToRegeneration} ticks`, 'Extractor');			
		// this.memory.defer = Game.time + mineral.ticksToRegeneration;
		return this.defer(mineral.ticksToRegeneration);
	} 		
	
	// Do we have a miner?
	var miner = _.find(Game.creeps, c => c.memory.role === 'harvester' && c.memory.site === this.mineral.id);
	if(miner)
		return this.defer(25);
	
	if(terminal && mineral && terminal.store[mineral.mineralType] > TERMINAL_RESOURCE_LIMIT) {
		Log.warn(`Terminal ${this.pos.roomName} at capacity for ${mineral.mineralType}, deferring harvester`, 'Extractor');
		return this.defer(500);
	}
	
	// Do we have a container?
	let container = this.getAdjacentContainer();
	if(!container) {
		Log.warn('No mineral container for ' + this.pos.roomName + ', extractor offline', 'Extractor');
		return this.defer(25);
	} else if(container.storedTotal / container.storeCapacity > 0.80) {
		Log.warn('Container full, waiting for pickup', 'Extractor');
		return this.defer(10);
	}
	
	let spawn = this.getClosestSpawn();	
	if(spawn && mineral && container && !this.room.hostiles.length) {
		Mining.requestMineralHarvester(spawn, mineral.id, container.id, (MAX_CREEP_SPAWN_TIME*2)-1);
	}
	this.defer(MAX_CREEP_SPAWN_TIME * 2); // margin of error
}

StructureExtractor.prototype.rampartContainer = function() {
	let container = this.getAdjacentContainer();
	if(container != undefined && !container.pos.hasRampart()) {
		let status = container.pos.createConstructionSite(STRUCTURE_RAMPART);
		Log.notify('[Extractor] Requesting rampart on mineral container at ' + container.pos + ', status: ' + status);		
		return status;
	}
	return ERR_INVALID_TARGET;
}

StructureExtractor.prototype.isActive = function() {
	return (!this.room.controller || this.room.controller.level >= 6);
}

defineCachedGetter(StructureExtractor.prototype, 'mineral', s => _.first(s.pos.lookFor(LOOK_MINERALS)));

/* Object.defineProperty(StructureExtractor.prototype, "mineral", {
    get: function () {
		return this.room.mineral;		
    },	
	configurable: true,
	enumerable: false
}); */
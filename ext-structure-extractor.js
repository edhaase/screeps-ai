/**
 * ext-structure-extractor.js
 *
 * @todo - auto rampart container
 * @todo - if we only have one access point, auto-build the container
 * 2016-11-06: Thanks to NPC buy order nerf, we need another check for full terminals
 */
"use strict";

const EXTRACTOR_CONTAINER_FULL = 0.80; // 80%
const EXTRACTOR_DELAY = 50;

StructureExtractor.prototype.onWake = function() {
	var mineral = this.mineral;
	// if mineral density changed, notify
	if(mineral.density && mineral.density !== this.memory.density) {
		Log.info(`Mineral density in ${this.pos.roomName} changed to ${mineral.density}`, 'Extractor');
		this.memory.density = mineral.density;
	}
};

StructureExtractor.prototype.run = function() {
	if(this.isDeferred())
		return;
	
	// We don't need to run very often, and if we've downgraded, don't bother runnng.
	if(Game.time%5 || !this.isActive() || BUCKET_LIMITER)
		return;
	
	// (Optional) if we don't have a terminal in the room, don't run.
	var terminal = this.room.terminal;
	if(terminal == null) {
		Log.warn(`No terminal in ${this.pos.roomName}, operations disabled.`, 'Extractor');		
		this.defer(EXTRACTOR_DELAY);
		return;
	}

	// If exhausted, defer	
	var mineral = this.mineral;
	if(mineral && mineral.mineralAmount === 0 && mineral.ticksToRegeneration > MAX_CREEP_SPAWN_TIME) {
		Log.info(`Mineral site at ${this.pos} empty. Going to sleep for ${mineral.ticksToRegeneration} ticks`, 'Extractor');			
		// this.memory.defer = Game.time + mineral.ticksToRegeneration;
		this.defer(mineral.ticksToRegeneration - MAX_CREEP_SPAWN_TIME);
		return;
	} 		
	
	// Do we have a miner?
	var miner = _.find(Game.creeps, c => c.memory.role === 'harvester' && c.memory.site === this.mineral.id);
	if(miner) {
		this.defer(Math.min(miner.ticksToLive, EXTRACTOR_DELAY));
		return;
	}
	
	if(terminal && mineral && terminal.store[mineral.mineralType] > TERMINAL_RESOURCE_LIMIT) {
		Log.warn(`Terminal ${this.pos.roomName} at capacity for ${mineral.mineralType}, deferring harvester`, 'Extractor');
		this.defer(EXTRACTOR_DELAY);
		return;
	}
	
	// Do we have a container?
	var container = this.getAdjacentContainer();
	if(!container) {
		Log.warn(`No mineral container for ${this.pos.roomName}, extractor offline`, 'Extractor');
		this.defer(EXTRACTOR_DELAY);
		return;
	} else if(container.storedTotal / container.storeCapacity > EXTRACTOR_CONTAINER_FULL) {
		Log.warn('Container full, waiting for pickup', 'Extractor');
		this.defer(EXTRACTOR_DELAY);
		return;
	}
	
	var spawn = this.getClosestSpawn();	
	if(spawn && mineral && container && !this.room.hostiles.length) {
		Mining.requestMineralHarvester(spawn, mineral.id, container.id, (MAX_CREEP_SPAWN_TIME*2)-1);
	}
	this.defer(MAX_CREEP_SPAWN_TIME * 2); // margin of error
};

StructureExtractor.prototype.rampartContainer = function() {
	const container = this.getAdjacentContainer();
	if(container != null && !container.pos.hasRampart()) {
		const status = container.pos.createConstructionSite(STRUCTURE_RAMPART);
		Log.notify(`[Extractor] Requesting rampart on mineral container at ${container.pos}, status: ${status}`);
		return status;
	}
	return ERR_INVALID_TARGET;
};

StructureExtractor.prototype.isActive = function() {
	return (!this.room.controller || this.room.controller.level >= 6);
};

defineCachedGetter(StructureExtractor.prototype, 'mineral', s => _.first(s.pos.lookFor(LOOK_MINERALS)));
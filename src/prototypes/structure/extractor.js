/**
 * ext/structure.extractor.js
 *
 * @todo - auto rampart container
 * @todo - if we only have one access point, auto-build the container
 * 2016-11-06: Thanks to NPC buy order nerf, we need another check for full terminals
 */
'use strict';

/* global DEFINE_CACHED_GETTER, Log, MAX_CREEP_SPAWN_TIME, TERMINAL_RESOURCE_LIMIT */
import * as Unit from '/Unit';
import { TERMINAL_RESOURCE_LIMIT } from '/prototypes/structure/terminal';
import { Log, LOG_LEVEL } from '/os/core/Log';

const EXTRACTOR_CONTAINER_FULL = 0.80; // 80%
const EXTRACTOR_DELAY = 25;
const MINIMUM_LEVEL_FOR_EXTRACTOR = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_EXTRACTOR]);

DEFINE_CACHED_GETTER(StructureExtractor.prototype, 'mineral', s => _.first(s.pos.lookFor(LOOK_MINERALS)));
DEFINE_CACHED_GETTER(StructureExtractor.prototype, 'slots', s => _.filter(s.pos.getAdjacentPoints(), p => p.isOpen() || p.hasStructure(STRUCTURE_ROAD)));

StructureExtractor.prototype.onWake = function () {
	var { mineral } = this;
	// if mineral density changed, notify
	if (mineral.density && mineral.density !== this.memory.density) {
		Log.info(`Mineral density in ${this.pos.roomName} changed to ${mineral.density}`, 'Extractor');
		this.memory.density = mineral.density;
	}
};

StructureExtractor.prototype.run = function () {
	if (this.isDeferred())
		return;

	// We don't need to run very often, and if we've downgraded, don't bother runnng.
	if (Game.time % EXTRACTOR_COOLDOWN || !this.isActive())
		return;

	// (Optional) if we don't have a terminal in the room, don't run.
	var { terminal } = this.room;
	if (terminal == null) {
		Log.warn(`No terminal in ${this.pos.roomName}, operations disabled.`, 'Extractor');
		this.defer(EXTRACTOR_DELAY);
		return;
	}

	// If exhausted, defer	
	var { mineral } = this;
	if (mineral && mineral.mineralAmount === 0 && mineral.ticksToRegeneration > MAX_CREEP_SPAWN_TIME) {
		Log.info(`Mineral site at ${this.pos} empty. Going to sleep for ${mineral.ticksToRegeneration} ticks`, 'Extractor');
		// this.memory.defer = Game.time + mineral.ticksToRegeneration;
		this.defer(mineral.ticksToRegeneration - MAX_CREEP_SPAWN_TIME);
		return;
	}

	if (terminal && mineral && (terminal.store[mineral.mineralType] > TERMINAL_RESOURCE_LIMIT || terminal.storedTotal >= terminal.storeCapacity)) {
		Log.warn(`Terminal ${this.pos.roomName} at capacity for ${mineral.mineralType}, deferring harvester`, 'Extractor');
		this.defer(EXTRACTOR_DELAY);
		return;
	}

	// Do we have a miner?
	var [spawn, cost = 0] = this.getClosestSpawn();
	var miner = _.filter(Game.creeps, c => c.memory.role === 'harvester' && c.memory.site === this.mineral.id && (c.spawning || c.ticksToLive > UNIT_BUILD_TIME(c.body) + cost));
	if (miner && miner.length >= this.slots.length) {
		this.defer(EXTRACTOR_DELAY);
		return;
	}

	// Do we have a container?
	var container = this.getAdjacentContainer();
	if (!container) {
		Log.warn(`No mineral container for ${this.pos.roomName}, extractor offline`, 'Extractor');
		this.defer(EXTRACTOR_DELAY);
		return;
	} else if (container.storedTotal / container.storeCapacity > EXTRACTOR_CONTAINER_FULL) {
		Log.warn(`Container full in ${this.pos.roomName}, waiting for pickup`, 'Extractor');
		this.defer(EXTRACTOR_DELAY);
		return;
	}

	if (spawn && mineral && container && !this.room.intruders.length) {
		Unit.requestMineralHarvester(spawn, mineral.id, container.id, (MAX_CREEP_SPAWN_TIME * 2) - 1);
	}
	this.defer(MAX_CREEP_SPAWN_TIME * 2); // margin of error
};

StructureExtractor.prototype.rampartContainer = function () {
	const container = this.getAdjacentContainer();
	if (container != null && !container.pos.hasRampart()) {
		const status = container.pos.createConstructionSite(STRUCTURE_RAMPART);
		Log.notify(`[Extractor] Requesting rampart on mineral container at ${container.pos}, status: ${status}`);
		return status;
	}
	return ERR_INVALID_TARGET;
};

StructureExtractor.prototype.isActive = function () {
	return (!this.room.controller || this.room.controller.level >= MINIMUM_LEVEL_FOR_EXTRACTOR);
};
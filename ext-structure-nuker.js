/**
 * ext-structure-nuker.js - A wildly ineffective weapon
 *
 *   The nuker can hit any room in range 10, striking a tiny radius for millions of hp
 * in damage and killing all the creeps in the room. But it takes a real life week to cooldown, 
 * 2.5 days to land, and a fair amount of ghodium.
 */
"use strict";

StructureNuker.prototype.run = function () {
	// NUKER_COOLDOWN, NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY, NUKE_RANGE	
	if (this.cooldown > 1024 || this.isDeferred())
		return;

	if (this.cooldown === 500)
		Log.notify(`Silo in ${this.pos.roomName} will be operational in 500 ticks`);

	if (this.cooldown === 1)
		Log.notify(`Silo ${this.pos.roomName} cooldown complete`);

	// Reload logic
	if (this.ghodium < this.ghodiumCapacity
		&& this.room.terminal !== undefined
		&& this.room.terminal.store[RESOURCE_GHODIUM] >= (this.ghodiumCapacity - this.ghodium)
		&& _.findWhere(Game.creeps, { memory: { role: 'filler', dest: this.id } }) == null) {
		// Log.info('[Nuker] Requesting filler unit at ' + this.pos.roomName);
		this.runReload();
		this.defer(MAX_CREEP_SPAWN_TIME * 2);
		return;
	}

	// Skip remaining logic
	/* if (this.ghodium < this.ghodiumCapacity
		|| this.energy < this.energyCapacity)
		return; */
	// if we're under threat and we're loaded, fire on pre-programmed target!

};

defineCachedGetter(StructureNuker.prototype, 'armed', function (s) {
	return s.energy >= s.energyCapacity && s.ghodium >= s.ghodiumCapacity;
});

defineCachedGetter(StructureNuker.prototype, 'ready', s => s.armed && s.cooldown <= 0);

/**
 * Spawn filler to reload us.
 */
const NUKER_FILLER_BODY = Util.RLD([4, CARRY, 4, MOVE]);
StructureNuker.prototype.runReload = function () {
	if (this.ghodium >= this.ghodiumCapacity)
		return ERR_FULL;
	const spawn = this.getClosestSpawn();
	const {terminal} = this.room;
	const memory = { role: 'filler', src: terminal.id, dest: this.id, res: RESOURCE_GHODIUM, amt: this.ghodiumCapacity - this.ghodium };
	spawn.submit({ body: NUKER_FILLER_BODY, memory, priority: 10 });
	return OK;
};

/**
 * Monkey patch nuker to prevent friendly targets
 */
const {launchNuke} = StructureNuker.prototype;
StructureNuker.prototype.launchNuke = function (pos) {
	if (Game.rooms[pos.roomName] && Game.rooms[pos.roomName].my)
		throw new Error("Unable to nuke friendly rooms");
	const status = launchNuke.apply(this, arguments);
	if (status === OK)
		Log.notify(`Nuclear launch detected! ${this.pos.roomName} to ${pos}`);
	return status;
};
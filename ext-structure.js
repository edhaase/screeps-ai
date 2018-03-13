/**
 * Creates property energyPct on structures, that we can group and sort by
 */
"use strict";

defineCachedGetter(Structure.prototype, 'cost', ({ structureType }) => CONSTRUCTION_COST[structureType]);
defineCachedGetter(Structure.prototype, 'energyPct', s => s.energy / s.energyCapacity);
defineCachedGetter(Structure.prototype, 'hitPct', s => s.hits / s.hitsMax);
defineCachedGetter(Structure.prototype, 'storedTotal', s => _.sum(s.store));

StructureRampart.prototype.upkeep = RAMPART_UPKEEP;
defineCachedGetter(StructureRoad.prototype, 'upkeep', r => (Game.map.getTerrainAt(r.pos) === 'swamp') ? ROAD_UPKEEP_SWAMP : ROAD_UPKEEP );
defineCachedGetter(StructureContainer.prototype, 'upkeep', c => c.room.my ? CONTAINER_UPKEEP : REMOTE_CONTAINER_UPKEEP);


/* Object.defineProperty(Structure.prototype, "dismantleReturn", {
	get: function() {
		return (this.hits / DISMANTLE_POWER) * DISMANTLE_COST;
	},
	configurable: true
})  */


/**
 * All owned structures can be 'run'.
 */
OwnedStructure.prototype.logic = function () {
	var name = `s-${this.structureType}`;
	Volatile[name] = _.round((Volatile[name] || 0) + Time.measure(() => this.run()), 3);
};

OwnedStructure.prototype.run = function () {

};

/**
 * Monkey patch isActive to cache.
 * @todo: Invalidate periodically?
 */
const { isActive } = Structure.prototype;
Structure.prototype.isActive = function () {
	if (this.cache.active === undefined)
		this.cache.active = isActive.apply(this, arguments);
	return this.cache.active;
};

Structure.prototype.say = function (msg, color = 'yellow') {
	var { x, y, roomName } = this.pos;
	var newPos = new RoomPosition(x, y - 0.75, roomName);
	this.room.visual.text(msg, newPos, { color });
};

/**
 * All owned structures can "sleep". But it's up to individual structure logic
 * to decide if it wants to make that check at all.
 */
OwnedStructure.prototype.defer = function (ticks) {
	if (!_.isNumber(ticks))
		throw new TypeError('OwnedStructure.defer expects numbers');
	if (ticks >= Game.time)
		Log.notify(`[WARNING] Structure ${this.id} at ${this.pos} deferring for unusually high ticks!`);
	if (Memory.structures[this.id] === undefined)
		Memory.structures[this.id] = {};
	if (!this.isDeferred())
		this.onDefer(ticks);
	Memory.structures[this.id].defer = Game.time + ticks;
};

OwnedStructure.prototype.clearDefer = function () {
	if (Memory.structures[this.id] && Memory.structures[this.id].defer)
		Memory.structures[this.id].defer = undefined;
};

OwnedStructure.prototype.isDeferred = function () {
	if (this.my === true) {
		const memory = Memory.structures[this.id];
		if (memory !== undefined && memory.defer !== undefined && Game.time < memory.defer)
			return true;
		else if (memory !== undefined && memory.defer) {
			Memory.structures[this.id].defer = undefined;
			this.onWake();
		}
	}
	return false;
};

OwnedStructure.prototype.onDefer = function (ticks) {
	// console.log(`${this.structureType} ${this.id} going to sleep for ${ticks} at ${Game.time}`);
};

OwnedStructure.prototype.onWake = function () {
	// console.log(`${this.structureType} ${this.id} waking up at tick ${Game.time}`);
};

/**
 * Provides structure memory.
 */
if (!Memory.structures) {
	Log.warn('Initializing structure memory', 'Memory');
	Memory.structures = {};
}

Object.defineProperty(OwnedStructure.prototype, "memory", {
	get: function () {
		if (!Memory.structures[this.id])
			Memory.structures[this.id] = {};
		return Memory.structures[this.id];
	},
	set: function (v) {
		return _.set(Memory, `structures.${this.id}`, v);
	},
	configurable: true,
	enumerable: false
});
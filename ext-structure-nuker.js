/**
 * ext-structure-nuker.js - A wildly ineffective weapon
 *
 *   The nuker can hit any room in range 10, striking a tiny radius for millions of hp
 * in damage and killing all the creeps in the room. But it takes a real life week to cooldown, 
 * 2.5 days to land, and a fair amount of ghodium.
 *
 * @todo If we're under threat and we're loaded, fire on pre-programmed target!
 * @todo Check intel for friendly rooms.
 * @todo Schedule post-landing cleanup party.
 */
'use strict';

/* global Log, DEFINE_CACHED_GETTER, Filter */
/* eslint-disable consistent-return, prefer-destructuring */

const DEFAULT_LAUNCH_DELAY = 8000;		// Delay in ticks before firing, in case we've made an error.
const ON_ERROR_SLEEP_DELAY = 100;
const NUKER_EARLY_READY_WARNING = 500;
const NUKER_PRETARGET = 100;			// Number of ticks before launch to finalize target selection
const NUKE_RADIUS = 2;


DEFINE_CACHED_GETTER(StructureNuker.prototype, 'armed', s => s.energy >= s.energyCapacity && s.ghodium >= s.ghodiumCapacity);
DEFINE_CACHED_GETTER(StructureNuker.prototype, 'ready', s => s.armed && s.cooldown <= 0);

StructureNuker.prototype.run = function () {
	if (this.cooldown > 1024 || this.isDeferred())
		return;

	if (this.cooldown === NUKER_EARLY_READY_WARNING)
		Log.notify(`Silo in ${this.pos.roomName} will be operational in ${this.cooldown} ticks`);

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

	this.processTargets();
};

/**
 * 
 */
StructureNuker.prototype.processTargets = function () {
	var job, q = this.getQueue();
	if (!(job = q[0]))
		return;
	this.say(`${job.room} (${job.tick - Game.time})`, 'white');
	// If job is invalid, shift
	if (Game.time < job.tick - NUKER_PRETARGET || !this.ready)
		return;
	if (Game.map.getRoomLinearDistance(this.pos.roomName, job.room) > this.getRange())
		return q.shift();
	if (!job.pos) {
		return this.acquirePosition(job);
	}
	else {
		const visual = new RoomVisual(job.pos.roomName);
		visual.rect(
			-0.5 + job.pos.x - NUKE_RADIUS,
			-0.5 + job.pos.y - NUKE_RADIUS,
			(0.5 + NUKE_RADIUS) * 2,
			(0.5 + NUKE_RADIUS) * 2);
	}
	// If we have a delay, wait it out.
	if (job.tick - Game.time < 10)
		Log.warn(`${this.pos.roomName}: Firing in ${job.tick - Game.time}`, 'Nuker');
	if (Game.time < job.tick)
		return;
	try {
		const pos = _.create(RoomPosition.prototype, job.pos);
		Log.warn(`${this.pos.roomName}: Firing at ${pos}`, 'Nuker');
		// launchNuke
		const status = this.launchNuke(pos);
		if (status !== OK)
			Log.error(`${this.pos.roomName}: Launch to ${pos} failed with status ${status}`, 'Nuker');
	} catch (e) {
		Log.error(`${this.pos.roomName}: Silo exception ${e}`, 'Nuker');
		Log.error(e.stack, 'Nuker');
		this.defer(ON_ERROR_SLEEP_DELAY);
	}
	q.shift();
	// Adjust timer on next job
	if (q.length) {
		job = q[0];
		job.tick = Game.time + 1 + (NUKER_COOLDOWN - DEFAULT_LAUNCH_DELAY); // Line up for cooldown
	}
};

/**
 * Spawn filler to reload us.
 */
const NUKER_FILLER_BODY = Util.RLD([4, CARRY, 4, MOVE]);
StructureNuker.prototype.runReload = function () {
	if (this.ghodium >= this.ghodiumCapacity)
		return ERR_FULL;
	const [spawn] = this.getClosestSpawn();
	const { terminal } = this.room;
	const memory = { role: 'filler', src: terminal.id, dest: this.id, res: RESOURCE_GHODIUM, amt: this.ghodiumCapacity - this.ghodium };
	spawn.submit({ body: NUKER_FILLER_BODY, memory, priority: PRIORITY_MIN });
	return OK;
};

/**
 * Monkey patch nuker to prevent friendly targets
 */
const { launchNuke } = StructureNuker.prototype;
StructureNuker.prototype.launchNuke = function (pos) {
	if (Game.rooms[pos.roomName] && Game.rooms[pos.roomName].my)
		throw new Error("Unable to nuke friendly rooms");
	const status = launchNuke.apply(this, arguments);
	if (status === OK)
		Log.notify(`Nuclear launch detected! ${this.pos.roomName} to ${pos}`);
	return status;
};


/**
 * Priority queue list of targets
 */
StructureNuker.prototype.submitTarget = function (job) {
	const destRoomName = (job.pos && job.pos.roomName) || job.room;
	if (!job.tick)
		job.tick = Game.time + DEFAULT_LAUNCH_DELAY;
	if (!job.score)
		job.score = this.scoreTask(job);
	if (job.pos && !job.room)
		job.room = job.pos.roomName;
	if (Game.map.getRoomLinearDistance(this.pos.roomName, destRoomName) > this.getRange())
		return ERR_INVALID_TARGET;
	var q = this.getQueue();
	var i = _.sortedLastIndex(q, job, 'score');
	q.splice(i, 0, job);
	Log.warn(`New target ${destRoomName} added to list`, 'Nuker');
	return OK;
};

/**
 * Assign a score to the job so we can maintain the priority queue.
 * @todo how do we want to score our targets?
 */
StructureNuker.prototype.scoreTask = function (job) {
	return job.tick;
};

StructureNuker.prototype.getQueue = function () {
	if (!this.memory.list)
		this.memory.list = [];
	return this.memory.list;
};

StructureNuker.prototype.clearQueue = function () {
	var q = this.getQueue();
	return q.splice(0, q.length);
};

StructureNuker.prototype.isIdle = function () {
	return (this.getQueue().length <= 0);
};

StructureNuker.prototype.getRange = function () {
	return Math.min(this.memory.range || NUKE_RANGE, NUKE_RANGE);
};

StructureNuker.prototype.setRange = function (range) {
	return (this.memory.range = Math.min(range, NUKE_RANGE));
};

/**
 * 
 */
StructureNuker.prototype.acquirePosition = function (job) {
	const room = Game.rooms[job.room];
	if (!room) {
		Log.debug(`${this.pos.roomName}: No visibility on ${job.room}`, 'Nuker');
		return this.room.observer.observeRoom(job.room);
	}
	// Target selection fun
	const g = new NukeGrid();
	const st = room.find(FIND_HOSTILE_STRUCTURES, { filter: Filter.unauthorizedHostile });
	if (!st || !st.length) {
		Log.warn(`${this.pos.roomName}: No valid targets in room`,'Nuker');
		return this.getQueue().shift();
	}
	st.forEach(s => {
		/* if (s.structureType === STRUCTURE_WALL) // Until we can make this work
			return;
		if (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER)
			return; */
		if (s.structureType === STRUCTURE_RAMPART)
			g.sub(s.hits);
		// g.add(s.hits);
		g.applyInRadius((dx, dy) => g.add(dx, dy, s.hits),
			s.pos.x, s.pos.y, NUKE_RADIUS
		);
	});
	room.find(FIND_NUKES).forEach(n => g.applyInRadius( (dx,dy) => g.sub(dx,dy,NUKE_DAMAGE[2]), n.pos.x,n.pos.y,NUKE_RADIUS) );
	const [x, y, score] = g.getBestTarget();
	Log.warn(`${this.pos.roomName}: Target selection wants ${x},${y},${job.room} with score ${score}`, 'Nuker');
	job.pos = new RoomPosition(x, y, job.room);
};

class NukeGrid {
	constructor() {
		this.arr = [];
	}

	get(x, y) {
		if (this.arr[y] && this.arr[y][x] !== undefined)
			return this.arr[y][x];
		return 0;
	}

	set(x, y, v) {
		if (!this.arr[y])
			this.arr[y] = [];
		this.arr[y][x] = v;
		return v;
	}

	add(x, y, v) {
		this.set(x, y, (this.get(x, y) || 0) + v);
	}

	sub(x, y, v) {
		this.set(x, y, (this.get(x, y) || 0) - v);
	}

	applyInRadius(fn, ax, ay, radius) {
		var dx, dy;
		for (dx = -radius; dx <= radius; dx++)
			for (dy = -radius; dy <= radius; dy++)
				fn.call(this, ax + dx, ay + dy);
		return this;
	}

	getBestTarget() {
		var pos, score = -Infinity, i;
		for (var x = 0; x < 50; x++) {
			for (var y = 0; y < 50; y++) {
				i = this.get(x, y) || 0;
				if (i <= score)
					continue;
				score = i;
				pos = [x, y, score];
			}
		}
		return pos;
	}

	toString() { return "[Grid]"; }
}
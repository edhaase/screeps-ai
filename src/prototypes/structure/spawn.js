/**
 * ext/structure.spawn.js - Unit Factory
 * 
 *	The spawn structure is the creep factory. It's one of the most critical structures,
 * if not _the_ most. Without one of these we don't have creeps, and creeps are required
 * for everything.
 *
 * This also supports opportunistic renewels, using a lookForAtArea call to find adjacent creeps,
 * and a Creep prototype extension to check if it's a renewel candidate.
 *
 * See: http://docs.screeps.com/api/#StructureSpawn
 */
'use strict';

/* global Log, DEFAULT_SPAWN_JOB_EXPIRE, DEFAULT_SPAWN_JOB_PRIORITY */
/* global RENEW_COST, RENEW_TICKS, UNIT_BUILD_TIME, SHARD_TOKEN */

/* eslint-disable no-magic-numbers */
import { ENV, MAKE_CONSTANT } from '/os/core/macros';
import { MM_AVG } from '/os/core/math';
import { SHARD_TOKEN } from '/os/core/constants';
import { tailSort } from '/Unit';
import ROLES from '/role/index';
import RouteCache from '/cache/RouteCache';
import { Log, LOG_LEVEL } from '/os/core/Log';

MAKE_CONSTANT(global, 'PRIORITY_MIN', 100);
MAKE_CONSTANT(global, 'PRIORITY_LOW', 75);
MAKE_CONSTANT(global, 'PRIORITY_MED', 50);
MAKE_CONSTANT(global, 'PRIORITY_HIGH', 25);
MAKE_CONSTANT(global, 'PRIORITY_MAX', 0);

// _.map(Memory.rooms['W2N7'].sq, 'memory.role')
// _.map(Memory.rooms['W2N7'].sq, 'score')
// _.map(Memory.rooms['W2N7'].sq, 'memory.home')
// _.invoke(Game.structures, 'runCensus')
// Idle times: ex(_.map(Memory.spawns, (s,name) => ({name, idle: Game.time - s.lastidle})))

// Notes on spawn utilization and renew:
// _.map(Game.spawns, s => _.round(s.memory.u,3))
// With oppoturnistic renewels: (0.3785 avg) 0.18,0.671,0.268,0.161,0.702,0.151,0.444,0.468,0.6,0.236
// Without (but half broken) (0.2694) 0.017,0.644,0.069,0.574,0.614,0.372,0.169,0.212,0.017,0.011
// Without opp renewels: (.312 avg) 0.53,0.183,0.527,0.259,0.328,0.333,0.094,0.247,0.29,0.383
// (0.226) 0.127,0.167,0.257,0.266,0.358,0.288,0.343,0.198,0.087,0.183
// (0.092) 0.054,0.071,0.151,0.097,0.286,0.11,0.03,0.029,0.044,0.046 

MAKE_CONSTANT(global, 'DEFAULT_SPAWN_JOB_EXPIRE', 60);
MAKE_CONSTANT(global, 'DEFAULT_SPAWN_JOB_PRIORITY', 50);
MAKE_CONSTANT(global, 'MAX_CREEP_SPAWN_TIME', MAX_CREEP_SIZE * CREEP_SPAWN_TIME);
MAKE_CONSTANT(global, 'MAX_PARTS_PER_GENERATION', CREEP_LIFE_TIME / CREEP_SPAWN_TIME);

const DEFAULT_EXPIRATION_SWEEP = 15; // Number of ticks between eviction sweeps
const ON_ERROR_SLEEP_DELAY = 50;
// Math.ceil((SPAWN_RENEW_RATIO * 10) / CREEP_SPAWN_TIME / 1)
// Math.ceil((SPAWN_RENEW_RATIO * 50) / CREEP_SPAWN_TIME / 1)
// Min renew cost for single tough: 4 energy,
// Min for single move: 20 energy
// Math.floor((SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME) / parts)
// score = (SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME)
/**
 *
 */
StructureSpawn.prototype.run = function () {
	this.memory.u = MM_AVG((this.spawning ? 1 : 0), this.memory.u, CREEP_LIFE_TIME);

	// this.say('U: ' + _.round(this.memory.u,2), this.pos, {color: 'yellow'});	
	//if(this.spawning && !(Game.time&2))
	//	this.say(this.spawning.name);
	if ((Game.time & DEFAULT_EXPIRATION_SWEEP) === 0)
		this.removeExpiredJobs();
	if (this.spawning && this.spawning.remainingTime === 0)
		this.lookForNear(LOOK_CREEPS, true, 1).forEach(l => l['creep'].scatter());
	if (this.spawning || this.isDeferred())
		return;
	if (this.processJobs() !== true && this.isRenewActive())
		this.renewAdjacent();
};

StructureSpawn.prototype.generateName = function (job) {
	if (ENV('spawn.name_randomize', true) === false)
		return `${job.memory.role}${this.getNextId()}`;
	// return `${this.getNextId(36)}${job.memory.role.slice(0,2)}`;
	return `${this.getNextId(36)}`;
	/* const [low, high] = ENV('spawn.name.charset', [0x2800, 0x28FF]);
	const c = _.random(low, high - 1);
	return `${String.fromCodePoint(c & 0x3FFF)}${this.getNextId()}`; */
};

StructureSpawn.prototype.processJobs = function () {
	const q = this.getQueue(), [job] = q;
	if (!job) {
		// No job, can't be waiting on energy.
		if (this.memory.e)
			this.resetEnergyClock();
		return false;
	}

	if ((job.expire && Game.time > job.expire) || job.cost > this.room.energyCapacityAvailable) {
		q.shift();
		return this.processJobs(); // Recursively try again.
	}

	if (job.cost > this.room.energyAvailable) {
		// Log.warn('Should ignore spawn job, not enough energy!')
		this.memory.e = (this.memory.e || 0) + 1;
		var role = (job.memory && job.memory.role) || 'Unknown';
		this.say(`${role} ${job.cost - this.room.energyAvailable}`);
		return true;
	}

	var assignedName = job.name || this.generateName(job);
	var result = this.spawnCreep(job.body, assignedName, { memory: job.memory, cost: job.cost, directions: job.directions, group: job.memory.gid });
	if (result !== OK) {
		Log.error(`${this.pos.roomName}/${this.name} failed to create creep, status: ${result}`, 'Spawn');
		if (result === ERR_RCL_NOT_ENOUGH)
			this.defer(ON_ERROR_SLEEP_DELAY);
		return false;
	}

	Memory.creeps[assignedName].born = Game.time + job.ticks;
	var idle = Game.time - (this.memory.lastidle || Game.time);
	Log.info(`${this.pos.roomName}/${this.name}: New ${job.memory.role} unit: ${assignedName}, cost: ${job.cost}, ticks: ${job.ticks}, priority: ${job.priority}, idle: ${idle}, score: ${job.score}`, 'Spawn');
	// Log.info(`${this.pos.roomName}/${this.name}: New ${job.memory.role} unit: ${name}, cost ${job.cost}, ticks ${job.ticks}, priority ${job.priority}, idle ${idle}`, 'Spawn');
	if (job.notify === true)
		Game.notify(`Tick ${Game.time}: ${this.pos.roomName}/${this.name}: New ${job.memory.role} unit: ${assignedName}, cost: ${job.cost}, ticks: ${job.ticks}, priority: ${job.priority}, idle: ${idle}`);
	if (job.memory && job.memory.role)
		this.initCreep(assignedName, job.memory.role, job);
	const creep = Game.creeps[assignedName];
	if (job.memory && job.memory.home && job.memory.home !== this.pos.roomName) { // The rest of this check doesn't make sense && Game.map.isRoomAvailable(job.memory.home)) {
		if (job.boosts)
			job.boosts.forEach(b => creep.pushState('BoostSelf', { boost: b }));
		creep.pushState('MoveToRoom', job.memory.home);
	}
	if (job.boosts)
		job.boosts.forEach(b => creep.pushState('BoostSelf', { boost: b }));
	if (job.notifyWhenAttacked !== true)
		creep.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });

	q.shift();
	this.memory.lastidle = Game.time + job.ticks;
	this.resetEnergyClock();
	return true;
};

/**
 * Call the role init code if there is any
 */
StructureSpawn.prototype.initCreep = function (name, roleName, job) {
	try {
		// const role = require(`role.${roleName}`);
		const role = ROLES[roleName];
		const creep = Game.creeps[name];
		if (role && role.init)
			role.init.call(creep, job);
	} catch (e) {
		Log.error(`${this.pos.roomName}/${this.name} failed to initialize creep ${name}`, 'Spawn');
		Log.error(e.stack);
	}
};

/**
 * Incremental rolling number to prevent creep collisions. Combine with
 * initial role to further increase potential number of names.
 */
const CREEP_ID_ROLLOVER = 10000;
StructureSpawn.prototype.getNextId = function (base = 10) {
	if (Memory.creepnum == null)
		Memory.creepnum = 0;
	const creepNum = Memory.creepnum++ % CREEP_ID_ROLLOVER;
	return `${SHARD_TOKEN}${creepNum.toString(base).toUpperCase()}`;
};

StructureSpawn.prototype.resetEnergyClock = function () {
	if (this.memory.e > 3)
		Log.debug(`Energy clock reset after ${this.memory.e} ticks`, 'Spawn');
	// this.memory.edelay = CM_AVG(this.memory.e || 0, this.memory.edelay || 0, 25);
	var test = this.memory.edelay;
	this.memory.edelay = MM_AVG(this.memory.e || 0, this.memory.edelay, 25);
	// Log.debug(`edelay mmAvg (${this.memory.e || 0}) ${test} --> ${this.memory.edelay}`, 'Spawn');
	this.memory.e = undefined;
	return this;
};

StructureSpawn.prototype.getQueue = function () {
	if (!this.room.memory.sq)
		this.room.memory.sq = [];
	return this.room.memory.sq;
};

StructureSpawn.prototype.clearQueue = function () {
	var q = this.getQueue();
	return q.splice(0, q.length);
};

StructureSpawn.prototype.isIdle = function () {
	return (this.getQueue().length <= 0);
};

/**
 * Submit a spawn task to the queue.
 * 
 * example: {body,memory,priority,room,expire}
 */
StructureSpawn.prototype.submit = function (job) {
	if (!job.memory)
		throw new Error("Expected job memory");
	if (job.body == null && job.memory && job.memory.role) {
		// const role = require(`role.${job.memory.role}`);
		const role = ROLES[job.memory.role];
		job.body = (role.body && role.body(this, job)) || role.minBody;
	}
	if (!_.isArray(job.body) || job.body.length === 0)
		throw new Error(`${this.pos.roomName} Enqueue failed, bad body: ${job.body} Job: ${JSON.stringify(job)}`);
	if (job.body.length > MAX_CREEP_SIZE)
		throw new Error(`Creep body may not exceed ${MAX_CREEP_SIZE} parts: ${job.body.length} requested, body [${JSON.stringify(_.countBy(job.body))}]`);
	if (job.expire == null)
		job.expire = Game.time + DEFAULT_SPAWN_JOB_EXPIRE;
	else if (job.expire === 0 || job.expire === Infinity)
		Log.warn(`No expiration set on ${job.memory.role}`, 'Spawn');
	else if (job.expire < Game.time)
		job.expire += Game.time;
	if (!job.cost)
		job.cost = _.sum(job.body, part => BODYPART_COST[part]);
	if (!job.ticks)
		job.ticks = UNIT_BUILD_TIME(job.body);
	if (job.cost > this.room.energyCapacityAvailable)
		throw new Error(`${this.pos.roomName}: Unit cost would exceed room energy capacity`);
	if (job.priority == null)
		job.priority = DEFAULT_SPAWN_JOB_PRIORITY;
	if (job.priority > 0 && job.priority < 1)
		job.priority = Math.ceil(100 * job.priority);
	if (!job.boosts && job.memory && job.memory.role)
		job.boosts = ROLES[job.memory.role].boosts;
	if (job.boosts && _.any(job.boosts, b => !RESOURCES_ALL.includes(b)))
		throw new Error(`Invalid boosts ${job.boosts} for job`);
	job.body = tailSort(job.body);
	if (!job.score)
		job.score = this.scoreTask(job);
	var q = this.getQueue();
	var i = _.sortedLastIndex(q, job, 'score');
	q.splice(i, 0, job);
	Log.debug(`${this.pos.roomName}: Requesting new ${job.memory.role}, cost: ${job.cost}, ticks: ${job.ticks}, priority: ${job.priority}, expiration: ${job.expire - Game.time} (${job.expire}), score: ${job.score}`, 'Spawn');
	return job.ticks;
};

/**
 * Assign a score to the job so we can maintain the priority queue.
 *
 * Note: As tempting as it is to use structure.specific stats to adjust the score,
 * it should be avoided since all spawns share a room-level queue.
 *
 * Note: If two tasks are the same priority, go by cost rather than ticks so pilots can take priority.
 */
StructureSpawn.prototype.scoreTask = function (task) {
	/* global Route */
	var home = task.room || (task.memory && task.memory.home) || this.pos.roomName;
	var dist = 0;
	var ownedRoom = !!(Game.rooms[home] && Game.rooms[home].my);
	if (home !== this.pos.roomName)
		dist = RouteCache.findRoute(this.pos.roomName, home).length || 1;
	//return (!ownedRoom << 30) | (Math.min(dist, 63) << 24) | ((100 - task.priority) << 16) | Math.min(task.cost, 65535);
	return (!ownedRoom << 30) | (Math.min(dist, 63) << 24) | (task.priority << 16) | Math.min(task.cost, 65535);
};

// 2017-04-14: Back to just expiration. Bad jobs should never make it into the queue.
// 2016-11-7: Now removes bad bodies when run.
StructureSpawn.prototype.removeExpiredJobs = function () {
	// var removed = _.remove(this.getQueue(), j => (j.expire && Game.time > j.expire) || _.isEmpty(j.body) || this.canCreateCreep(j.body) === ERR_INVALID_ARGS);
	var removed = _.remove(this.getQueue(), j => (j.expire && Game.time > j.expire));
	if (removed && removed.length > 0) {
		const roles = _.map(removed, 'memory.role');
		Log.warn(`${this.pos.roomName}: Purging ${removed.length} jobs: ${roles}`, 'Spawn');
		// Log.warn(roles, 'Spawn');
	}
};

/**
 * Monkey patch createCreep so multiple spawns can operate in the same tick.
 */
const { spawnCreep } = StructureSpawn.prototype;
StructureSpawn.prototype.createCreep = null; // Prevent the deprecated method from being callable

StructureSpawn.prototype.spawnCreep = function (body, name, opts = {}) {
	// opts.energyStructures = this.getProviderCache();
	const result = spawnCreep.call(this, body, name, opts);
	if (result === OK)
		this.room.energyAvailable -= (opts.cost || _.sum(body, part => BODYPART_COST[part]));
	return result;
};

StructureSpawn.prototype.getProviderCache = function () {
	if (!this.cache.ext || (Game.time - this.cache.last) > 300) {
		this.cache.last = Game.time;
		let providers = this.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN });
		if (this.room.storage || this.room.terminal)
			providers = _.sortBy(providers, e => e.pos.getRangeTo(this.room.storage || this.room.terminal));
		this.cache.ext = providers.map(s => ({ id: s.id }));
		Log.info(`${this.name} Recaching providers: ${this.cache.ext}`, 'Spawn');
	}
	// return _.map(this.cache.ext, id => Game.getObjectById(id));
	return this.cache.ext;
};

/**
 * Monkey patch renew creep so multiple spawns have the correct information.
 */
const { renewCreep } = StructureSpawn.prototype;
StructureSpawn.prototype.renewCreep = function (creep) {
	const status = renewCreep.call(this, creep);
	if (status === OK) {
		const ticksToLive = Math.min(CREEP_LIFE_TIME, creep.ticksToLive + RENEW_TICKS(creep.body));
		const cost = RENEW_COST(creep.body);
		this.room.energyAvailable -= cost;
		Object.defineProperty(creep, 'ticksToLive', { value: ticksToLive, configurable: true });
		this.resetEnergyClock(); // If we can renew, we probably aren't waiting on energy
		// console.log(`Renewing ${creep.name} (${creep.pos}) for ${bonus} ticks at ${cost} energy`);
	} else {
		Log.warn(`${this.name} renewing ${creep.name} at ${creep.pos} status ${status}`, 'Spawn');
	}
	return status;
};

StructureSpawn.prototype.renewAdjacent = function () {
	const adj = _.map(this.lookForNear(LOOK_CREEPS, true), LOOK_CREEPS);
	const creep = _.find(adj, c => c.canRenew());
	if (!creep)
		return;
	// console.log('Spawn ' + this.name + ' renewing ' + creep.name + ' at ' + creep.pos);
	creep.say('\u2615', true);
	this.renewCreep(creep);
};

/**
 * Enable or disable spawn renew
 */
StructureSpawn.prototype.setRenewActive = function (state) {
	this.memory.renew = state;
};

/**
 * Boolean true/false for whether this spawn is willing to renew.
 * Does not guarantee renews.
 */
StructureSpawn.prototype.isRenewActive = function () {
	if (this.isDefunct() || !this.isIdle())
		return false;
	//if(this.room.controller.level < 3)
	//	return (this.spawning == undefined && !BUCKET_LIMITER && this.getQueue().length <= 0);
	return (this.spawning == null);
};

/**
 * Check for a pending job matching what we want.
 */
StructureSpawn.prototype.hasJob = function (job) {
	// Log.info('test where ' + this.name + ' has ' + JSON.stringify(job) + ': ' +  _.findWhere(this.getQueue(), job));
	return _.findWhere(this.getQueue(), job);
};

/**
 *
 */
global.DEFUNCT_SPAWN_TICKS = 300;
StructureSpawn.prototype.isDefunct = function () {
	if (!this.room.my) // cheaper isActive check with the room-level spawn queue
		return true;
	if (this.room.energyAvailable >= this.room.energyCapacityAvailable)
		return false;
	if (this.spawning && this.spawning.remainingTime === 0 && Game.time - Game.creeps[this.spawning.name].memory.born > 1)
		return true;
	return !!(Math.ceil(1 + this.memory.edelay) >= DEFAULT_SPAWN_JOB_EXPIRE);
	// return Boolean(this.memory.e && this.memory.e > DEFUNCT_SPAWN_TICKS);
	// var jobs = this.getAvailJobs();	
	// this.room.energyAvailable < 50	
	// return (this.getQueue().length > 0 && this.memory.lastidle != undefined && ((Game.time - this.memory.lastidle) > defunctTimer));
};
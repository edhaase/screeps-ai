/**
 * ext-structure-spawn.js - Unit Factory
 * 
 *	The spawn structure is the creep factory. It's one of the most critical structures,
 * if not _the_ most. Without one of these we don't have creeps, and creeps are required
 * for everything.
 *
 * Notable mention is that in this design the spawn makes no decisions about what we want
 * to spawn. We can have multiple spawns in a room that run as seperate entities,
 * so it only follows orders set forth in the priority queue. Each spawn in the
 * room shares a queue with the others in it's room. The spawn a job is submitted to may not
 * be the spawn that actually creates the creep.
 *
 * This also supports opportunistic renewels, using a lookForAtArea call to find adjacent creeps,
 * and a Creep prototype extension to check if it's a renewel candidate.
 *
 * Both renewCreep and createCreep adjust the room's energyAvailable if they succeed,
 * so that next spawn in the room to run gets accurate state and reduces intent conflicts.
 *
 * @todo Consider secondary priority of ticks instead of cost. 
 *
 * See: http://support.screeps.com/hc/en-us/articles/205990342-StructureSpawn
 * 
 * Max energy capacity available per level (for defining our creep body limits):
 *		RCL 1 - 300
 *		RCL 2 - 550
 *		RCL 3 - 		(Reservers begin here)
 *		RCL 4 - 1300
 *		RCL 5 -
 *		RCL 6 -		(Dual source miners start here)
 *		RCL 7 -
 *		RCL 8 -
 *
 *
 *
 */
"use strict";

// _.map(Memory.rooms['W2N7'].sq, 'memory.role')
// _.map(Memory.rooms['W2N7'].sq, 'score')
// _.map(Memory.rooms['W2N7'].sq, 'memory.home')
// _.invoke(Game.structures, 'runCensus')
// Idle times: ex(_.map(Memory.spawns, (s,name) => ({name, idle: Game.time - s.lastidle})))

// Notes on spawn utilization and renew:
// _.map(Game.spawns, s => _.round(s.memory.u,3))
//  Util.avg(Game.spawns, s => _.round(s.memory.u,3))
// With oppoturnistic renewels: (0.3785 avg) 0.18,0.671,0.268,0.161,0.702,0.151,0.444,0.468,0.6,0.236
// Without (but half broken) (0.2694) 0.017,0.644,0.069,0.574,0.614,0.372,0.169,0.212,0.017,0.011
// Without opp renewels: (.312 avg) 0.53,0.183,0.527,0.259,0.328,0.333,0.094,0.247,0.29,0.383
// (0.226) 0.127,0.167,0.257,0.266,0.358,0.288,0.343,0.198,0.087,0.183
// (0.092) 0.054,0.071,0.151,0.097,0.286,0.11,0.03,0.029,0.044,0.046 


global.DEFAULT_SPAWN_JOB_EXPIRE = 60;
global.MAX_CREEP_SPAWN_TIME = MAX_CREEP_SIZE * CREEP_SPAWN_TIME;
global.MAX_PARTS_PER_GENERATION = CREEP_LIFE_TIME / CREEP_SPAWN_TIME;


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
	this.memory.u = Math.cmAvg((this.spawning ? 1 : 0), this.memory.u, CREEP_LIFE_TIME);

	// this.say('U: ' + _.round(this.memory.u,2), this.pos, {color: 'yellow'});	
	//if(this.spawning && !(Game.time&2))
	//	this.say(this.spawning.name);
	if ((Game.time & 15) === 0)
		this.removeExpiredJobs();
	if (this.spawning || this.isDeferred())
		return;
	if (this.processJobs() !== true && this.isRenewActive())
		this.renewAdjacent();
};

StructureSpawn.prototype.processJobs = function () {
	var job, q = this.getQueue();
	if (!(job = q[0])) {
		// No job, can't be waiting on energy.
		if (this.memory.e)
			this.resetEnergyClock();
		return false;
	}

	if (job.expire && Game.time > job.expire) {
		q.shift();
		return this.processJobs(); // Recursively try again.
	}

	if (job.cost > this.room.energyAvailable) {
		// Log.warn('Should ignore spawn job, not enough energy!')
		this.memory.e = (this.memory.e || 0) + 1;
		this.say(job.cost - this.room.energyAvailable);
		return true;
	}

	var assignedName = job.name || `${job.memory.role}${this.getNextId()}`;
	var result = this.spawnCreep(job.body, assignedName, { memory: job.memory, cost: job.cost });
	if (result !== OK) {
		Log.error(`${this.pos.roomName}/${this.name} failed to create creep, status: ${result}`, 'Spawn');
		if (result === ERR_RCL_NOT_ENOUGH)
			this.defer(50);
		return false;
	}

	Memory.creeps[assignedName].born = Game.time + job.ticks;
	var idle = Game.time - (this.memory.lastidle || Game.time);
	Log.info(`${this.pos.roomName}/${this.name}: New ${job.memory.role} unit: ${assignedName}, cost: ${job.cost}, ticks: ${job.ticks}, priority: ${job.priority}, idle: ${idle}`, 'Spawn');
	// Log.info(`${this.pos.roomName}/${this.name}: New ${job.memory.role} unit: ${name}, cost ${job.cost}, ticks ${job.ticks}, priority ${job.priority}, idle ${idle}`, 'Spawn');
	if (job.notify === true)
		Game.notify(`Tick ${Game.time}: ${this.pos.roomName}/${this.name}: New ${job.memory.role} unit: ${assignedName}, cost: ${job.cost}, ticks: ${job.ticks}, priority: ${job.priority}, idle: ${idle}`);
	if (job.memory && job.memory.role)
		_.attempt(() => require(`role-${job.memory.role}`).init(Game.creeps[assignedName]));
	q.shift();
	this.memory.lastidle = Game.time + job.ticks;
	this.resetEnergyClock();
	return true;
};

/**
 * Incremental rolling number to prevent creep collisions. Combine with
 * initial role to further increase potential number of names.
 */
const CREEP_ID_ROLLOVER = 1000;
StructureSpawn.prototype.getNextId = function () {
	if (Memory.creepnum == null)
		Memory.creepnum = 0;
	return Memory.creepnum++ % CREEP_ID_ROLLOVER;
};

StructureSpawn.prototype.resetEnergyClock = function () {
	if (this.memory.e > 3)
		Log.debug(`Energy clock reset after ${this.memory.e} ticks`, 'Spawn');
	// this.memory.edelay = Math.cmAvg(this.memory.e || 0, this.memory.edelay || 0, 25);
	var test = this.memory.edelay;
	this.memory.edelay = Math.mmAvg(this.memory.e || 0, this.memory.edelay, 25);
	Log.debug(`edelay mmAvg (${this.memory.e || 0}) ${test} --> ${this.memory.edelay}`, 'Spawn');
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
 * enqueue - Push work order for later
 *
 * @param Number priority - Expects integer 0 to 100 percent priority
 *
 * example: Game.spawns.Spawn1.enqueue([CARRY,CARRY,MOVE], null, {role: 'scav'}, 0, 0, 5)
 */
StructureSpawn.prototype.enqueue = function enqueue(body, name = null, memory = {}, priority = 1, delay = 0, count = 1, expire = DEFAULT_SPAWN_JOB_EXPIRE) {
	if (_.isObject(name))
		throw new TypeError("Did you forget an explicit null for name?");
	// Score once and add ticks once.
	var job = {
		body: body,
		name: name,
		memory: _.assign({}, memory),
		priority: priority,
		expire: (expire) ? (Game.time + expire) : Infinity
	};
	if (delay > 1)
		Log.warn("Delay is not implemented");
	if (count < 1) {
		Log.notify(`Count must be one or greater, ${count} provided`);
		throw new Error(`Count must be one or greater, ${count} provided`);
	}
	for (var i = 0; i < count; i++)
		this.submit(job);
	return job.ticks;
};

/**
 * Similar to enqueue but takes a fully built job object
 */
StructureSpawn.prototype.submit = function (job) {
	if (!_.isArray(job.body) || job.body.length === 0)
		throw new Error(`Enqueue failed, bad body: ${job.body}`);
	if (job.body.length > MAX_CREEP_SIZE)
		throw new Error(`Body part may not exceed ${MAX_CREEP_SIZE} parts`);
	if (!job.expire || job.expire === Infinity)
		Log.warn(`No expiration set on ${job.memory.role}`, 'Spawn');
	if (!job.cost)
		job.cost = _.sum(job.body, part => BODYPART_COST[part]);
	if (!job.ticks)
		job.ticks = job.body.length * CREEP_SPAWN_TIME;
	if (job.cost > this.room.energyCapacityAvailable)
		throw new Error("Unit cost would exceed room energy capacity");
	job.body = require('Unit').tailSort(job.body);
	if (!job.score)
		job.score = this.scoreTask(job);
	var q = this.getQueue();
	var i = _.sortedLastIndex(q, job, 'score');
	q.splice(i, 0, job);
	Log.debug(`${this.pos.roomName}: Requesting new ${job.memory.role}, cost: ${job.cost}, ticks: ${job.ticks}, priority ${job.priority}, expiration: ${job.expire - Game.time} (${job.expire})`, 'Spawn');
	return job.ticks;
};

/**
 * Assign a score to the job so we can maintain the priority queue.
 *
 * Note: As tempting as it is to use structure-specific stats to adjust the score,
 * it should be avoided since all spawns share a room-level queue.
 *
 * Note: If two tasks are the same priority, go by cost rather than ticks so pilots can take priority.
 */
StructureSpawn.prototype.scoreTask = function (task) {
	var home = _.get(task, 'memory.home', this.pos.roomName);
	var dist = 0;
	if (home !== this.pos.roomName)
		dist = Game.map.findRoute(this.pos.roomName, home).length || 1;
	return (dist << 24) | ((100 - task.priority) << 16) | task.cost;
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
const { createCreep, spawnCreep } = StructureSpawn.prototype;
StructureSpawn.prototype.createCreep = function (body, name, memory, cost) {
	const result = createCreep.apply(this, arguments);
	if (typeof result === 'string')
		this.room.energyAvailable -= (cost || _.sum(body, part => BODYPART_COST[part]));
	return result;
};

StructureSpawn.prototype.spawnCreep = function (body, name, opts = {}) {
	const result = spawnCreep.apply(this, arguments);
	if (result === OK)
		this.room.energyAvailable -= (opts.cost || _.sum(body, part => BODYPART_COST[part]));
	return result;
};

/**
 * Monkey patch renew creep so multiple spawns have the correct information.
 */
const { renewCreep } = StructureSpawn.prototype;
StructureSpawn.prototype.renewCreep = function (creep) {
	const status = renewCreep.call(this, creep);
	Log.debug(`${this.name} renewing ${creep.name} at ${creep.pos} status ${status}`, 'Spawn');
	if (status === OK) {
		const bonus = Math.floor(SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME / creep.body.length);
		const ticksToLive = Math.min(CREEP_LIFE_TIME, creep.ticksToLive + bonus);
		const cost = Math.ceil(SPAWN_RENEW_RATIO * creep.cost / CREEP_SPAWN_TIME / creep.body.length);
		this.room.energyAvailable -= cost;
		Object.defineProperty(creep, 'ticksToLive', { value: ticksToLive, configurable: true });
		// console.log(`Renewing ${creep.name} (${creep.pos}) for ${bonus} ticks at ${cost} energy`);
	}
	return status;
};

StructureSpawn.prototype.renewAdjacent = function () {
	/* var creep = this.getTargetDeep(
		() => _.map(this.lookForNear(LOOK_CREEPS, true), LOOK_CREEPS),
		(c) => this.pos.isNearTo(c) && c.canRenew(),
		_.first,
		'cache.cid'
	) */
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
	return (this.spawning == null && !BUCKET_LIMITER);
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
	if (this.room.energyAvailable >= this.room.energyCapacityAvailable)
		return false;
	return Boolean(Math.ceil(1 + this.memory.edelay) >= DEFAULT_SPAWN_JOB_EXPIRE);
	// return Boolean(this.memory.e && this.memory.e > DEFUNCT_SPAWN_TICKS);
	// var jobs = this.getAvailJobs();	
	// this.room.energyAvailable < 50	
	// return (this.getQueue().length > 0 && this.memory.lastidle != undefined && ((Game.time - this.memory.lastidle) > defunctTimer));
};
/**
 * ext-room.js - Because not everything is driven by room controllers
 *
 * Chance of invasion goes up with amount mined. Roughly around 73k is the lowest it goes.
 * Around 73k to 120k we should consider defense creeps.
 */
'use strict';

/* global DEFINE_CACHED_GETTER, Player, Filter, CRITICAL_INFRASTRUCTURE, Log */

global.BIT_LOW_POWER = (1 << 1);
global.BIT_DISABLE_CONSTRUCTION = (1 << 2);
global.BIT_DISABLE_REPAIR = (1 << 3);

if (!Memory.rooms) {
	Log.warn('Initializing room memory', 'Memory');
	Memory.rooms = {};
}

/**
 * Room properties
 */
DEFINE_CACHED_GETTER(Room.prototype, 'structures', r => r.find(FIND_STRUCTURES) || []);
DEFINE_CACHED_GETTER(Room.prototype, 'structuresMy', r => r.find(FIND_MY_STRUCTURES) || []);
DEFINE_CACHED_GETTER(Room.prototype, 'structuresByType', r => _.groupBy(r.structures, 'structureType'));
DEFINE_CACHED_GETTER(Room.prototype, 'structureCountByType', r => _.countBy(r.structures, 'structureType'));
DEFINE_CACHED_GETTER(Room.prototype, 'mineral', r => r.find(FIND_MINERALS)[0]);
DEFINE_CACHED_GETTER(Room.prototype, 'containers', r => r.structuresByType[STRUCTURE_CONTAINER] || []);
DEFINE_CACHED_GETTER(Room.prototype, 'hurtCreeps', r => r.find(FIND_CREEPS, { filter: c => c.hitPct < 1 && (c.my || Player.status(c.owner.username) === PLAYER_ALLY) }));
DEFINE_CACHED_GETTER(Room.prototype, 'nuker', r => r.findOne(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } }));
DEFINE_CACHED_GETTER(Room.prototype, 'observer', r => r.findOne(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_OBSERVER } }));
DEFINE_CACHED_GETTER(Room.prototype, 'resources', r => r.find(FIND_DROPPED_RESOURCES, { filter: Filter.droppedResources }));
DEFINE_CACHED_GETTER(Room.prototype, 'energyPct', r => r.energyAvailable / r.energyCapacityAvailable);

DEFINE_CACHED_GETTER(Room.prototype, 'creeps', r => r.find(FIND_MY_CREEPS) || []);
DEFINE_CACHED_GETTER(Room.prototype, 'creepsByRole', r => _.groupBy(r.creeps, c => c.getRole()));
DEFINE_CACHED_GETTER(Room.prototype, 'creepCountByRole', r => _.countBy(r.creeps, c => c.getRole()));
DEFINE_CACHED_GETTER(Room.prototype, 'sources', r => r.find(FIND_SOURCES));

/** Room ownership shortcuts */
DEFINE_CACHED_GETTER(Room.prototype, 'my', r => _.get(r, 'controller.my', false));
DEFINE_CACHED_GETTER(Room.prototype, 'owned', r => _.has(r, 'controller.owner.username'));
DEFINE_CACHED_GETTER(Room.prototype, 'owner', r => _.get(r, 'controller.owner.username'));
DEFINE_CACHED_GETTER(Room.prototype, 'reserved', r => _.has(r, 'controller.reservation.username'));
DEFINE_CACHED_GETTER(Room.prototype, 'reserver', r => _.get(r, 'controller.reservation.username'));

DEFINE_CACHED_GETTER(Room.prototype, 'FLEE_MATRIX', function (room) {
	const matrix = ARENA_MATRIX.clone();
	matrix.setFixedObstacles(room);
	matrix.setDynamicObstacles(room);
	matrix.setSKLairs(room);
	matrix.setCreeps(room);
	matrix.setRoads(room);
	return matrix;
});

/**
 * Pretty much true unless I don't own the room.
 */
DEFINE_CACHED_GETTER(Room.prototype, 'canMine', function ({ controller }) {
	if (controller == null)
		return true;
	if (controller.reservation && controller.reservation.username !== WHOAMI)
		return false;
	if (controller.owner && controller.owner.username !== WHOAMI)
		return false;
	return true;
});

/**
 * 2016-11-06: Safe mode rooms ignore hostiles
 * 2017-01-07: Threat value not needed to tell if hostile.
 */
DEFINE_CACHED_GETTER(Room.prototype, 'hostiles', function (room) {
	if (_.get(room, 'controller.safeMode', 0) < SAFE_MODE_IGNORE_TIMER) // abritary tick count before re-engaging
		return room.find(FIND_HOSTILE_CREEPS, { filter: c => Filter.unauthorizedHostile(c) && !c.pos.isOnRoomBorder() });
	return [];
});

/**
 * Each room has a 'state' we want to maintain.
 */
Room.prototype.run = function updateRoom() {
	if (!(Game.time & 3))
		this.updateThreats();

	if (!Memory.rooms[this.name])
		return;

	// let a = this.structures;

	this.execPendingCommands();
	this.updateBuild();
};

/**
 * Draw room-specific visuals. RoomObjects may draw their own.
 *
 */
Room.prototype.drawVisuals = function () {
	var { energyAvailable, energyCapacityAvailable } = this;
	drawPie(this.visual, energyAvailable, energyCapacityAvailable, "Energy", "#FFDF2E", 2);

	var { level, progress, progressTotal } = this.controller;
	if (level < MAX_ROOM_LEVEL)
		drawPie(this.visual, progress, progressTotal, 'RCL', 'green', 3);
};

/**
 * Inspired by the command processor, this allows
 * us to push commands to room memory to be ran
 * when the room regains visibility.
 *
 * ex: _.set(Memory.rooms, ['E58S40', 'cmd'], ['console.log("hi");'])
 */
Room.prototype.execPendingCommands = function () {
	if (!Memory.rooms[this.name] || !Memory.rooms[this.name].cmd)
		return;
	var cmds = this.memory.cmd;
	if (!cmds || !cmds.length)
		return;
	try {
		var cmd, r;
		while ((Game.cpu.getUsed() + 10 < Game.cpu.tickLimit) && cmds.length) {
			cmd = cmds.shift();
			r = eval(cmd);
			if (typeof r == 'function')
				r = r();
			console.log(`[RCOMMAND] Result: ${r}`);
		}
	} catch (e) {
		Log.error('Broken command');
	}
};

/**
 * Push a command to a room to be ran when we have visibility.
 *
 * @param string roomName
 * @param function|string cmd - string or function to run.
 *
 * ex: pushCommandToRoom('E58S41', 'console.log("hi")')
 * ex: pushCommandToRoom('E58S41', () => console.log('hi'))
 */
global.pushCommandToRoom = function (roomName, cmd) {
	if (!Memory.rooms[roomName])
		Memory.rooms[roomName] = {};
	if (!Memory.rooms[roomName].cmd)
		Memory.rooms[roomName].cmd = [];
	if (typeof cmd === 'function')
		cmd = cmd.toString();
	Memory.rooms[roomName].cmd.push(cmd);
};

/**
 * Calculate the origin of a room given our constraints.
 */
Room.prototype.getOrigin = function () {
	if (!this.memory.origin) {
		this.memory.origin = require('Planner').distanceTransformWithController(this) || { pos: this.controller.pos, range: 4 };
		Log.warn(`Found origin: ${this.memory.origin}`, 'Planner');
	}
	return { pos: _.create(RoomPosition.prototype, this.memory.origin), radius: 1 };
};

/***********************************************************************
 * Screeps build queue functionality
 *
 * Stores an array of things to build in a room,
 * places one at a time and waits for it to complete.
 *
 * Maintains priority-cost sorted array with sortedLastIndex
 ***********************************************************************/
Room.prototype.getBuildQueue = function () {
	if (!this.memory.bq)
		this.memory.bq = [];
	return this.memory.bq;
};

Room.prototype.clearBuildQueue = function () {
	delete this.memory.bq;
};

Room.prototype.isBuildQueueEmpty = function () {
	return (!Memory.rooms[this.name] || !Memory.rooms[this.name].bq || this.memory.bq.length <= 0);
};

/**
 * @param RoomPosition pos
 * @param string structureType
 *
 * @todo: Account for expiration? sortedLastIndex _kind_ of handles this, but currently cost is more important than expiration.
 * @todo: Need to account for extra cost of building swamp road (Actually it doesn't matter, still cheaper than anything else)
 */
Room.prototype.addToBuildQueue = function ({ x, y }, structureType, expire = DEFAULT_BUILD_JOB_EXPIRE, priority = DEFAULT_BUILD_JOB_PRIORITY) {
	if (!this.memory.bq)
		this.memory.bq = [];
	const terrain = Game.map.getRoomTerrain(this.name);
	if ((terrain.get(x, y) & TERRAIN_MASK_WALL) && structureType !== STRUCTURE_EXTRACTOR && structureType !== STRUCTURE_ROAD)
		throw new Error(`Invalid target position (${x},${y},${this.name} / ${structureType})`);
	if (this.getPositionAt(x, y).hasStructure(structureType))
		throw new Error(`Structure type ${structureType} already exists at ${x},${y},${this.name}`);
	if (structureType === STRUCTURE_ROAD && this.getPositionAt(x, y).hasObstacle(false))
		return OK;
	try {
		// sorted index for priority?
		var task = { x, y, structureType, expire: Game.time + expire, priority };
		var q = this.memory.bq;
		var indx = _.sortedLastIndex(q, task, ({ structureType, priority }) => -(((100 * priority) << 24) | CONSTRUCTION_COST[structureType]));
		q.splice(indx, 0, task);
	} catch (e) {
		Log.error(`Error in addToBuildQueue ${this.name}`, "Room");
		Log.error(e);
		Log.error(e.stack);
	}
	return OK;
};

/**
 * Only clears the queue when all sites finish or vanish. Time full build plan?
 * ex: Game.rooms['W7N3'].addToBuildQueue(new RoomPosition(38,12,'W7N3'), STRUCTURE_ROAD)
 */
Room.prototype.updateBuild = function () {
	if (this.isBuildQueueEmpty())
		return OK;
	if (this.memory.cid && Game.getObjectById(this.memory.cid))
		return ERR_BUSY;
	if (this.hostiles && this.hostiles.length)
		return ERR_BUSY;
	const [site] = this.find(FIND_MY_CONSTRUCTION_SITES, { filter: s => s.structureType !== STRUCTURE_CONTAINER });
	if (site) {
		this.memory.cid = site.id;
		return ERR_FULL;
	}
	delete this.memory.cid;
	Util.shiftWhile(this.memory.bq,
		({ x, y, structureType, expire }) => Game.time > expire || this.getPositionAt(x, y).hasStructure(structureType),
		(job) => Log.info(this.name + ': Job ' + ((Game.time > job.expire) ? 'expired' : 'completed') + ', ' + JSON.stringify(job), 'Room'));

	// Get a job. If we're using addToBuildQueue correctly, this will already
	// be sorted correctly (priority, expiration, cost)
	const [job] = this.getBuildQueue() || [];
	if (!job) {
		Log.info(`${this.name}: Build queue complete!`, 'Room');
		return OK;
	}
	var { x, y, structureType } = job;
	var pos = this.getPositionAt(x, y);
	// Stolen from kasami, build rampart first
	if (CRITICAL_INFRASTRUCTURE.includes(structureType)
		&& !pos.hasStructure(STRUCTURE_RAMPART)
		&& pos.createConstructionSite(STRUCTURE_RAMPART) === OK) // This might fail at RCL 1, let's not lock up the room.
		return OK;
	if (structureType === STRUCTURE_ROAD && pos.hasObstacle(false)) {
		Log.info(`Dropping ${structureType} from ${pos} due to obstacle`, 'Room');
		this.memory.bq.shift();
		return this.updateBuild();
	}
	var status = pos.createConstructionSite(structureType);
	switch (status) {
		case OK: {
			if (structureType === STRUCTURE_SPAWN && _.isEmpty(this.find(FIND_MY_SPAWNS))) {
				const smStatus = this.controller.activateSafeMode();
				Log.notify(`${this.name}: Activating safe mode to protect critical construction, status ${smStatus}`);
			}
			break;
		} case ERR_INVALID_TARGET:
			_.remove(this.memory.bq, _.matches(job));
			break;
		case ERR_RCL_NOT_ENOUGH:
			_.remove(this.memory.bq, j => j.structureType === structureType);
			break;
		default:
			Log.error(`Placing ${structureType} site at ${pos} status ${status}`, 'Room');
	}
	return OK;
};

/***********************************************************************
 * Screeps build plan functionality
 *
 * Stores an array of things we want in a room at given positions.
 * Unlike the build queue, this list is rarely rebuilt and does not
 * contain priorities _or_ expiration.
 *
 * If we find something missing from the world and we have
 * a high enough RCL to build it, we'll calculate a priority and push
 * it to the build queue for construction.
 *
 * Must always start from beginning of array, as structures in plan
 * are sorted by desired build order.
 ***********************************************************************/
Room.prototype.checkAgainstBuildPlan = function () {
	// Store roads in cost matrix / bit matrix?
	var plan = this.getBuildPlan();
	// var structures = this.structures;
	var missing = _.reject(plan, ({ x, y, structureType }) => this.getPositionAt(x, y).hasStructure(structureType));
	// var canBuild = CONTROLLER_STRUCTURES_LEVEL_FIRST[this.controller.level];
	return missing;
};

Room.prototype.getBuildPlan = function () {
	if (!SEGMENTS || !SEGMENTS[SEGMENT_BUILD])
		throw new Error("Build plan segment not loaded");
	var segment = SEGMENTS[SEGMENT_BUILD];
	return segment.data[this.name] || [];
};

Room.prototype.addToBuildPlan = function (x, y, structureType) {
	if (!SEGMENTS || !SEGMENTS[SEGMENT_BUILD])
		throw new Error("Build plan segment not loaded");
	var segment = SEGMENTS[SEGMENT_BUILD];
	var roomName = this.name;
	if (!segment.data[roomName])
		segment.data[roomName] = [];
	segment.data[roomName].push({ x, y, structureType });
	segment.ts = Game.time; // Save changes
	// console.log(ex(segment));
	return OK;
};

Room.prototype.addCurrentStructuresToBuildPlan = function () {
	this
		.find(FIND_STRUCTURES, { filter: s => CONTROLLER_STRUCTURES[s.structureType] !== undefined })
		.forEach(s => this.addToBuildPlan(s.pos.x, s.pos.y, s.structureType));
};

Room.prototype.drawBuildPlan = function () {
	var plan = this.getBuildPlan();
	var [a, b] = _.partition(plan, ({ structureType }) => structureType === STRUCTURE_ROAD);
	_.each(a, ({ x, y, structureType }) => this.visual.structure(x, y, structureType, { opacity: 1.0 }));
	this.visual.connectRoads();
	_.each(b, ({ x, y, structureType }) => this.visual.structure(x, y, structureType, { opacity: 1.0 }));
};


Room.deserializePath = _.memoize(Room.deserializePath);
/* Room.deserializePath = _.memoize(function(s) {
	Log.warn(`Desearizling path`);
	return Room.deserializePath(s);
}); */

/**
 * Bitwise operators for room.
 */
Room.prototype.enableBit = function (bit) {
	if (this.memory !== undefined)
		return (this.memory.bits |= bit);
	return 0;
};

Room.prototype.disableBit = function (bit) {
	if (this.memory !== undefined)
		return (this.memory.bits &= ~bit);
	return 0;
};

Room.prototype.checkBit = function (bit) {
	if (this.memory !== undefined)
		return ((this.memory.bits || 0) & bit) !== 0;
	return false;
};

Room.prototype.clearBits = function () {
	if (this.memory !== undefined)
		delete this.memory.bits;
};

/**
 * Get type of room from it's name.
 *
 * @author engineeryo
 */
Room.getType = function (roomName) {
	const res = /[EW](\d+)[NS](\d+)/.exec(roomName);
	const [, EW, NS] = res;

	if (EW % 10 === 0 || NS % 10 === 0) {
		return 'Highway';
	} else if (EW % 10 === 5 && NS % 10 === 5) {
		return 'Center';
	} else if (
		(EW % 10 === 6 && NS % 10 === 4)
		|| (EW % 10 === 6 && NS % 10 === 5)
		|| (EW % 10 === 6 && NS % 10 === 6)
		|| (EW % 10 === 5 && NS % 10 === 4)
		|| (EW % 10 === 5 && NS % 10 === 6)
		|| (EW % 10 === 4 && NS % 10 === 4)
		|| (EW % 10 === 4 && NS % 10 === 5)
		|| (EW % 10 === 4 && NS % 10 === 6)) {
		return 'SourceKeeper';
	} else {
		return 'Room';
	}
};

Room.prototype.getMyCreeps = function (filter = _.identity) {
	return _(this.find(FIND_MY_CREEPS)).filter(filter);
};

/**
 *
 */
Room.prototype.findOne = function (c, opts = {}) {
	var results = this.find(c);
	if (opts.filter)
		return _.find(results, opts.filter);
	else
		return _.first(results);
};

/**
 * The built-in findPath is kind of a problem.
 */
Room.prototype.findPath = function (fromPos, toPos, opts = {}) {
	if (fromPos.roomName !== this.name)
		return opts.serialize ? '' : [];
	if (fromPos.isEqualTo(toPos))
		return opts.serialize ? '' : [];
	var resultPath = [];
	var { path } = PathFinder.search(fromPos, { range: Math.max(1, opts.range || 1), pos: toPos }, {
		roomCallback: opts.costCallback || ((rN) => LOGISTICS_MATRIX.get(rN)),
		maxOps: opts.maxOps || 20000,
		maxRooms: opts.maxRooms,
		plainCost: opts.ignoreRoads ? 1 : 2,
		swampCost: opts.ignoreRoads ? 5 : 10,
		heuristicWeight: 0.9 + (Math.random() * 0.6)
	});
	if (!opts.range && (path && path.length && path[path.length - 1].isNearTo(toPos) && !path[path.length - 1].isEqualTo(toPos)
		|| !path.length && fromPos.isNearTo(toPos)))
		path.push(toPos);
	var curX = fromPos.x, curY = fromPos.y;
	var i, len = path.length, pos;
	if (opts.reusePath)
		len = Math.min(path.length, opts.reusePath + 1);
	for (i = 0; i < len; i++) {
		pos = path[i];
		if (pos.roomName !== this.name)
			break;
		var result = {
			x: pos.x, y: pos.y,
			dx: pos.x - curX,
			dy: pos.y - curY,
			direction: (new RoomPosition(curX, curY, this.name)).getDirectionTo(pos)
		};
		curX = result.x;
		curY = result.y;
		resultPath.push(result);
	}
	if (opts.serialize)
		return Room.serializePath(resultPath);
	return resultPath;
};

// Fuckkk this part
DEFINE_CACHED_GETTER(Room.prototype, 'stored', function () {
	const stored = _.filter(this.containers, c => c.pos.getRangeTo(c.room.controller) > 3 || c.store.energy > 500);
	if (this.storage
		&& ((this.energyAvailable / this.energyCapacityAvailable) < 0.5
			&& _.get(this.storage, 'store.energy', 0) > 0)
	) // || _.get(this.storage, 'store.energy',0) > 500000)	// Causes scavs to ignore miners
		stored.push(this.storage);
	// terminal
	if (this.terminal
		&& (((this.energyAvailable / this.energyCapacityAvailable) < 0.5) && _.get(this.terminal, 'store.energy', 0) > 0)
		|| (_.get(this.terminal, 'store.energy', 0) > TERMINAL_RESOURCE_LIMIT - 2000) && _.get(this.storage, 'store.energy', 0) < 300000)
		// ) // || (_.get(this.terminal, 'store.energy',0) > 50000) ) // Causes scavs to ignore miners
		stored.push(this.terminal);
	return stored;
});

Room.prototype.updateThreats = function () {
	if (this.controller && this.controller.safeMode) // Safe mode active, we don't need to sweat threats.
		return;
	var threats = this.hostiles;
	this.cache.estActiveThreats = threats.length; // Math.max(this.hostiles.length, (this.memory.estActiveThreats || 0));

	if (threats && threats.length) {
		const leadership = _.countBy(threats, 'owner.username');

		if (_.isEmpty(_.omit(leadership, 'Source Keeper')))
			return;
		// Something other than source keepers here!
		if (!(Game.time % 3))
			Log.error(`${this.name}: Max ${threats.length}, Current ${JSON.stringify(leadership)}`, "Threats");

		if (!this.cache.threatDecay) { // && threats.length > 1) {
			this.onHighAlertEnter(leadership);
		}

		this.cache.threatDecay = Game.time + _.max(threats, 'ticksToLive').ticksToLive;
	} else if (this.cache.threatDecay && (Game.time >= this.cache.threatDecay)) {
		this.onHighAlertExit();
	}
};

// _.map(Game.rooms, r => r.isOnHighAlert() )
Room.prototype.isOnHighAlert = function () {
	// return (this.memory.threatDecay || Game.time) > Game.time;
	return (this.cache.threatDecay || Game.time) > Game.time;
};

Room.prototype.onHighAlertEnter = function (threatsByOwner) {
	Log.warn(`Room ${this.name} entering high alert at ${Game.time}`);
	// _.invoke(Game.creeps, 'say', 'HOO-WAH', true);

	// Leaks memory when coupled with observers. 
	// Isn't strictly needed, anyways.
	/* if(threatsByOwner['Invader']) {
		if(this.memory.lastMined) {
			let diff = this.memory.mined - this.memory.lastMined;
			if(diff > 10000)
				Log.notify(`Invader attack in ${this.name}. Mined: ${this.memory.mined}, since last: ${diff}`, 360); // 60 * 6 hours
		}
		this.memory.lastRaid = Game.time;
		this.memory.lastMined = this.memory.mined;
	} */
};

Room.prototype.getTicksSinceLastRaid = function () {
	return Game.time - this.memory.lastRaid;
};

Room.prototype.onHighAlertExit = function () {
	delete this.memory.threatDecay;
	delete this.memory.estActiveThreats;
	delete this.cache.threatDecay;
	delete this.cache.estActiveThreats;
	// Log.notify("Room " + this.name + " back to normal");
};

/**
 * @return [String] - array of room names
 */
Room.prototype.getAdjacentRooms = function () {
	return _.values(Game.map.describeExits(this.name));
};

Room.prototype.getUpkeep = function () {
	const s = this.structuresByType;
	return (_.get(s, STRUCTURE_ROAD + '.length', 0) * ROAD_UPKEEP)
		+ (_.get(s, STRUCTURE_CONTAINER + '.length', 0) * (_.get(this, 'controller.my', false) ? CONTAINER_UPKEEP : REMOTE_CONTAINER_UPKEEP))
		+ (_.get(s, STRUCTURE_RAMPART + '.length', 0) * RAMPART_UPKEEP)
		;
};

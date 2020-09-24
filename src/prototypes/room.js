/**
 * ext/room.js - Because not everything is driven by room controllers
 *
 * Chance of invasion goes up with amount mined. Roughly around 73k is the lowest it goes.
 * Around 73k to 120k we should consider defense creeps.
 */
'use strict';

/* global DEFINE_CACHED_GETTER, Event, Player, Filter, CRITICAL_INFRASTRUCTURE, Log, FIND_TOMBSTONES */

Room.deserializePath = _.memoize(Room.deserializePath);

import { CONSTRUCTION_MATRIX } from '/cache/costmatrix/ConstructionSiteMatrixCache';
import { shiftWhile } from '/lib/util';
import { distanceTransformWithController } from '/lib/planner';
import { isObstacle, unauthorizedHostile, droppedResources } from '/lib/filter';
import { LOGISTICS_MATRIX } from '/cache/costmatrix/LogisticsMatrixCache';
import { TERMINAL_RESOURCE_LIMIT } from '/prototypes/structure/terminal';
import { Log, LOG_LEVEL } from '/os/core/Log';
import { PLAYER_STATUS } from '/Player';
import { TILE_UNWALKABLE } from '../ds/CostMatrix';

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
DEFINE_CACHED_GETTER(Room.prototype, 'structuresObstacles', r => _.filter(r.structures, s => isObstacle(s)));
DEFINE_CACHED_GETTER(Room.prototype, 'terrain', r => Game.map.getRoomTerrain(r.name));

DEFINE_CACHED_GETTER(Room.prototype, 'mineral', r => r.find(FIND_MINERALS)[0]);
DEFINE_CACHED_GETTER(Room.prototype, 'tombstones', r => r.find(FIND_TOMBSTONES));
DEFINE_CACHED_GETTER(Room.prototype, 'containers', r => r.structuresByType[STRUCTURE_CONTAINER] || []);
DEFINE_CACHED_GETTER(Room.prototype, 'ruins', r => r.find(FIND_RUINS));
DEFINE_CACHED_GETTER(Room.prototype, 'hurtCreeps', r => r.find(FIND_CREEPS, { filter: c => c.hitPct < 1 && (c.my || Player.status(c.owner.username) === PLAYER_STATUS.ALLY) }));
DEFINE_CACHED_GETTER(Room.prototype, 'hurtPowerCreeps', r => r.find(FIND_POWER_CREEPS, { filter: c => c.hitPct < 1 && (c.my || Player.status(c.owner.username) === PLAYER_STATUS.ALLY) }));
DEFINE_CACHED_GETTER(Room.prototype, 'nuker', r => r.findOne(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } }));
DEFINE_CACHED_GETTER(Room.prototype, 'observer', r => r.findOne(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_OBSERVER } }));
DEFINE_CACHED_GETTER(Room.prototype, 'resources', r => r.find(FIND_DROPPED_RESOURCES, { filter: droppedResources }));
DEFINE_CACHED_GETTER(Room.prototype, 'energyPct', r => r.energyAvailable / r.energyCapacityAvailable);

DEFINE_CACHED_GETTER(Room.prototype, 'creeps', r => r.find(FIND_MY_CREEPS) || []);
DEFINE_CACHED_GETTER(Room.prototype, 'creepsByRole', r => _.groupBy(r.creeps, c => c.getRole()));
DEFINE_CACHED_GETTER(Room.prototype, 'creepCountByRole', r => _.countBy(r.creeps, c => c.getRole()));
DEFINE_CACHED_GETTER(Room.prototype, 'sources', r => r.find(FIND_SOURCES));

DEFINE_CACHED_GETTER(Room.prototype, 'events', r => r.getEventLog());

/** Room ownership shortcuts */
DEFINE_CACHED_GETTER(Room.prototype, 'my', r => _.get(r, 'controller.my', false));
DEFINE_CACHED_GETTER(Room.prototype, 'owned', r => _.has(r, 'controller.owner.username'));
DEFINE_CACHED_GETTER(Room.prototype, 'owner', r => _.get(r, 'controller.owner.username'));
DEFINE_CACHED_GETTER(Room.prototype, 'reserved', r => _.has(r, 'controller.reservation.username'));
DEFINE_CACHED_GETTER(Room.prototype, 'reserver', r => _.get(r, 'controller.reservation.username'));
DEFINE_CACHED_GETTER(Room.prototype, 'rented', r => r.reserver === WHOAMI);

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
	if (_.get(room, 'controller.safeMode', 0) >= SAFE_MODE_IGNORE_TIMER) // abritary tick count before re-engaging
		return [];
	const r = [];
	r.push.apply(r, room.find(FIND_HOSTILE_CREEPS, { filter: c => unauthorizedHostile(c) }));
	r.push.apply(r, room.find(FIND_HOSTILE_POWER_CREEPS, { filter: c => unauthorizedHostile(c) }));
	return r;
});

DEFINE_CACHED_GETTER(Room.prototype, 'intruders', (room) => room.hostiles.filter(c => !c.pos.isOnRoomBorder()));

/**
 * Each room has a 'state' we want to maintain.
 */
Room.prototype.run = function updateRoom() {
	if (!Memory.rooms[this.name])
		return;

	// let a = this.structures;
	this.updateBuild();
};

/**
 * Calculate the origin of a room given our constraints.
 */
Room.prototype.getOrigin = function () {
	if (!this.memory.origin) {
		this.memory.origin = distanceTransformWithController(this) || { pos: this.controller.pos, range: 4 };
		Log.warn(`Found origin: ${this.memory.origin}`, 'Planner');
	}
	const { origin } = this.memory;
	const pos = new RoomPosition(origin.x, origin.y, origin.roomName);
	return { pos, radius: 1 };
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
 * @param {RoomPosition} pos
 * @param {string} structureType
 *
 * @todo Account for expiration? sortedLastIndex _kind_ of handles this, but currently cost is more important than expiration.
 * @todo Need to account for extra cost of building swamp road (Actually it doesn't matter, still cheaper than anything else)
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
		const BUILD_SCORE_PRECISION_MOD = 1000;
		const cost = Math.ceil(CONSTRUCTION_COST[structureType] / BUILD_SCORE_PRECISION_MOD);
		const score = -((100 * priority) << 8) | Math.min(cost, 256);
		const task = { x, y, structureType, expire: Game.time + expire, priority, score };
		var q = this.memory.bq;
		var indx = _.sortedLastIndex(q, task, 'score');
		q.splice(indx, 0, task);

		// Attempt to mark the cost matrix, in case we re-use this cm
		if (OBSTACLE_OBJECT_TYPES.includes(structureType)) {
			const cm = CONSTRUCTION_MATRIX.get(this.name);
			if (cm)
				cm.set(x, y, 255);
		}
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
	shiftWhile(this.memory.bq,
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

/**
 * Get type of room from it's name.
 *
 * @author engineeryo
 */
Room.getType = function (roomName) {
	const res = /[EW](\d+)[NS](\d+)/.exec(roomName);
	const [, EW, NS] = res;
	const EWI = EW % 10, NSI = NS % 10;
	if (EWI === 0 || NSI === 0) {
		return 'Highway';
	} else if (EWI === 5 && NSI === 5) {
		return 'Center';
	} else if (Math.abs(5 - EWI) <= 1 && Math.abs(5 - NSI) <= 1) {
		return 'SourceKeeper';
	} else {
		return 'Room';
	}
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

// _.map(Game.rooms, r => r.isOnHighAlert() )
Room.prototype.isOnHighAlert = function () {
	// return (this.memory.threatDecay || Game.time) > Game.time;
	return (this.cache.threatDecay || Game.time) > Game.time;
};

Room.prototype.onHighAlertEnter = function (threatsByOwner) {
	Log.warn(`Room ${this.name} entering high alert at ${Game.time}`);
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
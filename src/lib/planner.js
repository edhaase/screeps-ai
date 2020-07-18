/**
 * Planner.js - Construction operations
 *
 * Four-phase build process:
 * 
 * 1) Build queue
 *		Places up to two sites per room at a time (to prevent builder recycle),
 *		and only if the room isn't under attack.
 *
 * 2) Build planner
 *		Picks what to build and sticks it in the queue. Uses growth-stlye,
 *		expanding from an abritary point in a semi-random fashion
 *
 * 3) Fixed-purpose build plans
 *		Auto-rampart automatically protects important structures with ramparts
 *		Auto-rampart-walls upgrades fully-repaired walls with ramparts.
 *		Wall off exits with alternating walls and ramparts
 *		
 */
'use strict';

/* global Log, Util */
/* global DEFAULT_BUILD_JOB_EXPIRE, STRUCTURE_BUILD_PRIORITY */
/* global CREEP_UPGRADE_RANGE */
/* global CRITICAL_INFRASTRUCTURE, CONTROLLER_STRUCTURES_LEVEL_FIRST, CONSTRUCTION_MATRIX */
import { Log, LOG_LEVEL } from '/os/core/Log';
import { DEFAULT_ROAD_SCORE } from '/ds/costmatrix/RoomCostMatrix';
import LazyMap from '/ds/LazyMap';
import { RLD } from '/lib/util';
import { CONSTRUCTION_MATRIX } from '/CostMatrix';
/* eslint-disable consistent-return */

import FleePlanner from '/algo/fleeplanner';;
import { VisibilityError } from '/os/core/errors';
import dt from '/algo/dt';

import { exitPlanner } from '/algo/exitwallplanning';
import Template from '../ds/Template';
import templates from '/template/index';
import TemplateVisual from '/visual/template';

// @todo Find way to preserve road plan from expiring.
// @todo Put terminal within range 2 of controller.

// Utilize a PathFinder.CostMatrix to mark extra obstacles,
// including cloning the matix during selection phase to ensure everyone gets their
// own spot.

// Total costs: _.sum(Game.constructionSites, s => CONSTRUCTION_COST[s.structureType])
// Current build power needed: _.sum(Game.constructionSites, s => s.progressTotal - s.progress);
// _(Game.flags).filter('color', COLOR_BLUE).map('pos').invoke('createConstructionSite', STRUCTURE_ROAD)

// Labs must be built close together.
// Roads fill in the gaps
// Links go near controllers, sources, and terminal/storage (if multiple points, pick closer?)
const RANDO_STRUCTURES = [STRUCTURE_LAB, STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_OBSERVER];
export const MINIMUM_LEVEL_FOR_EXIT_WALLS = 3;
export const MINIMUM_LEVEL_FOR_LINKS = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_LINK]);
export const MINIMUM_LEVEL_FOR_RAMPARTS = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_RAMPART]);
export const MINIMUM_LEVEL_FOR_TERMINAL = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL]);

export const BASE_TUNNEL_WEIGHT = 25;

// export const CONTROLLER_STRUCTURES_LEVEL_FIRST = [];
// for (var i = 0; i <= 8; i++)
//	CONTROLLER_STRUCTURES_LEVEL_FIRST[i] = _.transform(CONTROLLER_STRUCTURES, (r, v, k) => r[k] = v[i]);



/**
 *
 */
export function canBuild(room, structureType) {
	if (_.size(Game.constructionSites) >= MAX_CONSTRUCTION_SITES)
		return false;
	// let count = _.sum(this.structures, s => s.structureType === structureType)
	const count = (room.structuresByType[structureType] || []).length
		+ _.sum(this.find(FIND_MY_CONSTRUCTION_SITES, { filer: s => s.structureType === structureType }));
	const allowed = CONTROLLER_STRUCTURES[structureType][this.controller.level];
	return allowed >= count;
};

Room.prototype.getStructuresWeCanBuild = function () {
	const { level } = this.controller;
	const have = _.countBy(this.structures, 'structureType');
	// let have = this.structuresByType;
	return _.mapValues(CONTROLLER_STRUCTURES, (v, k) => v[level] - (have[k] || 0));
};

/**
 * Transforms controller structures
 */
export function structuresAllowable(roomName) {
	const room = Game.rooms[roomName];
	if (!room)
		return "You don't have visibility in this room";
	return _.transform(CONTROLLER_STRUCTURES, (r, v, k) => r[k] = v[room.controller.level]);
};


/**
 * Automates room construction
 *
 * Very, very high cpu. Won't run with bucket limiter engaged.
 * This should probably not be run for more than one room per tick. 
 *
 * Likely to be called by the room controller periodically, or on level up.
 *
 * @param Room room - current room object needed
 */
export function buildRoom(room) {
	var { level } = room.controller;
	if (level < 1) // Sanity check
		return ERR_RCL_NOT_ENOUGH; // We can't build anything at rcl 0
	if (!room.isBuildQueueEmpty())
		return ERR_BUSY;
	if (!_.isEmpty(room.find(FIND_MY_CONSTRUCTION_SITES, { filter: s => s.structureType !== STRUCTURE_CONTAINER })))
		return ERR_BUSY;
	Log.info(`Building room: ${room.name} on tick ${Game.time}`, 'Planner');
	return buildRoomOldschool(room);
}

const hub = new Template(templates.econhub).normalize();
const extensions = new Template(templates.extensions).normalize();

export function buildRoomFromTemplate(room) {
	const { controller, memory } = room;
	if (!memory.stamp)
		planRoomTemplates(room);
	if (!memory.stamp) {
		Log.warn(`Unable to stamp templates in room`);
		return false;
	}
	for (const [name, x, y] of memory.stamp) {
		// If missing, add to build queue. Priority will be taken care of automatically
	}
	return true;
}

export function planRoomFromTemplates(room) {
	const { controller, memory } = room;
	const obstacles = new PathFinder.CostMatrix;
	const [ex, ey] = planRoomFromTemplate(room, extensions, obstacles);
	const [hx, hy] = planRoomFromTemplate(room, hub, obstacles);
}

export function planRoomFromTemplate(room, template, obstacles) {
	const width = template.width;
	const height = template.height;
	const point = distanceTransformWithController(room, Math.ceil(Math.max(width, height) / 2), obstacles);
	const tx = ~~(point.x - width / 2);
	const ty = ~~(point.y - height / 2);
	const templateVisual = new TemplateVisual(template, [tx, ty]);
	templateVisual.draw();
	template.forEachPos(({ x, y }, type) => {
		obstacles.set(tx + x, ty + y, 255);
	})
	return [tx, ty];
}

export function buildRoomOldschool(room) {
	var { level } = room.controller;
	const origin = room.getOrigin();
	var avail = room.getStructuresWeCanBuild();
	var want = [];
	for (const type of RANDO_STRUCTURES)
		want.push(avail[type], type);
	want = RLD(want);
	if (_.isEmpty(want)) {
		Log.debug('Nothing to build', 'Planner');
		// return;
	} else {
		var fleePlanner = new FleePlanner(null, origin.pos, {
			stuffToAdd: want
		});
		fleePlanner.mergeCurrentPlan().run().draw(true);
		for (const { pos, structureType } of fleePlanner.plan)
			room.addToBuildQueue(pos, structureType, DEFAULT_BUILD_JOB_EXPIRE, STRUCTURE_BUILD_PRIORITY[structureType]);
	}
	// Then build other stuff
	placeRamparts(room);
	// Don't build this stuff until we have a tower up	
	if (level >= 3) {
		// this.buildSourceRoads(room, pos, room.controller.level >= 3);
		buildSourceRoads(room, origin.pos, false);
		buildControllerWall(origin, room.controller);
		planRoad(origin.pos, { pos: room.controller.pos, range: CREEP_UPGRADE_RANGE }, { container: false, initial: 1, tunnel: true, stroke: 'green' });
	} else if (level >= 2) {
		buildSourceTunnels(room, origin.pos);
		planTunnel(origin.pos, { pos: room.controller.pos, range: CREEP_UPGRADE_RANGE });
	}
	if (level >= MINIMUM_LEVEL_FOR_LINKS)
		buildLinks(origin.pos, level);
	// findRoadMisplacements(room).invoke('destroy').commit();
	// Find a happy medium for these?
	if (level >= MINIMUM_LEVEL_FOR_EXIT_WALLS)
		exitPlanner(room.name, { commit: true });
	if (level >= MINIMUM_LEVEL_FOR_TERMINAL) {
		const { mineral } = room;
		if (mineral && !mineral.pos.hasStructure(STRUCTURE_EXTRACTOR)) {
			room.addToBuildQueue(mineral.pos, STRUCTURE_EXTRACTOR);
		}
		if (room.terminal)
			planRoad(room.terminal.pos, { pos: mineral.pos, range: 1 }, { rest: 1, initial: 1, container: true, tunnel: true, stroke: 'blue' });
	}
	return OK;
};

/**
 * Plan for links
 */
export function buildLinks(origin, level = MINIMUM_LEVEL_FOR_LINKS) {
	if (!origin)
		throw new Error('Expects origin point');
	const room = Game.rooms[origin.roomName];
	if (!room)
		throw new VisibilityError(origin.roomName);
	const { controller, sources, links = [] } = room;
	const linksAllowed = CONTROLLER_STRUCTURES[STRUCTURE_LINK][controller.level];
	if (links.length >= linksAllowed)
		return Log.debug(`${room.name}: No links remaining`, 'Planner');
	Log.debug(`Building links from ${origin} for level ${level}`, 'Planner');
	// controller first, leave room at least 1 upgrader at range 3
	// by parking the link at range 4
	let status = controller.planLink(CREEP_UPGRADE_RANGE, 2);
	Log.debug(`${room.name}: Plan controller link: ${status}`, 'Planner');
	// now sources
	for (var s = 0; s < sources.length; s++) {
		status = sources[s].planLink();
		Log.debug(`${room.name}: Plan source ${sources[s].id} link: ${status}`, 'Planner');
		if (status === OK)
			return;
	}
};

/**
 * Places ramparts around controller
 * 
 * @todo loop enclosure test while ramparting, until we can't reach any exits
 * 
 * @param {*} origin
 * @param {*} controller
 */
export function buildControllerWall(origin, controller) {
	if (!origin || !controller)
		throw new Error("Invalid args");
	const tiles = _.reject(controller.pos.getOpenNeighbors(), p => p.hasStructure(STRUCTURE_RAMPART));
	Log.debug(`${controller.pos.roomName}: Barricading controller`, 'Planner');
	tiles.forEach(t => controller.room.addToBuildQueue(t, STRUCTURE_RAMPART));
};

/**
 * 
 * @param {*} room 
 */
export function drawAvgRange(room) {
	var roomName = room.name;
	var vis = room.visual;
	var x, y, pos, dist;
	var c = room.controller;
	var s = room.find(FIND_SOURCES);
	var points = [c, ...s];
	// var maxv = 0, maxp = null;
	for (y = 49; y >= 0; --y) {
		for (x = 49; x >= 0; --x) {
			pos = new RoomPosition(x, y, roomName);
			// dist = pos.getRangeTo(c);
			dist = Math.ceil(pos.getAverageRange(points));
			// console.log('dist: ' + dist);
			// value = cm.get(x,y) / (dist / 25);
			if (dist < 3)
				continue;
			// vis.circle(x, y, { fill: 'red', radius: dist / 75 });
			vis.text(dist, x, y);
		}
	}
};

/**
 * Finds a position in a room to expand outwards from.
 * Ignores minerals (Not significant)
 * 
 * @param {Room} room - Room object to analyze
 * @param {Number} maxClearance - Score above which extra clearance doesn't really matter
 * @todo If we hit max clear, should we stop early?
 */
export function distanceTransformWithController(room, maxClearance = 5, obstacles = new PathFinder.CostMatrix) {
	const MINIMUM_CLEARANCE = 3;
	var roomName = room.name;
	var cm = dt(roomName, (x, y) => obstacles.get(x, y) === 255);
	var vis = new RoomVisual(roomName);
	var x, y, value, pos, dist, clear;
	var c = room.controller;
	var s = room.find(FIND_SOURCES);
	var points = [c, ...s];
	var maxc = 0, maxv = 0, maxp = null;
	for (y = 49; y >= 0; --y) {
		for (x = 49; x >= 0; --x) {
			pos = new RoomPosition(x, y, roomName);
			dist = Math.ceil(pos.getAverageRange(points));
			if (dist < MINIMUM_CLEARANCE)
				continue;
			clear = Math.min(cm.get(x, y), maxClearance);
			value = (clear ** 2) / dist;
			if (value > maxv) {
				maxv = value;
				maxp = pos;
				maxc = clear;
			}
			vis.circle(x, y, { radius: value / 25 });
		}
	}
	vis.circle(maxp, { fill: 'red', opacity: 1.0 });
	console.log(`Best position: ${maxp} with score ${maxv} and clearance ${maxc}`);
	return maxp;
};

/**
 * Like build road, but only builds the tunnel portion
 */
export function buildSourceTunnels(room, origin) {
	return buildSourceRoads(room, origin, false, planTunnel);
}

export function planTunnel(fromPos, toPos, opts = {}) {
	const terrainMap = new LazyMap(r => Game.map.getRoomTerrain(r));
	opts.filter = (pos) => !(terrainMap.get(pos.roomName).get(pos.x, pos.y) & TERRAIN_MASK_WALL);
	return planRoad(fromPos, toPos, opts);
}

/**
 * Must path within range (Adjacent for source), but road can stop one shorter.
 * For controller, road only needs to path to range 3.
 */
export function buildSourceRoads(room, origin, container = false, method = planRoad) {
	if (origin == null)
		throw new Error("Origin position required");
	const sources = room.find(FIND_SOURCES);
	_.each(sources, source => method(origin, { pos: source.pos, range: 1 }, { swampCost: 3, rest: 1, initial: 1, container, tunnel: true, stroke: 'yellow' }));
	if (room.controller && room.controller.level >= 6 && sources.length > 1) {
		var [s1, s2] = sources;
		const [c1, c2] = [s1.container, s2.container];
		if (c1 && c2)
			method(c1, { pos: c2.pos, range: 1 }, { tunnel: 20, heuristicWeight: 0, swampCost: 3, stroke: 'yellow' });
		else
			method(s1, { pos: s2.pos, range: 1 }, { rest: 1, initial: 1, tunnel: false, swampCost: 3, stroke: 'red' }); // could end up with unusable tunnel
	}
};

/**
 * Game.rooms['W6N3'].visual.poly(PathFinder.search(new RoomPosition(44,41,'W6N3'), new RoomPosition(7,42,'W6N3'), {heuristicWeight: 1.2, plainCost: 2, swampCost: 2}).path)
 * @todo add existing road to plan
 */
export function planRoad(fromPos, toGoal, opts = {}) {
	// const {dry=false,cmFm,container=false,rest,initial} = opts;
	if (fromPos.pos)
		fromPos = fromPos.pos;
	if (opts.cmFn === undefined)
		opts.cmFn = (rN) => CONSTRUCTION_MATRIX.get(rN);
	if (opts.tunnel) {
		const { cmFn } = opts;
		opts.cmFn = function (rN) {
			let cm = cmFn(rN);
			if (cm) {
				cm = cm.clone();
				if (opts.tunnel === true)
					cm.setTerrainWalls(rN, BASE_TUNNEL_WEIGHT);
				else if (opts.tunnel > 0)
					cm.setTerrainWalls(rN, opts.tunnel);
			}
			return cm;
		};
	}
	try {
		const result = PathFinder.search(fromPos, toGoal, {
			plainCost: DEFAULT_ROAD_SCORE+1, // prefer existing roads
			swampCost: opts.swampCost || (DEFAULT_ROAD_SCORE+1),
			maxOps: 64000,
			maxRooms: (fromPos.roomName === (toGoal.roomName || toGoal.pos.roomName)) ? 1 : PATHFINDER_MAX_ROOMS,
			roomCallback: opts.cmFn,
			heuristicWeight: opts.heuristicWeight
		});
		var { path = [], incomplete, cost, ops } = result;
		if (incomplete || !path.length) {
			Log.warn(`No path to goal ${JSON.stringify(toGoal)}, cost ${cost} ops ${ops} steps ${path.length}`, 'Planner');
			return ERR_NO_PATH;
		} else if (opts.container) {
			const end = _.last(path);
			if (end && !end.hasStructure(STRUCTURE_CONTAINER))
				Game.rooms[end.roomName].addToBuildQueue(end, STRUCTURE_CONTAINER);
		}
		path = path.slice(opts.rest, path.length - (opts.initial || 0));
		if (!path || !path.length)
			return Log.debug(`No road needed for ${fromPos} to ${toGoal}`, 'Planner');
		new RoomVisual(path[0].roomName).poly(path, { stroke: opts.stroke });
		Log.debug(`Road found, cost ${cost} ops ${ops} incomplete ${incomplete}`, 'Planner');
		if (opts.dry)
			return;
		for (const indx in path) {
			const p = path[indx];
			try {
				if (p.hasStructure(STRUCTURE_ROAD))
					continue;
				if (opts.filter && !opts.filter(p))
					continue;
				Game.rooms[p.roomName].addToBuildQueue(p, STRUCTURE_ROAD);
			} catch (e) {
				console.log(`(${p})`);
			}
		}
	} catch (e) {
		Log.error(`Error in planRoad from ${fromPos} to ${toGoal.pos || toGoal}: ${e}`, 'Planner');
		Log.error(e.stack);
	}
	// _.each(path, p => p.createConstructionSite(STRUCTURE_ROAD));
};

/**
 * Automates placing ramparts on important structures
 *
 * Note: The look call saves us cpu.
 */
export function placeRamparts(room) {
	if (_.get(room, 'controller.level', 0) < MINIMUM_LEVEL_FOR_RAMPARTS)
		return ERR_RCL_NOT_ENOUGH;
	const start = Game.cpu.getUsed();
	const structures = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_RAMPART });
	for (const { structureType, pos } of structures) {
		if (!CRITICAL_INFRASTRUCTURE.includes(structureType) || pos.hasRampart())
			continue;
		Log.debug(`Creating rampart for ${structureType} at pos ${pos}`, 'Planner');
		room.addToBuildQueue(pos, STRUCTURE_RAMPART, DEFAULT_BUILD_JOB_EXPIRE, 1.0);
	}
	const used = Game.cpu.getUsed() - start;
	Log.info(`Updating auto-ramparts in ${room.name} took ${used} cpu`, 'Planner');
	return used;
};

/**
 * Look for roads that are wasting resources by existing under stuff
 * To be called once a day? once a week?
 * May generalize to other things that should exist in the same layer?
 */
export function findRoadMisplacements(room) {
	return _(room.find(FIND_STRUCTURES))
		.filter('structureType', STRUCTURE_ROAD)
		.filter(s => s.pos.hasObstacle(false));
};
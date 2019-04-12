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
/* global CRITICAL_INFRASTRUCTURE, CONTROLLER_STRUCTURES_LEVEL_FIRST */


/* eslint-disable consistent-return */

const FleePlanner = require('os.algo.fleeplanner');
const { VisibilityError } = require('os.core.errors');


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
const MINIMUM_LEVEL_FOR_EXIT_WALLS = 3;
const MINIMUM_LEVEL_FOR_LINKS = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_LINK]);
const MINIMUM_LEVEL_FOR_RAMPARTS = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_RAMPART]);
const MINIMUM_LEVEL_FOR_TERMINAL = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL]);


global.CONTROLLER_STRUCTURES_LEVEL_FIRST = [];
for (var i = 0; i <= 8; i++)
	CONTROLLER_STRUCTURES_LEVEL_FIRST[i] = _.transform(CONTROLLER_STRUCTURES, (r, v, k) => r[k] = v[i]);



/**
 *
 */
Room.prototype.canBuild = function (structureType) {
	if (_.size(Game.constructionSites) >= MAX_CONSTRUCTION_SITES)
		return false;
	// let count = _.sum(this.structures, s => s.structureType === structureType)
	const count = (this.structuresByType[structureType] || []).length
		+ _.sum(this.find(FIND_MY_CONSTRUCTION_SITES, { filer: s => s.structureType === structureType }));
	const allowed = CONTROLLER_STRUCTURES[structureType][this.controller.level];
	return allowed >= count;
};

/**
 *
 */
Room.prototype.getStructuresAllowed = function () {
	// return _.transform(CONTROLLER_STRUCTURES, (r,v,k) => r[k] = v[this.controller.level]);
	return CONTROLLER_STRUCTURES_LEVEL_FIRST[this.controller.level];
};

Room.prototype.getStructuresWeCanBuild = function () {
	const { level } = this.controller;
	const have = _.countBy(this.structures, 'structureType');
	// let have = this.structuresByType;
	return _.mapValues(CONTROLLER_STRUCTURES, (v, k) => v[level] - (have[k] || 0));
};


class BuildPlanner {
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
	static buildRoom(room) {
		var { level } = room.controller;
		if (level < 1) // Sanity check
			return ERR_RCL_NOT_ENOUGH; // We can't build anything at rcl 0
		if (!room.isBuildQueueEmpty())
			return ERR_BUSY;
		if (!_.isEmpty(room.find(FIND_MY_CONSTRUCTION_SITES, { filter: s => s.structureType !== STRUCTURE_CONTAINER })))
			return ERR_BUSY;
		Log.info(`Building room: ${room.name} on tick ${Game.time}`, 'Planner');
		const origin = room.getOrigin();
		var avail = room.getStructuresWeCanBuild();
		var want = [];
		for (const type of RANDO_STRUCTURES)
			want.push(avail[type], type);
		want = Util.RLD(want);
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
		this.placeRamparts(room);
		// Don't build this stuff until we have a tower up
		if (level >= 3) {
			// this.buildSourceRoads(room, pos, room.controller.level >= 3);
			this.buildSourceRoads(room, origin.pos, false);
			this.buildControllerWall(origin, room.controller);
			this.planRoad(origin.pos, { pos: room.controller.pos, range: CREEP_UPGRADE_RANGE }, { container: false, initial: 1, tunnel: true });
		}
		if (level >= MINIMUM_LEVEL_FOR_LINKS)
			this.buildLinks(origin.pos, level);
		this.findRoadMisplacements(room).invoke('destroy').commit();
		// Find a happy medium for these?
		if (level >= MINIMUM_LEVEL_FOR_EXIT_WALLS)
			this.exitPlanner(room.name, { commit: true });
		if (level >= MINIMUM_LEVEL_FOR_TERMINAL) {
			const { mineral } = room;
			if (mineral && !mineral.pos.hasStructure(STRUCTURE_EXTRACTOR)) {
				room.addToBuildQueue(mineral.pos, STRUCTURE_EXTRACTOR);
			}
			if (room.terminal)
				this.planRoad(room.terminal.pos, { pos: mineral.pos, range: 1 }, { rest: 1, initial: 1, container: true, tunnel: true });
		}
		return OK;
	}

	/**
	 * Plan for links
	 */
	static buildLinks(origin, level = MINIMUM_LEVEL_FOR_LINKS) {
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
	}

	/**
	 * Places ramparts around controller
	 * @param {*} origin
	 * @param {*} controller
	 */
	static buildControllerWall(origin, controller) {
		if (!origin || !controller)
			throw new Error("Invalid args");
		const tiles = _.reject(controller.pos.getOpenNeighbors(), p => p.hasStructure(STRUCTURE_RAMPART));
		Log.debug(`${controller.pos.roomName}: Barricading controller`, 'Planner');
		tiles.forEach(t => controller.room.addToBuildQueue(t, STRUCTURE_RAMPART));
	}

	/**
	 * Distance transform - An image procesing technique.
	 * Rosenfeld and Pfaltz 1968 algorithm
	 * @author bames
	 * See: http://homepages.inf.ed.ac.uk/rbf/HIPR2/distance.htm
	 * Roughly 20-40 cpu without visuals
	 *
	 * Scores are largest at center of clearance.
	 * example: Time.measure( () => Planner.distanceTransform('W5N2', (x,y,r) =>  Game.map.getTerrainAt(x, y,r) == 'wall' || new RoomPosition(x,y,r).hasObstacle() ))
	 */
	static distanceTransform(roomName, rejector = (x, y, roomName) => (Game.map.getRoomTerrain(roomName).get(x, y) & TERRAIN_MASK_WALL)) {
		var vis = new RoomVisual(roomName);
		var topDownPass = new PathFinder.CostMatrix();
		var x, y;

		for (y = 0; y < 50; ++y) {
			for (x = 0; x < 50; ++x) {
				if (rejector(x, y, roomName)) {
					topDownPass.set(x, y, 0);
				}
				else {
					topDownPass.set(x, y,
						Math.min(topDownPass.get(x - 1, y - 1), topDownPass.get(x, y - 1),
							topDownPass.get(x + 1, y - 1), topDownPass.get(x - 1, y)) + 1);
				}
			}
		}

		var value;
		for (y = 49; y >= 0; --y) {
			for (x = 49; x >= 0; --x) {
				value = Math.min(topDownPass.get(x, y),
					topDownPass.get(x + 1, y + 1) + 1, topDownPass.get(x, y + 1) + 1,
					topDownPass.get(x - 1, y + 1) + 1, topDownPass.get(x + 1, y) + 1);
				topDownPass.set(x, y, value);
				// vis.circle(x, y, {radius:value/25});
				if (value > 0)
					vis.text(value, x, y);
			}
		}

		return topDownPass;
	}

	/**
	 * 
	 * @param {*} room 
	 */
	static drawAvgRange(room) {
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
	}

	/**
	 * Finds a position in a room to expand outwards from.
	 * Ignores minerals (they aren't a serious )
	 * @param {Room} room - Room object to analyze
	 * @param {Number} maxClearance - Score above which extra clearance doesn't really matter
	 * @todo If we hit max clear, should we stop early?
	 */
	static distanceTransformWithController(room, maxClearance = 5) {
		const MINIMUM_CLEARANCE = 3;
		var roomName = room.name;
		var cm = this.distanceTransform(roomName);
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
		console.log(`Best position: ${maxp} with score ${maxv} and clearance ${maxc}`);
		return maxp;
	}

	/**
	 * Must path within range (Adjacent for source), but road can stop one shorter.
	 * For controller, road only needs to path to range 3.
	 */
	static buildSourceRoads(room, origin, container = false) {
		if (origin == null)
			throw new Error("Origin position required");
		const sources = room.find(FIND_SOURCES);
		_.each(sources, source => this.planRoad(origin, { pos: source.pos, range: 1 }, { rest: 1, initial: 1, container, tunnel: true }));
		if (room.controller && room.controller.level >= 6 && sources.length > 1) {
			var [s1, s2] = sources;
			this.planRoad(s1, { pos: s2.pos, range: 1 }, { rest: 1, initial: 1, tunnel: true });
		}
	}

	/**
	 * Game.rooms['W6N3'].visual.poly(PathFinder.search(new RoomPosition(44,41,'W6N3'), new RoomPosition(7,42,'W6N3'), {heuristicWeight: 1.2, plainCost: 2, swampCost: 2}).path)
	 * @todo add existing road to plan
	 */
	static planRoad(fromPos, toPos, opts = {}) {
		const BASE_TUNNEL_WEIGHT = 50;
		// const {dry=false,cmFm,container=false,rest,initial} = opts;
		if (fromPos.pos)
			fromPos = fromPos.pos;
		if (opts.cmFn === undefined)
			opts.cmFn = (rN) => FIXED_OBSTACLE_MATRIX.get(rN);
		if (opts.tunnel) {
			const cmFn = opts.cmFn;
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
			var result = PathFinder.search(fromPos, toPos, {
				plainCost: 2, // prefer existing roads
				swampCost: 2,
				maxOps: 16000,
				maxRooms: (fromPos.roomName === (toPos.roomName || toPos.pos.roomName)) ? 1 : PATHFINDER_MAX_ROOMS,
				roomCallback: opts.cmFn
			});
			var { path = [], incomplete, cost, ops } = result;
			if (incomplete || !path.length) {
				Log.warn(`No path to goal ${JSON.stringify(toPos)}, cost ${cost} ops ${ops} steps ${path.length}`, 'Planner');
				return ERR_NO_PATH;
			} else if (opts.container) {
				const end = _.last(path);
				if (end && !end.hasStructure(STRUCTURE_CONTAINER))
					Game.rooms[end.roomName].addToBuildQueue(end, STRUCTURE_CONTAINER);
			}
			path = path.slice(opts.rest, path.length - (opts.initial || 0));
			if (!path || !path.length)
				return Log.debug(`No road needed for ${fromPos} to ${toPos}`, 'Planner');
			new RoomVisual(path[0].roomName).poly(path);
			Log.debug(`Road found, cost ${cost} ops ${ops} incomplete ${incomplete}`, 'Planner');
			if (opts.dry)
				return;
			for (const indx in path) {
				const p = path[indx];
				try {
					if (!p.hasStructure(STRUCTURE_ROAD))
						Game.rooms[p.roomName].addToBuildQueue(p, STRUCTURE_ROAD);
				} catch (e) {
					console.log(`(${p})`);
				}
			}
		} catch (e) {
			console.log(e.stack);
			console.log(ex(fromPos));
			console.log(ex(toPos));
		}
		// _.each(path, p => p.createConstructionSite(STRUCTURE_ROAD));
	}

	/**
	 * Flood fill code
	 * https://en.wikipedia.org/wiki/Breadth-first_search
	 *
	 * @param pos - starting position
	 *
	 * ex: floodFill(controller.pos)
	 * ex: Planner.floodFill(new RoomPosition(46,19,'E58S41'), {limit: 128, validator: (pos) => Game.map.getTerrainAt(pos) !== 'wall' && !pos.hasObstacle()})
	 */
	static floodFill(pos, {
		validator = (pos) => !pos.isOnRoomBorder() && !pos.hasObstacle(true),
		stop = () => false,		// stop condition
		limit = 150,
		oddeven = false,
		visualize = true,
	} = {}) {
		var start = Game.cpu.getUsed();
		var s = new CostMatrix.CostMatrix;
		var q = [pos];
		var rtn = [];
		var room = Game.rooms[pos.roomName];
		var count = 0;
		var visual = (room) ? room.visual : (new RoomVisual(pos.roomName));
		while (q.length) {
			var point = q.shift();
			if (count++ > limit)
				break;
			// This isn't firing, so we're only here if this a good point.
			// visual.circle(point, {fill: 'yellow'});
			//	continue;			
			// console.log('point: ' + point);
			rtn.push(point);

			// if(goalMet?)
			// return;
			var adj = point.getAdjacentPoints();
			_.each(adj, function (n) {
				if (s.get(n.x, n.y))
					return;
				s.set(n.x, n.y, 1);
				if (!validator(n)) {
					if (visualize)
						visual.circle(n, { fill: 'red', opacity: 1.0 });
				} else {
					var color = Util.getColorBasedOnPercentage(100 * (count / limit));
					// var color = HSV_COLORS[Math.floor(100*(count / limit))];
					if (oddeven && (n.x + n.y) % 2 === 0)
						color = 'blue';
					if (visualize)
						visual.circle(n, { fill: color, opacity: 1.0 });
					// room.visual.circle(n, {fill: 'green'});
					q.push(n);
				}
			});
		}

		var used = Game.cpu.getUsed() - start;
		console.log(`Used: ${used}, Count: ${count}`);
		return rtn;
	}

	/**
	 * Automates placing ramparts on important structures
	 *
	 * @todo: Move this to RCL 2 for early-ramparting. Requires faster/build-repair
	 * 
	 * Note: The look call saves us cpu.
	 */
	static placeRamparts(room) {
		if (_.get(room, 'controller.level', 0) < MINIMUM_LEVEL_FOR_RAMPARTS)
			return ERR_RCL_NOT_ENOUGH;
		var start = Game.cpu.getUsed();
		var structures = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_RAMPART });
		for (const { structureType, pos } of structures) {
			if (!CRITICAL_INFRASTRUCTURE.includes(structureType) || pos.hasRampart())
				continue;
			Log.debug(`Creating rampart for ${structureType} at pos ${pos}`, 'Planner');
			room.addToBuildQueue(pos, STRUCTURE_RAMPART, DEFAULT_BUILD_JOB_EXPIRE, 1.0);
		}
		var used = Game.cpu.getUsed() - start;
		Log.info(`Updating auto-ramparts in ${room.name} took ${used} cpu`, 'Planner');
		return used;
	}

	/**
	 * Look for roads that are wasting resources by existing under stuff
	 * To be called once a day? once a week?
	 * May generalize to other things that should exist in the same layer?
	 */
	static findRoadMisplacements(room) {
		return _(room.find(FIND_STRUCTURES))
			.filter('structureType', STRUCTURE_ROAD)
			.filter(s => s.pos.hasObstacle(false));
	}

	/**
	 * Attempt to obstacle exits. Requires origin point.
	 *
	 * Time.measure( () => Planner.exitPlanner('W7N2') )
	 */
	static exitPlanner(roomName, opts = {}) {
		const {
			origin = Game.rooms[roomName].getOrigin().pos,
			visualize = true, visualizePath = true, visualizeOrder = true,
			param = FIND_EXIT,
			commit = false,
			sort = true,
			ignorePlan = false } = opts;
		const cm = new PathFinder.CostMatrix;
		const room = Game.rooms[roomName];
		const visual = (room && room.visual) || new RoomVisual(roomName);
		const exits = room.find(param).map(e => ({ pos: e, range: 0 }));
		if (!exits || !exits.length)
			return ERR_NOT_FOUND;
		if (!ignorePlan) {
			room.find(FIND_STRUCTURES).forEach(({ pos, structureType }) => {
				if (structureType === STRUCTURE_RAMPART || OBSTACLE_OBJECT_TYPES.includes(structureType))
					cm.set(pos.x, pos.y, 255);
			});
		}
		/* eslint no-constant-condition: 0 */
		const params = { roomCallback: () => cm, maxRooms: 1 };
		let order = [];
		while (true) {
			const { path, incomplete } = PathFinder.search(origin, exits, params);
			if (incomplete)
				break;
			const pos = path[path.length - 3];
			cm.set(pos.x, pos.y, 255);
			const wallOrRampart = (pos.x + pos.y) % 3;
			const type = wallOrRampart ? STRUCTURE_WALL : STRUCTURE_RAMPART;
			if (!pos.hasStructure(type))
				order.push({ pos, type });
			if (visualize) {
				if (visualizePath)
					visual.poly(path);

				visual.circle(pos, { fill: (wallOrRampart ? 'black' : 'green'), opacity: 0.75 });
			}
		}

		if (sort)
			order = _.sortBy(order, ({ pos }) => pos.y << 16 | pos.x);

		i = 0;
		for (const { pos, type } of order) {
			if (visualizeOrder)
				visual.text(i++, pos);
			if (commit)
				room.addToBuildQueue(pos, type);
		}
	}

	/**
	 * Transforms controller structures
	 */
	static structuresAllowable(roomName) {
		const room = Game.rooms[roomName];
		if (!room)
			return "You don't have visibility in this room";
		return _.transform(CONTROLLER_STRUCTURES, (r, v, k) => r[k] = v[room.controller.level]);
	}

}

module.exports = BuildPlanner;
/** */
'use strict';

import { RLD } from '/lib/util';
import { Log } from '/os/core/Log';
import { CONSTRUCTION_MATRIX } from '/cache/costmatrix/ConstructionSiteMatrixCache';

const STRUCTURE_MIN_RANGE = { // Range 2 for nuke safety?	
	[STRUCTURE_SPAWN]: 2,	// Minimum two to prevent blockage and nukes
	[STRUCTURE_LINK]: 2,	// Minimum two to prevent blockage
	[STRUCTURE_TOWER]: 2,
	[STRUCTURE_TERMINAL]: 2,
	[STRUCTURE_STORAGE]: 2,
	[STRUCTURE_EXTENSION]: 1,
	[STRUCTURE_ROAD]: 1,
	[STRUCTURE_CONTROLLER]: 2,
	[STRUCTURE_POWER_SPAWN]: 2,
};

const DEFAULT_ORIGIN_RADIUS = 1;
const DEFAULT_STUFF_TO_PLAN = RLD([1, STRUCTURE_TERMINAL, CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8], STRUCTURE_EXTENSION, 3, STRUCTURE_SPAWN, 1, STRUCTURE_OBSERVER, 1, STRUCTURE_STORAGE, 1, STRUCTURE_POWER_SPAWN, 1, STRUCTURE_NUKER, 6, STRUCTURE_TOWER]);

/**
 * ES6 class for searching for build locations with PathFinder.search
 * in flee mode.
 *
 * (new CFleePlanner()).mergeCurrentPlan().run().draw()
 * (new CFleePlanner(null,new RoomPosition(21,15,'W4N9'))).mergeCurrentPlan().run().draw(true)
 * (new CFleePlanner(null,new RoomPosition(16,37,'W2N9'))).mergeCurrentPlan().run().draw(true)
 * (new CFleePlanner(null,new RoomPosition(12,35,'W3N9'))).mergeCurrentPlan().run().draw(true)
 * 
 * Note: The first structures in the array tend to be towards the center.
 * @todo coroutine iterative planner (each cycle rebuild )
 */
export default class FleePlanner {
	// Single-pass priority queue, two cost matricies, and a stored plan.
	/**
	 * Goals should be pre-built.
	 * Cost matrix should be pre-built if goals.
	 */
	constructor(goals, origin, opts = {}) {
		this.origin = origin;								// Initial point to expand outwards from.
		this.radius = opts.radius || DEFAULT_ORIGIN_RADIUS;	// Minimum radius from initial point.
		this.minRange = 1;									// Minimum range a structure must be from another.
		this.maxRange = 4;									// Maximum range a structure can be from another.

		this.goals = goals || [{ pos: this.origin, range: this.radius }];
		this.cm = opts.cm || CONSTRUCTION_MATRIX.copy(this.origin.roomName) || new PathFinder.CostMatrix;
		this.plan = [];
		this.stuffToAdd = opts.stuffToAdd || DEFAULT_STUFF_TO_PLAN;
		if (opts.shuffle)
			this.stuffToAdd = _.shuffle(this.stuffToAdd);
		this.seed = 4;										// If we use a pRNG we want a seed.
		this.iteration = 0;									// Iteration might be important if we use a PRNG
		this.incomplete = true;								// State of planner, not path result.

		this.roomCallback = () => this.cm;					// PathFinder stuff
		this.maxRooms = 1;
		// this.heuristicWeight = 1.1;
		this.heuristicWeight = 0.9;
		this.plainCost = 2;
		this.swampCost = 5;
		this.flee = true;
		this.maxCost = CREEP_LIFE_TIME;
		this.maxOps = 2500;
		this.cpu = 0;
		this.drawRoad = false;
		this.visual = new RoomVisual(this.origin.roomName);
		this.terrain = Game.map.getRoomTerrain(this.origin.roomName);
		_.merge(this, opts);
	}

	/**
	 * Optionally incorperate the current room stuff into the plan.
	 */
	mergeCurrentPlan() {
		var room = Game.rooms[this.origin.roomName];
		room.find(FIND_SOURCES).forEach(s => this.goals.push({ pos: s.pos, range: 3 }));
		room.find(FIND_MINERALS).forEach(s => this.goals.push({ pos: s.pos, range: 2 }));
		room.find(FIND_NUKES).forEach(s => this.goals.push({ pos: s.pos, range: NUKE_EFFECT_RANGE + 1 }));
		room.find(FIND_EXIT).forEach(exit => this.goals.push({ pos: exit, range: 5 }));
		room.find(FIND_STRUCTURES).forEach(({ pos, structureType }) => this.set(pos, structureType, false));
		return this;
	}


	/**
	 * Given the current state search for a place to put something:
	 * If you want it shuffled, shuffle before.
	 * Search, Validate, Commit
	 */
	search(structureType, tempGoals) {
		if (!structureType)
			return false;
		var goals = this.cloneGoals(structureType);
		if (tempGoals)
			goals = goals.concat(tempGoals);
		var ds = Game.cpu.getUsed();
		var { path, ops, cost, incomplete } = PathFinder.search(this.origin, goals, this);
		Log.debug(`Found ${path.length}, cost: ${cost}, ops: ${ops}, incomplete: ${incomplete}`, 'Planner');
		this.cpu += (Game.cpu.getUsed() - ds);
		if (!path || !path.length || incomplete === true || ops === this.maxOps)
			return false;
		// Log.debug(ex(path), 'Planner');		
		this.saveNewPath(path, structureType);
		return true;
	}

	/** The weird bits? */
	saveNewPath(path, structureType) {
		this.visual.poly(path);
		// var dest = _.last(path);
		var dest = path.pop();
		this.set(dest, structureType);
		var rpos;
		while ((rpos = path.pop())) {
			if (this.cm.get(rpos.x, rpos.y) === 1) // interferes with seed road
				break;
			this.set(rpos, STRUCTURE_ROAD); // (Perhaps optional?)
		}
		var points = _.map(HORIZONTALS, (d) => dest.addDirection(d));
		// var points = _.map(DIAGONALS, (d) => dest.addDirection(d));
		while ((rpos = points.pop())) {
			if ((rpos.x + rpos.y) % 2) // (Optional) pRNG chance.
				continue;
			//if(Math.random() < 0.1)
			//	continue;
			if (this.cm.get(rpos.x, rpos.y) !== 1)
				this.set(rpos, STRUCTURE_ROAD);
		}

		return true;
	}

	/**
	 * Register an update to the state of the planner.
	 */
	set(pos, structureType, plan = true) {
		if (this.cm.get(pos.x, pos.y) === 255 || (this.terrain.get(pos.x, pos.y) & TERRAIN_MASK_WALL))
			return;
		if (structureType === STRUCTURE_ROAD)
			this.cm.set(pos.x, pos.y, 1);
		else if (OBSTACLE_OBJECT_TYPES.includes(structureType))
			this.cm.set(pos.x, pos.y, 255);
		var entry = { pos, structureType, range: STRUCTURE_MIN_RANGE[structureType] || 1 };
		this.goals.push(entry);
		if (plan)
			this.plan.push(entry);
	}

	/**
	 * 
	 */
	cloneGoals(planStructureType) {
		return _.map(this.goals, ({ pos, structureType, range }) => ({
			pos, structureType,
			// range: CLAMP(this.minRange || 1, Math.max(range,STRUCTURE_MIN_RANGE[planStructureType] || 1), this.maxRange || 15)
			range: Math.max(this.minRange || 1, range || 1, STRUCTURE_MIN_RANGE[planStructureType] || 1)
		}));
	}

	iterate() {
		if (this.iteration === 0)
			this.initalize();
		var item = this.stuffToAdd.pop();
		this.iteration++;
		return this.search(item);
	}

	/** Do this first */
	initalize() {
		// Doesn't work. Not sure why.
		if (!this.initRoad)
			return;
		Log.debug('Seeding road', 'Planner');
		this.search(STRUCTURE_ROAD, [
			{ pos: this.origin, range: 15 }	// seed road
		]);
		// this.stuffToAdd = [];
	}

	run() {
		while (this.iterate() !== false) { /* wait */ }
		this.incomplete = false;
		if (this.finish)
			this.finish();
		Log.debug(`Used ${this.cpu} cpu`, 'FleePlanner');
		return this;
	}

	draw(road = false) {
		const [a, b] = _.partition(this.plan, ({ structureType }) => structureType === STRUCTURE_ROAD);
		if (road) {
			_.each(a, (item) => this.visual.structure(item.pos.x, item.pos.y, item.structureType, { opacity: 0.05 }));
			this.visual.connectRoads();
		}
		_.each(b, (item) => this.visual.structure(item.pos.x, item.pos.y, item.structureType, { opacity: 0.75 }));
	}

	toString() {
		return `[FleePlanner]`; // Include state?
	}
}
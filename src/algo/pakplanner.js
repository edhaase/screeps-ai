/** */
'use strict';

/* global Log */

import { RLD } from '/lib/util';
import { Log, LOG_LEVEL } from '/os/core/Log';

const DEFAULT_STUFF_TO_PLAN = RLD([1, STRUCTURE_TERMINAL, CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8], STRUCTURE_EXTENSION, 3, STRUCTURE_SPAWN, 1, STRUCTURE_OBSERVER, 1, STRUCTURE_STORAGE, 1, STRUCTURE_POWER_SPAWN, 1, STRUCTURE_NUKER, 6, STRUCTURE_TOWER]);
import dt from '/algo/dt';

export default class PakPlanner {
	constructor(goals, origin, opts = {}) {
		this.origin = origin;								// Initial point to expand outwards from.
		this.radius = opts.radius || 5;	// Minimum radius from initial point.

		this.goals = goals || [{ pos: this.origin, range: this.radius }];
		this.cm = opts.cm || new PathFinder.CostMatrix;
		this.plan = [];
		this.stuffToAdd = opts.stuffToAdd || DEFAULT_STUFF_TO_PLAN;
		if (opts.shuffle)
			this.stuffToAdd = _.shuffle(this.stuffToAdd);
		this.seed = 4;										// If we use a pRNG we want a seed.
		this.iteration = 0;									// Iteration might be important if we use a PRNG
		this.incomplete = true;								// State of planner, not path result.
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

	transform() {
		this.transform = dt(this.origin.roomName, (x, y) => this.cm.get(x, y) === 255);
		return this;
	}

	/**
	 * Given the current state search for a place to put something:
	 * If you want it shuffled, shuffle before.
	 * Search, Validate, Commit
	 */
	search(structureType, tempGoals) {

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
		var entry = { pos, structureType, range: 1 };
		this.goals.push(entry);
		if (plan)
			this.plan.push(entry);
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
		console.log(`Used ${this.cpu} cpu`);
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

module.exports = PakPlanner;
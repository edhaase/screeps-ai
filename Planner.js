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
"use strict";

// @todo Find way to preserve road plan from expiring.
// @todo Put terminal within range 2 of controller.

// Utilize a PathFinder.CostMatrix to mark extra obstacles,
// including cloning the matix during selection phase to ensure everyone gets their
// own spot.

// Total costs: _.sum(Game.constructionSites, s => CONSTRUCTION_COST[s.structureType])
// Current build power needed: _.sum(Game.constructionSites, s => s.progressTotal - s.progress);
// _(Game.flags).filter('color', COLOR_BLUE).map('pos').invoke('createConstructionSite', STRUCTURE_ROAD)

/* var a = {
	[STRUCTURE_NUKER]: CONTROLLER_STRUCTURES[STRUCTURE_NUKER][level],	
} */

global.BIT_BUILD_ROAD = (1 << 0); // Enable road building

// Labs must be built close together.
// Roads fill in the gaps
// Links go near controllers, sources, and terminal/storage (if multiple points, pick closer?)
// const RANDO_STRUCTURES = [STRUCTURE_LAB, STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_OBSERVER];
const RANDO_STRUCTURES = [STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_OBSERVER];
// const RANDO_STRUCTURES = [STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER];
const MINIMUM_LEVEL_FOR_LINKS = _.findKey(CONTROLLER_STRUCTURES[STRUCTURE_LINK]);

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

const STRUCTURE_MIN_RANGE =
	{ // Range 2 for nuke safety?	
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
 */
class FleePlanner {
	// Single-pass priority queue, two cost matricies, and a stored plan.
	/**
	 * Goals should be pre-built.
	 * Cost matrix should be pre-built if goals.
	 */
	constructor(goals, origin = new RoomPosition(17, 24, 'W2N2'), opts = {}) {
		this.origin = origin;								// Initial point to expand outwards from.
		this.radius = opts.radius || 1;						// Minimum radius from initial point.
		this.minRange = 1;									// Minimum range a structure must be from another.
		this.maxRange = 4;									// Maximum range a structure can be from another.

		this.goals = goals || [{ pos: this.origin, range: this.radius || 2 }];
		this.cm = opts.cm || new PathFinder.CostMatrix;
		this.plan = [];
		this.stuffToAdd = opts.stuffToAdd || Util.RLD([1, STRUCTURE_TERMINAL, CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8], STRUCTURE_EXTENSION, 3, STRUCTURE_SPAWN, 1, STRUCTURE_OBSERVER, 1, STRUCTURE_STORAGE, 1, STRUCTURE_POWER_SPAWN, 1, STRUCTURE_NUKER, 6, STRUCTURE_TOWER]);
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
		_.merge(this, opts);
	}

	/**
	 * Optionally incorperate the current room stuff into the plan.
	 */
	mergeCurrentPlan() {
		var room = Game.rooms[this.origin.roomName];
		room.find(FIND_SOURCES).forEach(s => this.goals.push({ pos: s.pos, range: 3 }));
		room.find(FIND_MINERALS).forEach(s => this.goals.push({ pos: s.pos, range: 2 }));
		room.find(FIND_NUKES).forEach(s => this.goals.push({ pos: s.pos, range: 2 }));
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
		var goals = this.cloneGoals();
		if (tempGoals)
			goals = goals.concat(tempGoals);
		var ds = Game.cpu.getUsed();
		var { path, ops, cost, incomplete } = PathFinder.search(this.origin, goals, this);
		Log.warn(`Found ${path.length}, cost: ${cost}, ops: ${ops}, incomplete: ${incomplete}`, 'Planner');
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
		while (rpos = path.pop()) {
			if (this.cm.get(rpos.x, rpos.y) === 1) // interferes with seed road
				break;
			this.set(rpos, STRUCTURE_ROAD); // (Perhaps optional?)
		}
		var points = _.map(HORIZONTALS, (d) => dest.addDirection(d));
		// var points = _.map(DIAGONALS, (d) => dest.addDirection(d));
		while (rpos = points.pop()) {
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
		if (this.cm.get(pos.x, pos.y) === 255 || Game.map.getTerrainAt(pos) === 'wall')
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
			// range: Math.clamp(this.minRange || 1, Math.max(range,STRUCTURE_MIN_RANGE[planStructureType] || 1), this.maxRange || 15)
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
global.CFleePlanner = FleePlanner;

// @todo: Account for the structures gained at each level,
// or just pre-plan it all and deal with it?
// @todo: Keep the shuffle or drop it? I kind of like the randomness.
class BuildPlanner {
	static pushRoomUpdates() {
		var rooms = _.filter(Game.rooms, 'my');
		rooms = _.shuffle(rooms);
		_.each(rooms, ({ name }) => Command.push(`require('Planner').buildRoom(Game.rooms['${name}'])`));
	}

	/**
	 * Automates room construction - Currently centered around room controller.
	 *
	 * Very, very high cpu. Won't run with bucket limiter engaged.
	 * This should probably not be run for more than one room per tick. 
	 *
	 * Likely to be called by the room controller periodically, or on level up.
	 * should have controller bit for disabling this.
	 *
	 * @param Room room - current room object needed
	 * Use time estimations (progress()?) to defer things 
	 * ex: Call every CREEP_LIFE_TIME + margin to rebuild
	 * ex: Suggest calling from controller? Planner.buildRoom(this.room)
	 */
	static buildRoom(room) {
		if (BUCKET_LIMITER)
			return ERR_TIRED;
		var { level } = room.controller;
		if (level < 1) // Let's get the easy stuff out of the way.
			return ERR_RCL_NOT_ENOUGH; // We can't build anything at rcl 0
		if (!room.isBuildQueueEmpty())
			return ERR_BUSY;
		if (!_.isEmpty(room.find(FIND_MY_CONSTRUCTION_SITES)))
			return ERR_BUSY;
		Log.warn(`Building room: ${room.name} on tick ${Game.time}`, 'Planner');
		var {pos,radius} = room.getOrigin();
		var avail = room.getStructuresWeCanBuild();
		var want = [];
		_.each(RANDO_STRUCTURES, (type) => {
			want.push(avail[type]);
			want.push(type);
		});
		want = Util.RLD(want);
		if (_.isEmpty(want)) {
			Log.debug('Nothing to build', 'Planner');
			// return;
		} else {
			/* var plan = this.uberPlan(pos, want, {
				drawRoad: true, plainCost: 2, swampCost: 3, heuristicWeight: 0.9,
				radius: radius
			}); */
			var fleePlanner = new FleePlanner(null, pos, {
				stuffToAdd: want
			});
			fleePlanner.mergeCurrentPlan().run().draw(true);
			var {plan} = fleePlanner;
			// @todo move to build planner
			// _.each(plan, ({pos,structureType}) => pos.createConstructionSite(structureType));
			_.each(plan, ({ pos, structureType }) => Game.rooms[pos.roomName].addToBuildQueue(pos, structureType, DEFAULT_BUILD_JOB_EXPIRE, STRUCTURE_BUILD_PRIORITY[structureType] || 0.5));
		}
		// Then build other stuff
		this.placeRamparts(room);
		// this.placeRampartsOnWalls(room); // Really a waste of energy over a second layer of wall
		if (level >= 3) {
			this.buildSourceRoads(room, pos, room.controller.level === 3);
			this.buildControllerWall(pos, room.controller);
		}
		if (level >= MINIMUM_LEVEL_FOR_LINKS)
			this.buildLinks(pos,level);
		this.findRoadMisplacements(room).invoke('destroy').commit();
		// if(level >= 3)
		//	this.exitPlanner(room.name, {commit: true});
		if (level >= 6) {
			const { mineral } = room;
			if (mineral && !mineral.pos.hasStructure(STRUCTURE_EXTRACTOR)) {
				room.addToBuildQueue(mineral.pos, STRUCTURE_EXTRACTOR);
			}
			if (room.terminal)
				this.planRoad(room.terminal.pos, { pos: mineral.pos, range: 1 }, { rest: true, initial: true, container: true });
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
			throw new Error('Room must be visible');
		Log.debug(`Building links from ${origin} for level ${level}`, 'Planner');
		const { controller, sources } = room;
		// controller first
		let status = controller.planLink(3,1);
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
	 * @param {*} origin
	 * @param {*} controller
	 */
	static buildControllerWall(origin, controller) {

	}

	/**
	 * Interesting results even without updating cost matrix..
	 * ex(PathFinder.search(new RoomPosition(43,42,'W6N3'),[{pos: new RoomPosition(43,42,'W6N3'), range: 3},{pos: new RoomPosition(46,39,'W6N3'), range: 1}], {flee:true}))
	 * ex(PathFinder.search(new RoomPosition(43,42,'W6N3'),[{pos: new RoomPosition(43,42,'W6N3'), range: 3},{pos: new RoomPosition(46,39,'W6N3'), range: 1},{pos: new RoomPosition(46,40,'W6N3'), range: 1}], {flee:true}))
	 * Notes: Cost matrix must be built correctly. Roads are cheap, structures are obstacles.
	 * Should be able to re-call for missing structures
	 *
	 * (new CostMatrix.CostMatrix(Game.rooms['W6N3'])).setFixedObstacles().setRoad().draw()
	 * Planner.uberPlan(new RoomPosition(39,12,'W7N4'))
	 * @todo: Occasionally it can't find a plan. It should retry.
	 * @todo: Instead of unwalkable crosshatch, try just a _slightly_ higher weight like 3?
	 * @todo: Weigh all extensions and spawns closer together. Walking all that distance will suck.
	 * @todo: Recurse and backtrack on failure? or just retry?
	 *
	 * example: Planner.uberPlan(new RoomPosition(43,42,'W6N3'))
	 * example: Planner.uberPlan(new RoomPosition(38,7,'W5N3'),null,{drawRoad:true,plainCost:2,swampCost:3,heuristicWeight:1.0})
	 * example: Planner.uberPlan(new RoomPosition(43,42,'W6N3'),null,{drawRoad:true,plainCost:2,swampCost:3,heuristicWeight:0.9})
	 * example: Planner.uberPlan(new RoomPosition(31,20,'W2N7'),null,{drawRoad:true,ignoreCurrentPlan:true})
	 */
	static uberPlan(origin, stuffToAdd, opts = {}) {
		_.defaults(opts, {
			shuffle: false,
			radius: 1,
			draw: true,
			drawRoad: false,
			ignoreCurrentPlan: false,
			ignoreRoad: false,
			ignoreStructures: false,
			plainCost: 2,
			swampCost: 3,
			heuristicWeight: 0
		});

		// Set up initial goal.
		var used = 0;
		var start = Game.cpu.getUsed();
		var goals = [{ pos: origin, range: opts.radius || 2 }];
		var room = Game.rooms[origin.roomName];
		room.find(FIND_SOURCES).forEach(s => goals.push({ pos: s.pos, range: 2 }));
		room.find(FIND_MINERALS).forEach(s => goals.push({ pos: s.pos, range: 2 }));
		room.find(FIND_NUKES).forEach(s => goals.push({ pos: s.pos, range: 2 }));
		// var goals = [{pos: room.controller.pos, range: 2}];		

		// testing
		if (!stuffToAdd) {
			// stuffToAdd = Util.RLD([10,STRUCTURE_EXTENSION,1,STRUCTURE_SPAWN]);
			// stuffToAdd = Util.RLD([20,STRUCTURE_EXTENSION,3,STRUCTURE_SPAWN]);
			// stuffToAdd = Util.RLD([1,'terminal',3,STRUCTURE_SPAWN,6,'tower',1,STRUCTURE_OBSERVER,1,STRUCTURE_STORAGE,1,'powerSpawn',1,'nuker',60,STRUCTURE_EXTENSION]);
			// stuffToAdd = Util.RLD([1,'terminal',60,STRUCTURE_EXTENSION,3,STRUCTURE_SPAWN,6,'tower',1,STRUCTURE_OBSERVER,1,STRUCTURE_STORAGE,1,'powerSpawn',1,'nuker']);
			stuffToAdd = Util.RLD([1, 'terminal', 60, STRUCTURE_EXTENSION, 6, 'tower', 3, STRUCTURE_SPAWN, 1, STRUCTURE_OBSERVER, 1, STRUCTURE_STORAGE, 1, 'powerSpawn', 1, 'nuker']);
			// stuffToAdd = Util.RLD([1,'spawn',5,'extension',]);
		}
		if (opts.shuffle)
			stuffToAdd = _.shuffle(stuffToAdd);

		if (_.isEmpty(stuffToAdd)) {
			Log.debug('Nothing to plan!', 'Planner');
			return [];
		}
		// ES6 PathFinder extension class?

		// Set up cost matrix and existing goals.
		var cm;
		if (opts.costMatrix !== undefined)
			cm = opts.costMatrix.clone();
		else {
			cm = new CostMatrix.CostMatrix;
		}
		// Register existing structures
		// (Optional)
		// It's best if we have visibility and avoid exits directly, rather just a box. Or use describeExits and block walls.
		if (room) {
			used = Time.measure(() => _.each(room.find(FIND_EXIT), (exit) => goals.push({ pos: exit, range: 5 })));
			Log.debug('Blocked off exits in ' + used + ' cpu', 'Planner');
			if (!opts.ignoreCurrentPlan) {
				used = Time.measure(() => this.mergeCurrentPlan(room, goals, cm, opts));
				Log.debug(`Merged current state in ${used} cpu`, 'Planner');
			}
		} else {
			used = Time.measure(() => cm.setBorderUnwalkable(2));
			Log.debug('Blocked off border tiles in ' + used + ' cpu', 'Planner');
		}
		// var draw = (path) => 
		var cursor = origin; // room.controller.pos;
		// while _stuff to add_.
		var newStuff = [];

		var item;
		while (item = stuffToAdd.shift()) {
			this.plan(cursor, goals, newStuff, cm, item, opts);
			// used = Time.measure( () =>  );		
			// Log.warn(`Used ${used} cpu`);
		}
		// cm.draw(room.name);			
		var end = Game.cpu.getUsed() - start;
		Log.debug('Planner total time: ' + end, 'Planner');
		// @todo: Draw roads first.
		if (opts.draw) {
			var visual = new RoomVisual(origin.roomName);
			const [a, b] = _.partition(newStuff, ({ structureType }) => structureType === STRUCTURE_ROAD);
			if (opts.drawRoad === true) {
				_.each(a, (item) => visual.structure(item.pos.x, item.pos.y, item.structureType, { opacity: 0.05 }));
				visual.connectRoads();
			}
			_.each(b, (item) => visual.structure(item.pos.x, item.pos.y, item.structureType, { opacity: 0.75 }));
		}
		// console.log(ex(newStuff));
		// ..set cursor?
		// visualize?
		return newStuff;
	}

	static mergeCurrentPlan(room, goals, cm, opts) {
		_.each(room.find(FIND_STRUCTURES), ({ pos, structureType }) => {
			if (!opts.ignoreRoad && structureType === STRUCTURE_ROAD) {
				cm.set(pos.x, pos.y, 1);
				goals.push({ pos, range: 1, structureType });
			} else if (!opts.ignoreStructures && OBSTACLE_OBJECT_TYPES.includes(structureType)) {
				cm.set(pos.x, pos.y, 255);
				goals.push({
					pos,
					range: (STRUCTURE_MIN_RANGE[structureType] || 1),
					structureType
				});
			}
		});
	}

	/**
	 * This is where we actually update the plan.
	 */
	static plan(origin, goals, newStuff, cm, planStructureType, opts) {
		var {
			plainCost = 2,
			swampCost = 3,
			heuristicWeight = 0.9
		} = opts || {};
		var room = Game.rooms[origin.roomName];
		var mgoals;
		/* if(opts.minRange)
			mgoals = _.map(goals, ({pos,structureType,range}) => ({pos,structureType,range: Math.max(Math.max(range,opts.minRange),STRUCTURE_MIN_RANGE[planStructureType] || 1)}));		
		else
			mgoals = _.map(goals, ({pos,structureType,range}) => ({pos,structureType,range: Math.max(range,STRUCTURE_MIN_RANGE[planStructureType] || 1)}));		 */

		mgoals = _.map(goals, ({ pos, structureType, range }) => ({
			pos,
			structureType,
			range: Math.clamp(opts.minRange || 1, Math.max(range, STRUCTURE_MIN_RANGE[planStructureType] || 1), opts.maxRange || 15)
		}));

		// console.log(ex(mgoals));
		var { path, ops, cost, incomplete } = PathFinder.search(origin, mgoals, {
			flee: true,
			roomCallback: () => cm,
			maxRooms: 1,
			maxCost: CREEP_LIFE_TIME, // Perhaps lower?			
			plainCost, swampCost,
			maxOps: 2500, // Perhaps higher given the work we do.
			heuristicWeight
		});
		var dest = _.last(path);
		if (!path || incomplete === true) {
			Log.warn(`Found ${dest}, cost: ${cost}, ops: ${ops}, incomplete: ${incomplete}`, 'Planner');
			Log.warn('Unable to find path!', 'Planner');
			return false;
		}
		if (opts.draw)
			new RoomVisual().poly(path);		
		Log.warn(`Found ${dest}, cost: ${cost}, ops: ${ops}, incomplete: ${incomplete}`, 'Planner');
		cm.set(dest.x, dest.y, 255);
		var entry = {
			pos: dest,
			range: STRUCTURE_MIN_RANGE[planStructureType] || 1,
			structureType: planStructureType
		};
		goals.push(entry); // what range?
		newStuff.push(entry);
		// work backwards placing road
		path.pop();
		var rpos;
		while (rpos = path.pop()) {
			if (cm.get(rpos.x, rpos.y) === 1) { // Why isn't this working?
				// origin = rpos;
				break;
			}
			cm.set(rpos.x, rpos.y, 1);
			entry = { pos: rpos, range: 1, structureType: STRUCTURE_ROAD };
			goals.push(entry);
			newStuff.push(entry);
		}

		// place road on horizontals.
		// This is still neccesary (As flee goals)
		var points = _.map(HORIZONTALS, (d) => dest.addDirection(d));
		while (rpos = points.pop()) {
			if (cm.get(rpos.x, rpos.y) === 1 || (room && !rpos.isOpen()))
				continue;
			if ((rpos.x + rpos.y) % 2)
				continue;
			cm.set(rpos.x, rpos.y, 1);
			entry = { pos: rpos, range: 1, structureType: STRUCTURE_ROAD };
			goals.push(entry);
			newStuff.push(entry);
		}
		// origin = dest;
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
	static distanceTransform(roomName, rejector = (x, y, roomName) => Game.map.getTerrainAt(x, y, roomName) === 'wall') {
		var vis = new RoomVisual(roomName);
		var topDownPass = new PathFinder.CostMatrix();
		var x, y;

		for (y = 0; y < 50; ++y) {
			for (x = 0; x < 50; ++x) {
				// if (Game.map.getTerrainAt(x, y, roomName) == 'wall') {
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

	static drawAvgRange(room) {
		var roomName = room.name;
		var vis = room.visual;
		var x, y, pos, dist;
		var c = room.controller;
		var s = room.find(FIND_SOURCES);
		var points = [c, ...s];
		console.log('points: ' + points);
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
				vis.circle(x, y, { fill: 'red', radius: dist / 75 });
			}
		}
	}

	/**
	 * Finds a position in a room to expand outwards from.
	 * 
	 * @param {Room} room - Room object to analyze
	 * @param {Number} maxClearance - Score above which extra clearance doesn't really matter
	 */
	static distanceTransformWithController(room, maxClearance = 5) {
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
				// dist = pos.getRangeTo(c);
				dist = Math.ceil(pos.getAverageRange(points));
				// value = cm.get(x,y) / (dist / 25);
				if (dist < 3)
					continue;
				// value = Math.pow(cm.get(x,y),2);
				clear = Math.min(cm.get(x, y), maxClearance);
				value = Math.pow(clear, 2);
				value /= dist;
				if (value > maxv) {
					maxv = value;
					maxp = pos;
					maxc = clear;
				}
				vis.circle(x, y, { radius: value / 25 });
			}
		}
		console.log(`Best position: ${maxp} with score ${maxv} and clearance ${maxc}`);
		// console.log('Best position: ' + maxp + ' with score ' + maxv);
		return maxp;
	}

	/**
	 * @kshepards clearance matrix
	 * Top-left scoring, single pass. Great for space-fitting prefabs
	 */
	static gsm(roomName) {
		var matrix = []; // : number[][] = [];
		var x = 49;
		for (; x >= 0; x--) {
			matrix[x] = [];
			var y = 49;
			for (; y >= 0; y--) {
				if (x >= 47 || y >= 47 || x <= 2 || y <= 2) {
					// Set everything to 0 on the room edge, up to the walls
					matrix[x][y] = 0;
				} else if (x === 46 || y === 46) {
					// Bottom or right edge (the 'end' of a square)
					matrix[x][y] = Game.map.getTerrainAt(x, y, roomName) === 'wall' ? 0 : 1;
				} else {
					// Not a room edge or bottom/right edge
					if (Game.map.getTerrainAt(x, y, roomName) === 'wall') {
						matrix[x][y] = 0;
					} else {
						matrix[x][y] = 1 + Math.min(
							matrix[x + 1][y], // East
							matrix[x][y + 1], // South
							matrix[x + 1][y + 1] // South-east
						);
					}
				}
			}
		}
		// return matrix;
		console.log(matrix);
		return CostMatrix.CostMatrix.fromArrayMatrix(matrix);
	}

	/**
	 * Must path within range (Adjacent for source), but road can stop one shorter.
	 * For controller, road only needs to path to range 3.
	 */
	static buildSourceRoads(room, origin, containers = true) {
		if (origin == null)
			throw new Error("Origin position required");
		const sources = room.find(FIND_SOURCES);
		_.each(sources, source => this.planRoad(origin, { pos: source.pos, range: 1 }, { rest: 1, initial: 1, container: containers }));
		if (room.controller && room.controller.level >= 6 && sources.length > 1) {
			var [s1, s2] = sources;
			this.planRoad(s1, { pos: s2.pos, range: 1 }, { rest: 1, initial: 1 });
		}
	}

	/**
	 * Game.rooms['W6N3'].visual.poly(PathFinder.search(new RoomPosition(44,41,'W6N3'), new RoomPosition(7,42,'W6N3'), {heuristicWeight: 1.2, plainCost: 2, swampCost: 2}).path)
	 */
	static planRoad(fromPos, toPos, opts = {}) {
		// Planner.planRoad(Game.getObjectById('0cca984923d4f5a78ed40185').pos, Game.spawns.Spawn1.pos)
		if (fromPos.pos)
			fromPos = fromPos.pos;
		// if(toPos.pos)
		//	toPos = toPos.pos;
		if (opts.cmFn === undefined)
			opts.cmFn = function (roomName) {
				// return (new CostMatrix.FixedObstacleMatrix(roomName)).setRoad();
				var cm = new PathFinder.CostMatrix;
				Game.rooms[roomName]
					.find(FIND_STRUCTURES)
					.forEach(function (s) {
						if (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER)
							cm.set(s.pos.x, s.pos.y, 1);
						else if (OBSTACLE_OBJECT_TYPES.includes(s.structureType))
							cm.set(s.pos.x, s.pos.y, 255);
					});
				return cm;
			};
		/* opts.cmFn = function(roomName) {
			let cm = new CostMatrix.FixedObstacleMatrix(roomName); // .setRoad());
			// cm.setRoad(roomName);
			return cm;
		} */
		// if(toPos.pos)
		//	toPos = toPos.pos;
		// Use transport for this?
		try {
			// if(_.isObject(toPos) && !(toPos instanceof RoomPosition))
			//	toPos = [toPos];
			var result = PathFinder.search(fromPos, toPos, {
				plainCost: 2, // prefer existing roads
				swampCost: 2,
				maxOps: 8000,
				maxRooms: 1,
				roomCallback: opts.cmFn
			});
			var { path, incomplete, cost, ops } = result;
			if (incomplete || !path || _.isEmpty(path)) {
				Log.warn('No path to goal ' + JSON.stringify(toPos), 'Planner#planRoad');
				Log.warn(`cost ${cost} ops ${ops} steps ${path.length}`);
				Log.warn(JSON.stringify(fromPos) + ', ' + JSON.stringify(toPos));
				Log.warn(JSON.stringify(result));
				Log.warn(opts.cmFn);
				return ERR_NO_PATH;
			}
			path = _.drop(path, opts.rest);
			if (opts.container) {
				var end = _.last(path);
				if (!end.hasStructure(STRUCTURE_CONTAINER))
					Game.rooms[end.roomName].addToBuildQueue(end, STRUCTURE_CONTAINER);
			}
			path = _.dropRight(path, opts.initial);
			new RoomVisual(path[0].roomName).poly(path);
			Log.debug(`Road found, cost ${cost} ops ${ops} incomplete ${incomplete}`, 'Planner');
			if (!opts.dry) {
				_.each(path, p => {
					if (!p.hasStructure(STRUCTURE_ROAD))
						Game.rooms[p.roomName].addToBuildQueue(p, STRUCTURE_ROAD);
				});
			}
		} catch (e) {
			console.log(e.stack);
			console.log(ex(fromPos));
			console.log(ex(toPos));
		}
		// _.each(path, p => p.createConstructionSite(STRUCTURE_ROAD));
	}

	static saveCurrentWorldPlan() {
		var structs = _.filter(Game.structures, s => s.structureType !== STRUCTURE_CONTROLLER && s.structureType !== STRUCTURE_RAMPART);
		var plan = _.map(structs, ({ pos, structureType }) => ({ pos, structureType }));
		const size = Util.withMemorySegment(SEGMENT_BUILD, function (obj) {
			obj.plan = plan;
		});
		console.log('New segment size: ' + size);
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
		// validator = ((pos) => Game.map.getTerrainAt(pos) !== 'wall'),
		validator = (pos) => Game.map.getTerrainAt(pos) !== 'wall' && !pos.isOnRoomBorder() && !pos.hasObstacle(),
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
			// if(Game.map.getTerrainAt(point.x,point.y,point.roomName) == 'wall')
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
		console.log('Used: ' + used);
		console.log('Count: ' + count);
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
		// Maybe lower this to 2.
		if (_.get(room, 'controller.level', 0) < 3) // ignore until we get a tower up
			return ERR_RCL_NOT_ENOUGH;
		var protect = [STRUCTURE_STORAGE, STRUCTURE_SPAWN, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_TOWER, STRUCTURE_POWER_SPAWN];
		var start = Game.cpu.getUsed();
		var structures = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType !== STRUCTURE_RAMPART });
		if (!_.any(structures, s => s.structureType === STRUCTURE_TOWER)) {
			console.log(`No towers in ${room.name}, unable to auto-rampart`);
			return ERR_NOT_FOUND;
		}
		_.each(structures, function (s) {
			if (!protect.includes(s.structureType))
				return;
			var isRamparted = s.pos.hasRampart();
			if (isRamparted)
				return;
			console.log(s + ' at pos ' + s.pos + ' has rampart: ' + isRamparted);
			// s.pos.createConstructionSite(STRUCTURE_RAMPART);			
			room.addToBuildQueue(s.pos, STRUCTURE_RAMPART);
		});
		var used = Game.cpu.getUsed() - start;
		console.log(`Updating auto-ramparts in ${room.name} took ${used} cpu`);
		return used;
	}

	/**
	 * Auto-rampart any walls at max hits.
	 * 
	 * Probably to be called almost never.
	 */
	static placeRampartsOnWalls(room) {
		var walls = room.find(FIND_STRUCTURES, {
			filter: s => s.structureType === STRUCTURE_WALL && s.hits === s.hitsMax
		});
		_.each(walls, function (wall) {
			if (CPU_LIMITER || wall.pos.hasRampart() || wall.pos.isEnclosed())
				return;
			// wall.pos.createConstructionSite(STRUCTURE_RAMPART);
			room.addToBuildQueue(wall.pos, STRUCTURE_RAMPART);
			Log.notify(`Wall at ${wall.pos} at full hits, ramparting!`);
		});
	}

	/**
	 * Look for roads that are wasting resources by existing under stuff
	 * To be called once a day? once a week?
	 * May generalize to other things that should exist in the same layer?
	 */
	static findRoadMisplacements(room) {
		return _(room.find(FIND_STRUCTURES))
			.filter('structureType', STRUCTURE_ROAD)
			.filter(s => s.pos.hasObstacle());
	}

	/**
	 * Planner.planExitWalls(Game.rooms['W8N4'], {visualize:true,commit:false});
	 */
	static planExitWalls(room, { visualize = true, commit = true }) {
		var start = Game.cpu.getUsed();
		var exits = room.find(FIND_EXIT); // all exit tiles.

		var x, y, p, minExit;
		for (x = 1; x < 49; x++)
			for (y = 1; y < 49; y++) {
				if ((x >= 3 && x <= 46) && (y >= 3 && y <= 46))
					continue;
				if (Game.map.getTerrainAt(x, y, room.name) === 'wall')
					continue;
				p = room.getPositionAt(x, y);
				if (p.hasObstacle())
					continue;
				minExit = _.min(exits, e => e.getRangeTo(p));
				if (minExit.getRangeTo(p) !== 2)
					continue;
				var color = (x + y) % 2;
				// console.log('exit found: ' + p);
				// Command.push("_.create(RoomPosition.prototype, " +  JSON.stringify(p) +  ").createFlag(null, FLAG_CONSTRUCTION, " + color + ")")
				if (commit) {
					var type = (color) ? STRUCTURE_WALL : STRUCTURE_RAMPART;
					if (!p.hasStructure(type))
						p.createConstructionSite(type);
				}
				// Command.push("_.create(RoomPosition.prototype, " +  JSON.stringify(p) +  ").createFlag(null, FLAG_CONSTRUCTION, " + COLOR_WHITE + ")");
				if (visualize) {
					if (color)
						room.visual.circle(p, { fill: 'black' });
					else
						room.visual.circle(p, { fill: 'green' });
				}
			}
		var used = Game.cpu.getUsed() - start;
		console.log(`Planner used ${used} cpu`);
	}

	/**
	 * Attempt to obstacle exits. Requires origin point.
	 *
	 * Time.measure( () => Planner.exitPlanner('W7N2') )
	 */
	static exitPlanner(roomName, opts = {}) {
		opts = _.defaults(opts, {
			visualize: true,
			commit: false,
			ignorePlan: false
		});
		var cm = new PathFinder.CostMatrix;
		var room = Game.rooms[roomName];
		// var visual = room.visual;		
		var visual = new RoomVisual(roomName);
		if (room) {
			if (!opts.origin)
				opts.origin = _.create(RoomPosition.prototype, room.memory.origin);
			if (!opts.origin) {
				Log.warn('No origin');
				return;
			}
			var exits = room.find(FIND_EXIT).map(e => ({ pos: e, range: 0 }));
			if (!opts.ignorePlan)
				room.find(FIND_STRUCTURES).forEach(({ pos, structureType }) => {
					if (structureType === STRUCTURE_RAMPART || OBSTACLE_OBJECT_TYPES.includes(structureType))
						cm.set(pos.x, pos.y, 255);
				});
		} else {
			console.log('No room object');
		}
		while (true) {
			var { path, incomplete } = PathFinder.search(opts.origin, exits, { roomCallback: () => cm, maxRooms: 1 });
			if (incomplete)
				break;
			// console.log(JSON.stringify(path));
			var pos = path[path.length - 3];
			cm.set(pos.x, pos.y, 255);
			// var wallOrRampart = (pos.x + pos.y) % 2;
			var wallOrRampart = (pos.x + pos.y) % 3;
			if (opts.commit) {
				var type = (wallOrRampart ? STRUCTURE_WALL : STRUCTURE_RAMPART);
				if (pos.hasStructure(type))
					continue;
				room.addToBuildQueue(pos, type);
			}
			if (opts.visualize) {
				// visual.poly(path);
				visual.circle(pos, { fill: (wallOrRampart ? 'black' : 'green'), opacity: 0.75 });
				// visual.circle(pos, {fill:'red', opacity: 0.75});
			}
		}
	}

	/**
	 * Transforms controller structures
	 */
	static structuresAllowable(room) {
		if (_.isString(room))
			room = Game.rooms[room];
		if (!room)
			return "You don't have visibility in this room";
		return _.transform(CONTROLLER_STRUCTURES, (r, v, k) => r[k] = v[room.controller.level]);
	}

	/**
	 *
	 */
	static clearFlags(plan = PLAN_MARKER) {
		_(Game.flags)
			.filter({ color: FLAG_CONSTRUCTION, secondaryColor: plan })
			.invoke('remove')
			.commit();
	}
}

module.exports = BuildPlanner;
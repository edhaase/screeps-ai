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


/**
 *
 */
Room.prototype.canBuild = function(structureType) {
	if(_.size(Game.constructionSites) >= MAX_CONSTRUCTION_SITES)
		return;
	// let count = _.sum(this.structures, s => s.structureType === structureType)
	let count = (this.structuresByType[structureType] || []).length
			  + _.sum(this.find(FIND_MY_CONSTRUCTION_SITES, {filer: s => s.structureType === structureType}));
	let allowed = CONTROLLER_STRUCTURES[structureType][this.controller.level];
	return allowed >= count;
}

/**
 *
 */
Room.prototype.getStructuresAllowed = function() {
	// return _.transform(CONTROLLER_STRUCTURES, (r,v,k) => r[k] = v[this.controller.level]);
	return CONTROLLER_STRUCTURES_LEVEL_FIRST[this.controller.level];
}

Room.prototype.getStructuresWeCanBuild = function() {
	let level = this.controller.level;
	let have = _.countBy(this.structures, 'structureType');	
	// let have = this.structuresByType;
	return _.mapValues(CONTROLLER_STRUCTURES, (v,k) => v[level] - (have[k] || 0));
}

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
}

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
class FleePlanner
{
	// Single-pass priority queue, two cost matricies, and a stored plan.
	/**
	 * Goals should be pre-built.
	 * Cost matrix should be pre-built if goals.
	 */
	constructor(goals,origin=new RoomPosition(11,37,'W3N9'),opts={}) {		
		this.origin = origin;								// Initial point to expand outwards from.
		this.radius = 1;									// Minimum radius from initial point.
		this.minRange = 1;									// Minimum range a structure must be from another.
		this.maxRange = 4;									// Maximum range a structure can be from another.
				
		this.goals = goals || [{pos: this.origin, range: this.radius || 2}];
		this.cm = opts.cm || new PathFinder.CostMatrix;
		this.plan = [];
		this.stuffToAdd = [];
		this.stuffToAdd = Util.RLD([1,'terminal',CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8],STRUCTURE_EXTENSION,3,STRUCTURE_SPAWN,1,STRUCTURE_OBSERVER,1,STRUCTURE_STORAGE,1,STRUCTURE_POWER_SPAWN,1,STRUCTURE_NUKER,6,STRUCTURE_TOWER]);
		this.seed = 4;										// If we use a pRNG we want a seed.
		this.iteration = 0;									// Iteration might be important if we use a PRNG
		this.incomplete = true;								// State of planner, not path result.
		
		this.roomCallback = () => this.cm;					// PathFinder stuff
		this.maxRooms = 1;
		// this.heuristicWeight = 1.1;
		this.heuristicWeight = 3.0;
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
		room.find(FIND_SOURCES).forEach(s => this.goals.push({pos: s.pos, range: 2}));
		room.find(FIND_MINERALS).forEach(s => this.goals.push({pos: s.pos, range: 2}));
		room.find(FIND_NUKES).forEach(s => this.goals.push({pos: s.pos, range: 2}));
		room.find(FIND_EXIT).forEach(exit => this.goals.push({pos: exit,range: 5}));
		room.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_ROAD}}).forEach(r => this.set(r.pos, STRUCTURE_ROAD, false));
		return this;
	}
	
	
	/**
	 * Given the current state search for a place to put something:
	 * If you want it shuffled, shuffle before.
	 * Search, Validate, Commit
	 */
	search(structureType, tempGoals) {
		if(!structureType)
			return false;		
		var goals = this.cloneGoals();
		if(tempGoals)
			goals = goals.concat(tempGoals);
		var ds = Game.cpu.getUsed();		
		var {path,ops,cost,incomplete} = PathFinder.search(this.origin, goals, this);
		Log.warn(`Found ${path.length}, cost: ${cost}, ops: ${ops}, incomplete: ${incomplete}`, 'Planner');		
		this.cpu += (Game.cpu.getUsed() - ds);
		if(!path || !path.length || incomplete == true || ops === this.maxOps)
			return false;				
		// Log.debug(ex(path), 'Planner');		
		this.saveNewPath(path,structureType);
		return true;
	}			
	
	/** The weird bits? */
	saveNewPath(path,structureType) {
		this.visual.poly(path);
		// var dest = _.last(path);
		var dest = path.pop();
		this.set(dest,structureType);
		var rpos;
		while( rpos = path.pop() ) {
			//if(this.cm.get(rpos.x,rpos.y) == 1) // interferes with seed road
			//	break;
			this.set(rpos,STRUCTURE_ROAD); // (Perhaps optional?)
		}
		// var points = _.map(HORIZONTALS, (d) => dest.addDirection(d));		
		var points = _.map(DIAGONALS, (d) => dest.addDirection(d));		
		while( rpos = points.pop() ) {	
			if((rpos.x+rpos.y)%2) // (Optional) pRNG chance.
				continue;
			//if(Math.random() < 0.1)
			//	continue;
			this.set(rpos,STRUCTURE_ROAD);
		}
		
		return true;
	}
	
	/**
	 * Register an update to the state of the planner.
	 */	 
	set(pos,structureType,plan=true) {
		if(this.cm.get(pos.x,pos.y) === 255 || Game.map.getTerrainAt(pos) === 'wall')
			return;
		if(structureType === STRUCTURE_ROAD)
			this.cm.set(pos.x,pos.y,1);
		else if(OBSTACLE_OBJECT_TYPES.includes(structureType))
			this.cm.set(pos.x,pos.y,255);
		var entry = {pos, structureType, range: STRUCTURE_MIN_RANGE[structureType] || 1};
		this.goals.push(entry);
		if(plan)
			this.plan.push(entry);
	}
	
	/**
	 * 
	 */
	cloneGoals(planStructureType) {
		return _.map(this.goals, ({pos,structureType,range}) => ({
			pos, structureType,
			// range: Math.clamp(this.minRange || 1, Math.max(range,STRUCTURE_MIN_RANGE[planStructureType] || 1), this.maxRange || 15)
			range: Math.max(this.minRange || 1, range || 1, STRUCTURE_MIN_RANGE[planStructureType] || 1)
		}));
	}
	
	iterate() {	
		if(this.iteration===0)
			this.initalize();
		var item = this.stuffToAdd.pop();
		this.iteration++;
		return this.search(item);		
	}
	
	/** Do this first */
	initalize() {
		// Doesn't work. Not sure why.
		if(!this.initRoad)
			return;
		Log.debug('Seeding road', 'Planner');
		this.search(STRUCTURE_ROAD, [
			{pos: this.origin, range: 15}	// seed road
		]);
		// this.stuffToAdd = [];
	}
	
	run() {
		while(this.iterate() !== false) { /* wait */ }
		this.incomplete = false;
		if(this.finish) 
			this.finish();
		console.log(`Used ${this.cpu} cpu`);
		return this;
	}
	
	draw(road=false) {
		let [a,b] = _.partition(this.plan, ({structureType}) => structureType === STRUCTURE_ROAD);
		if(road) {
			_.each(a, (item) => this.visual.structure(item.pos.x, item.pos.y, item.structureType, {opacity: 0.05}));
			this.visual.connectRoads();
		}
		_.each(b, (item) => this.visual.structure(item.pos.x, item.pos.y, item.structureType, {opacity: 0.75}));
	}
	
	toString() {
		return `[FleePlanner]`; // Include state?
	}
}
global.CFleePlanner = FleePlanner;

// @todo: Account for the structures gained at each level,
// or just pre-plan it all and deal with it?
// @todo: Keep the shuffle or drop it? I kind of like the randomness.
class BuildPlanner
{
	static pushRoomUpdates() {
		var rooms = _.filter(Game.rooms, 'my');
		rooms = _.shuffle(rooms);
		_.each(rooms, ({name}) => Command.push(`require('Planner').buildRoom(Game.rooms['${name}'])`));
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
	static buildRoom(room)
	{
		if(BUCKET_LIMITER)
			return ERR_TIRED;		
		let {pos,level} = room.controller;
		if(level < 1) // Let's get the easy stuff out of the way.
			return ERR_RCL_NOT_ENOUGH; // We can't build anything at rcl 0
		if(!room.isBuildQueueEmpty())
			return ERR_BUSY;
		if(!_.isEmpty(room.find(FIND_MY_CONSTRUCTION_SITES)))
			return ERR_BUSY;
		Log.warn('Building room: ' + room.name + ' on tick ' + Game.time, 'Planner');		
		if(!room.memory.origin) {
			room.memory.origin = this.distanceTransformWithController(room);
			Log.warn('Found origin: ' + room.memory.origin);
		}
		var radius = 4; // If controller.
		if(room.memory.origin) {
			pos = _.create(RoomPosition.prototype, room.memory.origin);
			radius = 1;
		}
		var avail = room.getStructuresWeCanBuild();
		var want = [];
		_.each(RANDO_STRUCTURES, (type) => {
			want.push(avail[type])
			want.push(type);
		});		
		want = Util.RLD(want);
		if(_.isEmpty(want)) {
			Log.debug('Nothing to build', 'Planner');
			// return;
		} else {		
			let plan = this.uberPlan(pos, want, {
				drawRoad:true,plainCost:2,swampCost:3,heuristicWeight:0.9,
				radius: radius
			});
			// @todo move to build planner
			// _.each(plan, ({pos,structureType}) => pos.createConstructionSite(structureType));
			_.each(plan, ({pos,structureType}) => Game.rooms[pos.roomName].addToBuildQueue(pos,structureType,DEFAULT_BUILD_JOB_EXPIRE,STRUCTURE_BUILD_PRIORITY[structureType] || 0.5));
		}
		// Then build other stuff
		this.placeRamparts(room);
		this.placeRampartsOnWalls(room);		
		this.buildSourceRoads(room, room.storage || room.controller, room.controller.level == 3);
		this.findRoadMisplacements(room).invoke('destroy').commit();
		// if(level >= 3)
		//	this.exitPlanner(room.name, {commit: true});
		if(level >= 6) {
			let mineral = room.mineral;
			if(mineral && !mineral.pos.hasStructure(STRUCTURE_EXTRACTOR)) {
				room.addToBuildQueue(mineral.pos, STRUCTURE_EXTRACTOR);				
			}
			if(room.terminal)
				this.planRoad(room.terminal.pos, {pos: mineral.pos, range: 1}, {rest:true,initial:true,container:true});
		}
		// return plan;
		return;
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
	static uberPlan(origin,stuffToAdd,opts={}) {		
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
		var goals = [{pos: origin, range: opts.radius || 2}];
		var room = Game.rooms[origin.roomName];
		room.find(FIND_SOURCES).forEach(s => goals.push({pos: s.pos, range: 2}));
		room.find(FIND_MINERALS).forEach(s => goals.push({pos: s.pos, range: 2}));
		room.find(FIND_NUKES).forEach(s => goals.push({pos: s.pos, range: 2}));
		// var goals = [{pos: room.controller.pos, range: 2}];		
				
		// testing
		if(!stuffToAdd) {
			// stuffToAdd = Util.RLD([10,STRUCTURE_EXTENSION,1,STRUCTURE_SPAWN]);
			// stuffToAdd = Util.RLD([20,STRUCTURE_EXTENSION,3,STRUCTURE_SPAWN]);
			// stuffToAdd = Util.RLD([1,'terminal',3,STRUCTURE_SPAWN,6,'tower',1,STRUCTURE_OBSERVER,1,STRUCTURE_STORAGE,1,'powerSpawn',1,'nuker',60,STRUCTURE_EXTENSION]);
			// stuffToAdd = Util.RLD([1,'terminal',60,STRUCTURE_EXTENSION,3,STRUCTURE_SPAWN,6,'tower',1,STRUCTURE_OBSERVER,1,STRUCTURE_STORAGE,1,'powerSpawn',1,'nuker']);
			stuffToAdd = Util.RLD([1,'terminal',60,STRUCTURE_EXTENSION,6,'tower',3,STRUCTURE_SPAWN,1,STRUCTURE_OBSERVER,1,STRUCTURE_STORAGE,1,'powerSpawn',1,'nuker']);
			// stuffToAdd = Util.RLD([1,'spawn',5,'extension',]);
		}	
		if(opts.shuffle)
			stuffToAdd = _.shuffle(stuffToAdd);
		
		if(_.isEmpty(stuffToAdd)) {
			Log.debug('Nothing to plan!', 'Planner');
			return;
		}
		// ES6 PathFinder extension class?
		
		// Set up cost matrix and existing goals.
		var cm;
		if(opts.costMatrix !== undefined)
			cm = opts.costMatrix.clone();
		else {
			cm = new CostMatrix.CostMatrix;			
		}
		// Register existing structures
		// (Optional)
		// It's best if we have visibility and avoid exits directly, rather just a box. Or use describeExits and block walls.
		if(room) {
			used = Time.measure( () => _.each(room.find(FIND_EXIT), (exit) => goals.push({pos:exit,range:5})) );
			Log.debug('Blocked off exits in ' + used + ' cpu', 'Planner');
			if(!opts.ignoreCurrentPlan) {
				used = Time.measure( () => this.mergeCurrentPlan(room, goals, cm, opts) );
				Log.debug(`Merged current state in ${used} cpu`, 'Planner');
			}
		} else {
			used = Time.measure( () => cm.setBorderUnwalkable(2));
			Log.debug('Blocked off border tiles in ' + used + ' cpu', 'Planner');			
		}
		// var draw = (path) => 
		var cursor = origin; // room.controller.pos;
		// while _stuff to add_.
		var newStuff = [];
			
		var item,status;
		while(item = stuffToAdd.shift()) {
			status = this.plan(cursor,goals,newStuff,cm,item,opts);
			// used = Time.measure( () =>  );		
			// Log.warn(`Used ${used} cpu`);
		}
		// cm.draw(room.name);			
		var end = Game.cpu.getUsed() - start;
		Log.debug('Planner total time: ' + end, 'Planner');
		// @todo: Draw roads first.
		if(opts.draw) {
			var visual = new RoomVisual(origin.roomName);
			let [a,b] = _.partition(newStuff, ({structureType}) => structureType === STRUCTURE_ROAD);
			if(opts.drawRoad === true) {
				_.each(a, (item) => visual.structure(item.pos.x, item.pos.y, item.structureType, {opacity: 0.05}));
				visual.connectRoads();
			}
			_.each(b, (item) => visual.structure(item.pos.x, item.pos.y, item.structureType, {opacity: 0.75}));
		}
		// console.log(ex(newStuff));
		// ..set cursor?
		// visualize?
		return newStuff;
	}	
	
	static mergeCurrentPlan(room, goals, cm, opts) {
		_.each(room.find(FIND_STRUCTURES), ({pos,structureType}) => {
			if(!opts.ignoreRoad && structureType == STRUCTURE_ROAD) {				
				cm.set(pos.x,pos.y,1);
				goals.push({pos,range:1,structureType});
			} else if(!opts.ignoreStructures && OBSTACLE_OBJECT_TYPES.includes(structureType)) {
				cm.set(pos.x,pos.y,255);
				goals.push({
					pos,
					range:(STRUCTURE_MIN_RANGE[structureType] || 1),
					structureType
				});
			}			
		});
	}
	
	static multiTickPlan(reset=false) {
		let {origin,goals,newStuff, mData} = Memory.plan || {};
		if(!origin || reset)
			origin = new RoomPosition(43,42,'W6N3');
		Memory.plan = {origin,goals,newStuff,cmData};
	}
	
	
	/**
	 * This is where we actually update the plan.
	 */
	static plan(origin, goals, newStuff, cm, planStructureType, opts) {
		var {
			plainCost=2,
			swampCost=3,
			heuristicWeight=0.9
		} = opts || {};
		var room = Game.rooms[origin.roomName];
		var mgoals;
		/* if(opts.minRange)
			mgoals = _.map(goals, ({pos,structureType,range}) => ({pos,structureType,range: Math.max(Math.max(range,opts.minRange),STRUCTURE_MIN_RANGE[planStructureType] || 1)}));		
		else
			mgoals = _.map(goals, ({pos,structureType,range}) => ({pos,structureType,range: Math.max(range,STRUCTURE_MIN_RANGE[planStructureType] || 1)}));		 */
		
		mgoals = _.map(goals, ({pos,structureType,range}) => ({
			pos,
			structureType,
			range: Math.clamp(opts.minRange || 1, Math.max(range,STRUCTURE_MIN_RANGE[planStructureType] || 1), opts.maxRange || 15)
		}));
		
		// console.log(ex(mgoals));
		var {path,ops,cost,incomplete} = PathFinder.search(origin, mgoals, {
			flee: true,
			roomCallback: () => cm,
			maxRooms: 1,
			maxCost: CREEP_LIFE_TIME, // Perhaps lower?			
			plainCost,swampCost,
			maxOps: 2500, // Perhaps higher given the work we do.
			heuristicWeight
		});
		if(!path || incomplete == true) {
			Log.warn(`Found ${dest}, cost: ${cost}, ops: ${ops}, incomplete: ${incomplete}`, 'Planner');
			Log.warn('Unable to find path!', 'Planner');			
			return false;
		}	
		if(opts.draw)
			new RoomVisual().poly(path);
		var dest = _.last(path);				
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
		while( rpos = path.pop() ) {
			if(cm.get(rpos.x,rpos.y) == 1) { // Why isn't this working?
				// origin = rpos;
				break;
			}
			cm.set(rpos.x,rpos.y,1);
			entry = {pos: rpos, range: 1, structureType: STRUCTURE_ROAD};
			goals.push(entry);
			newStuff.push(entry);						
		}
		
		// place road on horizontals.
		// This is still neccesary (As flee goals)
		var points = _.map(HORIZONTALS, (d) => dest.addDirection(d));		
		while( rpos = points.pop() ) {			
			if(cm.get(rpos.x,rpos.y) == 1 || (room && !rpos.isOpen()))
				continue;
			if((rpos.x+rpos.y)%2)
				continue;
			cm.set(rpos.x,rpos.y,1);
			entry = {pos: rpos, range: 1, structureType: STRUCTURE_ROAD};
			goals.push(entry);
			newStuff.push(entry);
		}
		// origin = dest;
	}
	
	/**
	 * Very high cpu: 5-10 per call.
	 *
	 * https://aigamedev.com/open/tutorials/clearance-based-pathfinding/
	 */
	static getClearanceMap(roomName,validator) {		
		// Trying not to re-invent the wheel here.
		// var cm = new PathFinder.CostMatrix;		
		/* */
		if(!validator) {
			var room = Game.rooms[roomName];
			var fom = new CostMatrix.FixedObstacleMatrix(roomName);		
			/* var terrain = room.lookForAtArea(LOOK_TERRAIN,0,0,49,49,true);
			_.each(terrain, ({terrain,x,y}) => {
				if(terrain == 'wall')
					fom.set(x,y,255);
			}); */ 
			// validator = (dp) => fom.get(dp.x,dp.y) !== 255;
			validator = (dp) => Game.map.getTerrainAt(dp) !== 'wall' && fom.get(dp.x,dp.y) !== 255;
		}
		var cm = new CostMatrix.CostMatrix(roomName);
		var x,y,c;			
		for(var x=1; x<49; x++)
		for(var y=1; y<49; y++) {
			c = this.getC2(new RoomPosition(x,y,roomName), validator);
			// if(c>1)
			// console.log('set clear: ' + c);
			cm.set(x,y,c);
		}
		return cm;
	}
	
	static getClearance(om,pos,terrain=true) {		
		var {x,y,roomName} = pos;
		var dx,dy,e,limit=49 - Math.max(x,y);
		// var visual = new RoomVisual(roomName);
		// visual.circle(new RoomPosition(x,y,roomName), {fill: 'red'});
		if(om.get(x,y) === 255 || (terrain && Game.map.getTerrainAt(x,y,roomName) === 'wall'))
			return 0;
		for(e=0; e<limit; e++) {
			// console.log('Checking expansion: ' + e);
			// visual.circle(new RoomPosition(x+e,y+e,roomName), {fill: 'blue'})
			for(dx=x+e; dx>=x; dx--) {
				// visual.circle(new RoomPosition(dx,y+e,roomName), {fill: 'green'})
				if(om.get(dx,y+e) === 255 || (terrain && Game.map.getTerrainAt(dx,y+e,roomName) === 'wall'))
					return e;
			}
			for(dy=y+e; dy>=y; dy--) {
				// visual.circle(new RoomPosition(x+e,dy,roomName), {fill: 'green'})
				if(om.get(x+e,dy) === 255 || (terrain && Game.map.getTerrainAt(x+e,dy,roomName) === 'wall'))
					return e;					
			}
		}
		return e;
	}
	
	/**
	 * unfleshdone: You can save min bound for each point you hit, and when you need to calc the point itself, you can jump that value down-right
	 */
	static getC2(pos, validator=(pos)=>Game.map.getTerrainAt(pos) !== 'wall') {
		var {x,y,roomName} = pos;
		var dx,dy,e,limit=49 - Math.max(x,y);
		if(!validator(pos))
			return 0;
		for(e=0; e<limit; e++) {
			for(dx=x+e; dx>=x; dx--)
				if(!validator(new RoomPosition(dx,y+e,roomName)))
					return e;			
			for(dy=y+e; dy>=y; dy--)
				if(!validator(new RoomPosition(x+e,dy,roomName)))
				// if(!validator(x+e,dy,roomName))
					return e;
		}
		return e;
	}
	
	static getC3(pos, e=0, validator=(pos)=>Game.map.getTerrainAt(pos) !== 'wall') {
		var {x,y,roomName} = pos;
		var dx,dy,e,limit=49 - Math.max(x,y);
		if(!validator(pos))
			return 0;
		var visual = new RoomVisual(pos.roomName);
		for( ; e<limit; e++) {
			for(dx=x+e; dx>=x; dx--) {
				visual.text(e,new RoomPosition(dx,y+e,roomName));
				if(!validator(new RoomPosition(dx,y+e,roomName)))
					return e;			
			}
			for(dy=y+e; dy>=y; dy--) {
				visual.text(e,new RoomPosition(x+e,dy,roomName));
				if(!validator(new RoomPosition(x+e,dy,roomName)))
					return e;
			}
		}
		return e;
	}
	
	static CTest(pos) {
		if(!pos)
			pos = new RoomPosition(44,17,'W7N4');	
		var start = Game.cpu.getUsed();
		var m = new CostMatrix.FixedObstacleMatrix('W7N4');
		console.log('Matrix gen used: ' + (Game.cpu.getUsed() - start));	
		Time.benchmark([
			() => this.getClearance(m, pos),
			() => this.getC2(pos),
			() => this.getC2(pos, (dp) => Game.map.getTerrainAt(dp) !== 'wall' && m.get(dp.x,dp.y) !== 255 )
		], 15)
		
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
	static distanceTransform(roomName, rejector=(x,y,roomName)=>Game.map.getTerrainAt(x, y, roomName) == 'wall') {
		var vis = new RoomVisual(roomName);
		var topDownPass = new PathFinder.CostMatrix();
		var x,y;
		
		for(y = 0; y < 50; ++y) {
			for(x = 0; x < 50; ++x) {
				// if (Game.map.getTerrainAt(x, y, roomName) == 'wall') {
				if(rejector(x,y,roomName)) {
					topDownPass.set(x, y, 0);
				}
				else {
					topDownPass.set(x, y,
						Math.min(topDownPass.get(x-1, y-1), topDownPass.get(x, y-1),
							topDownPass.get(x+1, y-1), topDownPass.get(x-1, y)) + 1);
				}
			}
		}

		var value;
		for(y = 49; y >= 0; --y) {
			for(x = 49; x >= 0; --x) {
				value = Math.min(topDownPass.get(x, y),
						topDownPass.get(x+1, y+1) + 1, topDownPass.get(x, y+1) + 1,
						topDownPass.get(x-1, y+1) + 1, topDownPass.get(x+1, y) + 1);
				topDownPass.set(x, y, value);
				// vis.circle(x, y, {radius:value/25});
				if(value > 0)
					vis.text(value, x,y);
			}
		}
		
		return topDownPass;
	}
	
	static drawAvgRange(room) {
		var roomName = room.name;
		var vis = room.visual;
		var x,y,value,pos,dist;
		var c = room.controller;
		var s = room.find(FIND_SOURCES);
		var points = [c,...s];
		console.log('points: ' + points);
		var maxv = 0, maxp = null;
		for(y = 49; y >= 0; --y) {
		for(x = 49; x >= 0; --x) {
			pos = new RoomPosition(x,y,roomName);
			// dist = pos.getRangeTo(c);
			dist = Math.ceil(pos.getAverageRange(points));
			// console.log('dist: ' + dist);
			// value = cm.get(x,y) / (dist / 25);
			if(dist < 3)
				continue;			
			vis.circle(x, y, {fill: 'red', radius:dist / 75});
		}}
	}
	
	/**
	 * Finds a position in a room to expand outwards from.
	 * 
	 * @param {Room} room - Room object to analyze
	 * @param {Number} maxClearance - Score above which extra clearance doesn't really matter
	 */
	static distanceTransformWithController(room, maxClearance=5) {
		var roomName = room.name;
		var cm = this.distanceTransform(roomName);
		var vis = new RoomVisual(roomName);
		var x,y,value,pos,dist,clear;
		var c = room.controller;
		var s = room.find(FIND_SOURCES);
		var points = [c,...s];
		var maxc = 0, maxv = 0, maxp = null;
		for(y = 49; y >= 0; --y) {
		for(x = 49; x >= 0; --x) {
			pos = new RoomPosition(x,y,roomName);
			// dist = pos.getRangeTo(c);
			dist = Math.ceil(pos.getAverageRange(points));
			// value = cm.get(x,y) / (dist / 25);
			if(dist < 3)
				continue;
			// value = Math.pow(cm.get(x,y),2);
			clear = Math.min(cm.get(x,y),maxClearance);
			value = Math.pow(clear,2);
			value /= dist;
			if(value > maxv) {
				maxv = value;
				maxp = pos;
				maxc = clear;
			}
			vis.circle(x, y, {radius:value / 25});
		}}
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
                    matrix[x][y] = Game.map.getTerrainAt(x,y,roomName) === 'wall' ? 0 : 1;
                } else {
                    // Not a room edge or bottom/right edge
                    if (Game.map.getTerrainAt(x,y,roomName) === 'wall') {
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
	 *
	 */
	static buildSourceRoads(room, origin, containers=true) {
		// let spawn = _.first(room.find(FIND_MY_SPAWNS));
		// if(!spawn)
		//	return ERR_NOT_FOUND;
		if(origin === undefined)
			origin = room.controller;
		if(!origin)
			return ERR_NOT_FOUND;
		let sources = room.find(FIND_SOURCES);		
		_.each(sources, source => this.planRoad(origin, {pos: source.pos, range: 1}, {rest:false,initial:true,container:containers}));
		if(room.controller && room.controller.level >= 6 && sources.length > 1) {
			var [s1,s2] = sources;
			this.planRoad(s1, {pos: s2.pos, range: 1}, {rest:true,initial:true});
		}
	}
	
	/**
	 * Game.rooms['W6N3'].visual.poly(PathFinder.search(new RoomPosition(44,41,'W6N3'), new RoomPosition(7,42,'W6N3'), {heuristicWeight: 1.2, plainCost: 2, swampCost: 2}).path)
	 */
	static planRoad(fromPos, toPos, opts={}) {
		// Planner.planRoad(Game.getObjectById('0cca984923d4f5a78ed40185').pos, Game.spawns.Spawn1.pos)
		if(fromPos.pos)
			fromPos = fromPos.pos;
		// if(toPos.pos)
		//	toPos = toPos.pos;
		if(opts.cmFn===undefined)
			// cmFn = (room) => logisticsMatrix[room]; // Stuck creeps can cause a re-path
			opts.cmFn = function(roomName) {
				// return (new CostMatrix.FixedObstacleMatrix(roomName)).setRoad();
				var cm = new PathFinder.CostMatrix;
				Game.rooms[roomName]
				.find(FIND_STRUCTURES)
				.forEach(function(s) {
					if(s.structureType === STRUCTURE_ROAD)
						cm.set(s.pos.x, s.pos.y, 1);
					else if(OBSTACLE_OBJECT_TYPES.includes(s.structureType))
						cm.set(s.pos.x, s.pos.y, 255);
				})
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
			let result = PathFinder.search(fromPos, toPos, {
					plainCost: 2, // prefer existing roads
					swampCost: 2,
					maxOps: 8000,
					maxRooms: 1,
					roomCallback: opts.cmFn
			});			
			let {path,incomplete,cost,ops} = result;
			if(incomplete || !path || _.isEmpty(path)) {
				Log.warn('No path to goal ' + JSON.stringify(toPos), 'Planner#planRoad');
				Log.warn(`cost ${cost} ops ${ops} steps ${path.length}`);
				Log.warn(JSON.stringify(fromPos) + ', ' + JSON.stringify(toPos));
				Log.warn(JSON.stringify(result));
				Log.warn(opts.cmFn);
				return ERR_NO_PATH;
			}
			if(opts.rest)
				path.shift();
			if(opts.container) {
				var end = _.last(path);
				if(!end.hasStructure(STRUCTURE_CONTAINER))
					Game.rooms[end.roomName].addToBuildQueue(end, STRUCTURE_CONTAINER)
			}
			if(opts.initial)
				path.pop();
			new RoomVisual(path[0].roomName).poly(path);
			Log.debug(`Road found, cost ${cost} ops ${ops} incomplete ${incomplete}`, 'Planner');
			if(!opts.dry) {
				_.each(path, p => {
					if(!p.hasStructure(STRUCTURE_ROAD))
						Game.rooms[p.roomName].addToBuildQueue(p, STRUCTURE_ROAD)
				});
			}
		} catch(e) {
			console.log(e);
			console.log(e.stack);
			console.log(ex(fromPos));
			console.log(ex(toPos));
		}		
		// _.each(path, p => p.createConstructionSite(STRUCTURE_ROAD));
	}
		
	// Called by controller periodically.
	// End goal: Place everything that's missing.
	static grow(r) {
		if(!r.my || !r.isBuildQueueEmpty())
			return;
		var start = Game.cpu.getUsed();				
		this.placeRamparts(r);
		this.placeRampartsOnWalls(r);
		var pos = r.controller.pos;
		_.each(RANDO_STRUCTURES, s => Planner.growStructure(pos,s));
		this.findRoadMisplacements(r).invoke('destroy').commit();
		var used = Game.cpu.getUsed() - start;
		console.log('Massively inefficient planner uses: ' + used);
	}
			
	/**
	 * Grows extensions outwards from a point.
	 *
	 * Has the odd behavior of seeking towards the point if it starts elsewhere.
	 * Currently doesn't take the starting position?
	 */
	static growExtensions(pos) {
		var room = Game.rooms[pos.roomName];
		if(!room)
			return ERR_INVALID_TARGET;
		var avail = MAX_CONSTRUCTION_SITES - _.size(Game.constructionSites);
		if(avail <= 0)
			return ERR_FULL;		
		let ce = room.find(FIND_MY_CONSTRUCTION_SITES, {filter: s => s.structureType === STRUCTURE_EXTENSION});
		let e = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTENSION});
		
		if(ce.length+e.length >= CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level])
			return ERR_RCL_NOT_ENOUGH;
		let all = e.concat(ce);
		all = _.sortBy(all, x => x.pos.getRangeTo(pos));
		let spot = _.find(all, s => s.pos.getOpenNeighborDiagonal());
		let n = spot.pos.getOpenNeighborDiagonal();
		n.createConstructionSite(STRUCTURE_EXTENSION);	
		// Place roads
		var {x,y,roomName} = n;
		var points = _.map(HORIZONTALS, (d) => n.addDirection(d));
		_.each(points, p => p.createConstructionSite(STRUCTURE_ROAD));
	}
	
	/**
	 * Add a structure via rando placement.
	 *
	 * Unlike the build planner, this isn't a one-time job, we call this periodically to
	 * find a home for things we're missing. As you can imagine, this is expensive.
	 *
	 * ex: Planner.growStructure(Game.flags['Flag2'].pos, STRUCTURE_TOWER)
	 */
	static growStructure(pos, structureType) {
		var room = Game.rooms[pos.roomName];
		if(!room)
			return ERR_INVALID_TARGET;
		var avail = MAX_CONSTRUCTION_SITES - _.size(Game.constructionSites);
		if(!room.canBuild(structureType))
			return ERR_FULL;		
		let ce = room.find(FIND_MY_CONSTRUCTION_SITES);
		let e = room.find(FIND_MY_STRUCTURES);
		let all = e.concat(ce);
		all = _.sortBy(all, x => x.pos.getRangeTo(pos));
		let spot = _.find(all, s => s.pos.getOpenNeighborDiagonal());
		let n = spot.pos.getOpenNeighborDiagonal();
		
		if(room.addToBuildQueue(n, structureType) !== OK)
			return;
		var {x,y,roomName} = n;
		var points = _.map(HORIZONTALS, (d) => n.addDirection(d));
		_.each(points, p => room.addToBuildQueue(p, STRUCTURE_ROAD)); 
		
		/* n.createConstructionSite(structureType);
		// Place roads
		var {x,y,roomName} = n;
		var points = _.map(HORIZONTALS, (d) => n.addDirection(d));
		_.each(points, p => p.createConstructionSite(STRUCTURE_ROAD)); */
	}	
	
	static saveCurrentWorldPlan() {
		var structs = _.filter(Game.structures, s => s.structureType !== STRUCTURE_CONTROLLER && s.structureType !== STRUCTURE_RAMPART);
		var plan = _.map(structs, ({pos,structureType}) => ({pos, structureType}));
		let size = Util.withMemorySegment(SEGMENT_BUILD, function(obj) {
			obj.plan = plan;
		});		
		console.log('New segment size: ' + size);
	}
	
	static buildPlan() {
		// Build array of structures to place, flood fill with structures
		// and save.
		
		// Or.. terminal center,
		// flood outwards: spawns, then towers, then powerspawn etc etc with extensions last?
		// Links and ramparts get special treatment
		
		/* var start = Game.cpu.getUsed();
		var avail = MAX_CONSTRUCTION_SITES - _.size(Game.constructionSites);
		if(avail <= 0) {
			Log.warn('Site limit reached', 'Planner');
		}
		var str = RawMemory.segments[SEGMENT_BUILD];
		if(str === undefined || str === "") {
			Log.warn('No plan saved', 'Planner');
			return;
		}		
		var {plan} = JSON.parse(str);
		var pos,status;
		_.each(plan, function({pos,structureType}) {
			pos = _.create(RoomPosition.prototype, pos);
			if(pos.hasStructure(structureType))
				return;			
			status = pos.createConstructionSite(structureType);
			if(status === OK) {
				avail--;
				Log.warn(`Placing ${structureType} at ${pos}`, 'Planner');
			} else {
				Log.warn(`Unable to place ${structureType} at ${pos}, status ${status}`, 'Planner');
			}
		});
		var used = Game.cpu.getUsed() - start;
		console.log(`Planner used ${used} cpu`); */
	}	
	
	static buildRoads() {
		
	}
	
	/**
	 * Automate road placements
	 */
	static placeRoads(room) {
		
	}	

	static placeRoadsAdjacent(roomObj) {
		if(!roomObj.room)
			return;
		
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
		stop = ()=>false,		// stop condition
		limit=150,
		oddeven=false,
		visualize=true,
	} = {}) {
		var start = Game.cpu.getUsed();
		var s = new CostMatrix.CostMatrix;		
		var q = [pos];
		var rtn = [];
		var room = Game.rooms[pos.roomName];
		var count=0;
		var visual = (room)?room.visual:(new RoomVisual(pos.roomName));
		while(q.length) {
			var point = q.shift();
			if(count++ > limit)
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
			_.each(adj, function(n) {
				if(s.get(n.x,n.y))
					return;
				s.set(n.x,n.y,1);
				if(!validator(n)) {
					if(visualize)
						visual.circle(n, {fill: 'red',opacity:1.0});
				} else {						
					var color = Util.getColorBasedOnPercentage(100*(count / limit));
					// var color = HSV_COLORS[Math.floor(100*(count / limit))];
					if( oddeven && (n.x+n.y) % 2 == 0 )
						color = 'blue';
					if(visualize)
						visual.circle(n, {fill: color,opacity:1.0});
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
	 * Generation 1 very, very rough extension placer.
	 */
	static placeExtensions(startPos, limit=250) {
		var room = Game.rooms[startPos.roomName];
		var visual = (room)?room.visual:(new RoomVisual(startPos.roomName));
		var ext = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType === STRUCTURE_EXTENSION});
		var cext = _.size(ext);
		var aext = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level];
		
		if(aext <= cext) {
			Log.warn('All extensions built');
			return;
		}
			
		var points = this.floodFill(startPos,{
			limit: limit,
			oddeven: true,
			visualize: true,
			validator: (pos) => Game.map.getTerrainAt(pos) !== 'wall' && !pos.hasObstacle()
		});		
		
		// _.remove(points, p => p.inRangeTo(startPos,1) || p.hasObstacle());
		_.remove(points, p => p.inRangeTo(startPos,1));
		
		console.log("Available extensions: " + aext);
		console.log("Current extensions: " + cext);
		console.log('Take: ' + ((aext-cext)*2));
		// points = _.take(points, (aext-cext)*2);
		var need = (aext-cext);
		
		console.log('Planner points: ' + points);		
		_.each(points, function(p) {
			if(need <= 0)
				return;
			var tog = (p.x+p.y)%2;
			if(tog) {
				if(p.hasStructure(STRUCTURE_EXTENSION))
					return;
				visual.circle(p, {fill: 'yellow'});				
				if(p.createConstructionSite(STRUCTURE_EXTENSION) == OK)
					need--;
			} else {
				visual.circle(p, {fill: 'grey'});
				p.createConstructionSite(STRUCTURE_ROAD);
			}
		});
	}
	
	/**
	 * Automates placing ramparts on important structures
	 *
	 * @todo: Move this to RCL 2 for early-ramparting. Requires faster/build-repair
	 * 
	 * Note: The look call saves us cpu.
	 */
	static placeRamparts(room)
	{
		// Maybe lower this to 2.
		if(_.get(room, 'controller.level', 0) < 3) // ignore until we get a tower up
			return ERR_RCL_NOT_ENOUGH;
		var protect = [STRUCTURE_STORAGE, STRUCTURE_SPAWN, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_TOWER, STRUCTURE_POWER_SPAWN];
		var start = Game.cpu.getUsed();
		var structures = room.find(FIND_MY_STRUCTURES, {filter: s => s.structureType !== STRUCTURE_RAMPART});
		if(!_.any(structures, s => s.structureType == STRUCTURE_TOWER)) {
			console.log(`No towers in ${room.name}, unable to auto-rampart`);
			return ERR_NOT_FOUND;
		}
		_.each(structures, function(s) {		
			if(!protect.includes(s.structureType))
				return;
			var isRamparted = s.pos.hasRampart();
			if(isRamparted)
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
	static placeRampartsOnWalls(room)
	{
		var walls = room.find(FIND_STRUCTURES, {
			filter: s => s.structureType === STRUCTURE_WALL && s.hits === s.hitsMax
		});
		_.each(walls, function(wall) {
			if(CPU_LIMITER || wall.pos.hasRampart() || wall.pos.isEnclosed())
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
	static planExitWalls(room, {visualize=true,commit=true}) {
		var start = Game.cpu.getUsed();
		var exits = room.find(FIND_EXIT); // all exit tiles.
		
		var x,y,p,minExit;
		for(x=1; x<49; x++)
		for(y=1; y<49; y++) {
			if( (x >= 3 && x <= 46) && (y >= 3 && y <= 46) )
				continue;
			if(Game.map.getTerrainAt(x,y,room.name) === 'wall')
				continue;			
			p = room.getPositionAt(x,y);
			if(p.hasObstacle())
				continue;
			minExit = _.min(exits, e => e.getRangeTo(p));
			if(minExit.getRangeTo(p) !== 2)
				continue;
			var color = (x+y) % 2;
			// console.log('exit found: ' + p);
			// Command.push("_.create(RoomPosition.prototype, " +  JSON.stringify(p) +  ").createFlag(null, FLAG_CONSTRUCTION, " + color + ")")
			if(commit) {
				var type = (color)?STRUCTURE_WALL:STRUCTURE_RAMPART;
				if(!p.hasStructure(type))
					p.createConstructionSite( type );
			}
				// Command.push("_.create(RoomPosition.prototype, " +  JSON.stringify(p) +  ").createFlag(null, FLAG_CONSTRUCTION, " + COLOR_WHITE + ")");
			if(visualize) {
				if(color)
					room.visual.circle(p, {fill:'black'});
				else
					room.visual.circle(p, {fill:'green'});
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
	static exitPlanner(roomName, opts={}) {		
		opts = _.defaults(opts, {
			visualize: true,
			commit: false,
			ignorePlan: false
		});
		var cm = new PathFinder.CostMatrix;
		var room = Game.rooms[roomName];
		// var visual = room.visual;		
		var visual = new RoomVisual(roomName);
		if(room) {			
			if(!opts.origin)
				opts.origin = _.create(RoomPosition.prototype, room.memory.origin);
			if(!opts.origin) {
				Log.warn('No origin');
				return;
			}
			var exits = room.find(FIND_EXIT).map(e => ({pos: e, range: 0}));			
			if(!opts.ignorePlan)
				room.find(FIND_STRUCTURES).forEach(({pos,structureType}) => {
					if(structureType === STRUCTURE_RAMPART || OBSTACLE_OBJECT_TYPES.includes(structureType))
						cm.set(pos.x,pos.y,255);
				});			
		} else {
			console.log('No room object');
		}
		while(true) {
			var {path,incomplete} = PathFinder.search(opts.origin, exits, {roomCallback: () => cm, maxRooms: 1});
			if(incomplete)
				break;
			// console.log(JSON.stringify(path));
			var pos = path[path.length-3];
			cm.set(pos.x,pos.y,255);
			// var wallOrRampart = (pos.x + pos.y) % 2;
			var wallOrRampart = (pos.x + pos.y) % 3;
			if(opts.commit){
				var type =  (wallOrRampart?STRUCTURE_WALL:STRUCTURE_RAMPART);
				if(pos.hasStructure(type))
					continue;
				room.addToBuildQueue(pos,type);
			}
			if(opts.visualize) {
				// visual.poly(path);
				visual.circle(pos, {fill:(wallOrRampart?'black':'green'), opacity: 0.75});
				// visual.circle(pos, {fill:'red', opacity: 0.75});
			}				
		}
	}

	/**
	 * Transforms controller structures
	 */
	static structuresAllowable(room) {
		if(_.isString(room))
			room = Game.rooms[room];
		if(!room)
			return "You don't have visibility in this room";
		return _.transform(CONTROLLER_STRUCTURES, (r,v,k) => r[k] = v[room.controller.level]);
	}
	
	/**
	 *
	 */
	static clearFlags(plan=PLAN_MARKER) {
		_(Game.flags)
		.filter({color: FLAG_CONSTRUCTION, secondaryColor: plan})
		.invoke('remove')
		.commit();
	}
}

module.exports = BuildPlanner;

/* module.exports = {
	// Time.measure( () => Planner.placeRamparts() )
	// Time.measure( () => _.groupBy(Game.structures, s => JSON.stringify(s.pos)) )
	placeRamparts: function(commit=false) {
		var protect = [STRUCTURE_STORAGE, STRUCTURE_SPAWN, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_TOWER, STRUCTURE_POWER_SPAWN];
		let start = Game.cpu.getUsed();
		_.each(Game.structures, function(s) {
			if( _.get(s, 'room.controller.level', 0) < 3) // ignore until we get a tower up
				return;
			if(protect.indexOf(s.structureType) == -1)
				return;
			if(s.structureType === STRUCTURE_RAMPART)
				return;
			// if(s.pos.createConstructionSite(STRUCTURE_RAMPART) === OK)
			//	console.log(s + ' at pos ' + s.pos + ' earned a rampart!');
			// This is 5 cpu versus the above's 40 cpu. 
			let isRamparted = s.pos.hasRampart();
			if(!isRamparted)
				console.log(s + ' at pos ' + s.pos + ' has rampart: ' + isRamparted);
			if(!isRamparted && commit===true)
				s.pos.createConstructionSite(STRUCTURE_RAMPART);
		});
		let end = Game.cpu.getUsed();
		let used = end - start;
		console.log('Updating auto-ramparts took: ' + used + ' cpu');
		return used;
	},
	
	testFlags: function(fn, roomName) {
		for(var x=0; x<50; x++)
		for(var y=0; y<50; y++) {
			fn(x,y,new RoomPosition(x,y,roomName), (x+y) % 2);
		}
	},
		
	// Planner.planBox(Game.rooms['E55S48'],23)
	planBox: function(room, radius=20) {
		var rpos = new RoomPosition(25,25, room.name);
		for(var x=0; x<50; x++)
		for(var y=0; y<50; y++) {			
			let p = room.getPositionAt(x,y);
			if(p.getRangeTo(rpos) === radius)
				Command.push("_.create(RoomPosition.prototype, " +  JSON.stringify(p) +  ").createFlag(null, FLAG_CONSTRUCTION, PLAN_MARKER)")
				// room.createFlag(x,y,null,FLAG_CONSTRUCTION,PLAN_MARKER);
		}
	},
		
	,
		
	findRoadMisplacements: function(room) {
		return _(room.find(FIND_STRUCTURES))
			.filter('structureType', STRUCTURE_ROAD)
			.filter(s => s.pos.hasObstacle());
	},
	
	plan: function(type, pos) {
		// create flag
// _.each(PathFinder.search(Game.spawns.Spawn1.pos, Game.spawns.Spawn2).path, p => Game.rooms[p.roomName].createFlag(p.x, p.y,null, COLOR_BLUE,COLOR_GREY))
	//
	// _.each(PathFinder.search(Game.spawns.Spawn1.pos, new RoomPosition(23, 37,'E57S46')).path,
	// p => p.createFlag(null, COLOR_BLUE,COLOR_GREY))
	},
	
	// Planner.planRoad(new RoomPosition(9,14, 'E57S47'), new RoomPosition(19,43, 'E57S47'), rm => (new CostMatrix.TowerThreatMatrix(rm)),true )
	// @todo: road planner cost matrix should take into account current sites and flags
	planRoad: function (fromPos, toPos, cmFn=null, test=false) {		
		// Planner.planRoad(Game.getObjectById('0cca984923d4f5a78ed40185').pos, Game.spawns.Spawn1.pos)
		if(fromPos.pos)
			fromPos = fromPos.pos;
		if(cmFn==null)
			cmFn = (room) => logisticsMatrix[room];
			// cmFn = (room) => new CostMatrix.FixedObstacleMatrix(room);
		// if(toPos.pos)
		//	toPos = toPos.pos;
		// Use transport for this?
		_.each(PathFinder.search(fromPos, toPos, {
				plainCost: 2, // prefer existing roads
				swampCost: 2,
				maxOps: 8000,
				roomCallback: cmFn
		}).path, p => Command.push("_.create(RoomPosition.prototype, " +  JSON.stringify(p) +  ").createFlag(null, FLAG_CONSTRUCTION, PLAN_MARKER)"))
	},
	
	firstRoads: function(spawn) {
		let room = spawn.room;
		let sources = room.find(FIND_SOURCES);
		_.each( sources, source => Planner.planRoad(spawn, source) );
		Planner.planRoad(spawn, room.controller);
		
	},
	
	markExistingExtensions: function() {
		_(Game.rooms)
		.invoke('find', FIND_MY_STRUCTURES, {filter: c => c.structureType === STRUCTURE_EXTENSION})
		.flatten()		
		.each( r => r.pos.createFlag(null, FLAG_CONSTRUCTION, PLAN_EXTENSION) )
		.commit();
	},
	
	getAllFlagsForPlan: function(type) {
		return _(Game.flags).filter({color: FLAG_CONSTRUCTION, secondaryColor: type});
	},
		
	commit: function(plan, confirm=false) {
		if(!plan)
			return "Need to specify plan type to commit!";
		if(confirm!==true)
			return "This function requires comfirmation";
	    return _(Game.flags)
		.filter({color: FLAG_CONSTRUCTION, secondaryColor: PLAN_MARKER})
		.each(function(flag) {
			flag.setColor(FLAG_CONSTRUCTION, plan);
		});
	},
	
	// Planner.act(f => f.pos.createConstructionSite(STRUCTURE_ROAD))
	act: function(fn) {
		 return _(Game.flags)
		.filter({color: FLAG_CONSTRUCTION, secondaryColor: PLAN_MARKER})
		.each(fn);
	},		
		
	clearFlags: function(plan=PLAN_MARKER) {
		_(Game.flags)
		.filter({color: FLAG_CONSTRUCTION, secondaryColor: plan})
		.invoke('remove')
		.commit();
	},
	
	stats: function() {
		return JSON.stringify(_.countBy(Game.constructionSites, 'pos.roomName'), null, 2);
	},
	
	
		
	
};
*/
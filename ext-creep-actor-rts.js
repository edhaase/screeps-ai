/**
 * ext-creep-actor-rts.js
 *
 * RTS-like abilities for creeps
 */
"use strict";

global.MODE_HOLD_GROUND = 0;

global.STANCE_AGRESSIVE = 0;

global.serializePath = function(arr) {
	// Keep first room position		
	var list = "";
	var i = 1;
	for(i=1; i<arr.length; i++) {
		var a = arr[i-1];
		var b = arr[i];			
		var dir = a.getDirectionTo(b);			
		if(a.roomName === b.roomName) // no path on borders
			list += dir;
	}
	return list;
};

/**
 * Find the optimal path for this creep to reach it's goal.
 *
 * If we're going to cache pathfinding, this is probably the place.
 * Expensive or not, must be CPU-efficient before we can release. This includes serialization.
 *
 * @todo: Perhaps let the creep set it's own max ops (some may be more expensive?)
 */
Creep.prototype.getPathTo = function(pos,range=1,opts={}) {
	if(!(pos instanceof RoomPosition))
		throw new TypeError('Expected RoomPosition');
	
	var result;
	try {
		result = PathFinder.search(this.pos, ({pos,range}), {
			plainCost: this.plainSpeed,
			swampCost: this.swampSpeed,
			maxCost: this.ticksToLive,
			roomCallback: r => LOGISTICS_MATRIX[r],
			maxOps: 32000,
			maxRooms: opts.maxRooms || 16,		
			// roomCallback: (roomName) => ((opts.avoid || []).includes(roomName))?false:this.getCostMatrix(roomName)
		});
		
		var {ops, cost, incomplete} = result;
	} catch(e) {
		Log.error(`Unable to find path to ${pos}: ${e}`, 'Creep');
		throw e;
	}
	Log.debug(`New path for ${this.name}: ops ${ops} cost ${cost} incomplete ${incomplete}`, 'Creep');
	return result;
};

/**
 * Pure cache based movement - No serialization
 *
 * @param Object goal - pos and optionally range
 *
 * Game.creeps['noop498'].walkTo({pos: new RoomPosition(16,24,'W7N4'), range: 1})
 */
Creep.prototype.walkTo = function(goal,opts) {
	var {dest,walk} = this.cache;
	if(this.fatigue)
		return ERR_TIRED;
	if(goal.range === undefined)
		goal.range = 1;
	if(this.pos.inRangeTo(goal.pos, goal.range))
		return ERR_NO_PATH;
	if(!_.isMatch(goal,dest) || !walk || _.isEmpty(walk.path)
	|| (this.memory.stuck && this.memory.stuck >= 3)) { // If the current goal doesn't match our goal.
		// console.log('Cache miss');
		walk = this.getPathTo(goal.pos, goal.range, opts);
		if(!walk || _.isEmpty(walk.path)) {
			Log.warn(`No path found for ${this.name} at ${this.pos} for goal ${goal.pos}, range: ${goal.range||1}`);
			this.say(UNICODE_ARROWS.ARROW_BARS);
			return ERR_NO_PATH;
		}
		this.say(UNICODE_ARROWS.THREE_RIGHT);
		// console.log('New path');
		walk.path.unshift(this.pos);
		this.cache.walk = walk;
		this.cache.dest = goal;
		this.memory.stuck = 0;
	}
	const result = this.walkByPath(walk.path);
	if(result === ERR_NO_PATH) {
		// console.log('No path');
		delete this.cache.walk;
		delete this.cache.dest;
		this.say(UNICODE_ARROWS.ARROW_BARS);
	}
	return result;
};

/**
 * Because the built in _.findIndex usage is terrible.
 */
/* Creep.prototype.walkByPath = function(path) {
	if(this.fatigue > 0)
		return ERR_TIRED;
	var i = _.findKey(path, this.pos);
	if(i >= 0 && ++i < path.length)
		return this.move(this.pos.getDirectionTo(path[i]));
	return ERR_NO_PATH;
} */

// || 1 doesn't work correctly if range is supposed to be 0.
// Otherwise? Mostly works.
/* Creep.prototype.moveTo = function(goal, opts={}) {
	if(goal instanceof RoomPosition)
		return this.walkTo( {pos: goal, range: opts.range}, opts );
	else
		return this.walkTo( {pos: goal.pos, range: opts.range}, opts );
} */


// Time.measure( () => serializePath(TEST_PATH.path) )
// 0.354
// global.TEST_PATH = PathFinder.search(new RoomPosition(25,25,'W8N3'), new RoomPosition(14,34,'W8N3'));

Object.assign(Creep.prototype, {
	runRTSactions() {
		this.runPatrol();
		this.runMoveToGoal();	
	},
	
	/**
	 * Auto move - Set a position and range and forget about it.
	 */	
	runMoveToGoal() {
		if(this.fatigue)
			return;
		// var memory = this.memory;	
		var goal = this.getMoveGoal();
		if(!goal)
			return;
		if(!this.pos.inRangeTo(goal.pos, goal.range || 1)) {
			var pos = _.create(RoomPosition.prototype, goal.pos);
			this.moveTo(pos, {range: goal.range || 1});
		}
	},
	
	isInRangeToGoal() {
		var goal = this.getMoveGoal();
		if(!goal)
			return true; // No goal, guess we're in range.
		else
			return this.pos.inRangeTo(goal.pos, goal.range || 1);
	},

	getMoveGoal() {
		return this.memory.goal;
	},

	clearMoveGoal() {
		delete this.memory.goal;
	},
	
	setMoveGoal(goal) {
		if(!goal.pos)
			throw new Error("Expected postion");
		// In the future we'll calculate the path once and keep following it until we arrive.
		// If this gets called again but the goal doesn't change, be sure not to recalc
		
		this.memory.goal = goal;
		return OK;
	},
	
	/**
	 * Creep patrol logic 
	 */
	runPatrol() {
		var {patrol} = this.memory;
		if(!this.isPatrolling())
			return;
		if(!this.isInRangeToGoal())
			return;
		// var name = this.name;
		var goal = _.min(patrol, p => this.pos.getRangeToPlain(p.pos));
		var i = patrol.indexOf(goal);
		/* console.log(`${name} goal: ` + JSON.stringify(goal));
		console.log(`${name} patrol: ` + JSON.stringify(patrol));
		console.log(`${name} indx: ` + JSON.stringify(i)); */
		var newGoal = patrol[ (i+1) % patrol.length ];
		this.setMoveGoal(newGoal);
	},
	
	/*
		Game.creeps['noop553'].setPatrolRoute([
			{pos: new RoomPosition(29,33,'W8N4'), range: 0},
			{pos: new RoomPosition(29,25,'W8N4'), range: 0},
			{pos: new RoomPosition(33,25,'W8N4'), range: 0},
			{pos: new RoomPosition(33,33,'W8N4'), range: 2}
		])
		*/
	setPatrolRoute(goals) {
		if(!Array.isArray(goals) || _.isEmpty(goals))
			throw new Error('Invalid args');
		this.memory.patrol = goals;		
		var {goal} = this.pos.findClosestByPathFinder(goals);
		console.log('New patrol route: Closest: ' + JSON.stringify(goal));
		return this.setMoveGoal(goal);
	},
	
	setPatrolRouteRooms(rooms) {
		if(typeof rooms === 'string')
			throw new Error('Invalid args');
		this.setPatrolRoute(
			_.map(rooms, r => ({pos: new RoomPosition(25,25,r), range: 22})
			));
	},
	
	pausePatrol() {
		this.memory.patrolling = false;
	},
	
	resumePatrol() {
		this.memory.patrolling = true;
	},
	
	isPatrolling() {
		return (this.memory.patrolling || true) && this.memory.patrol && this.memory.patrol.length;
	}
});
/* Creep.prototype.runMoveToGoal = function() {
	if(this.fatigue > 0)
		return;
	var memory = this.memory;	
	var goal = this.getMoveGoal();
	if(!goal)
		return;
	if(this.pos.inRangeTo(goal.pos, goal.range || 1))
		return;
	else {
		var pos = _.create(RoomPosition.prototype, goal.pos);
		this.moveTo(pos, {range: goal.range || 1});
	}
}

Creep.prototype.isInRangeToGoal = function() {
	var goal = this.getMoveGoal();
	if(!goal)
		return true; // No goal, guess we're in range.
	else
		return this.pos.inRangeTo(goal.pos, goal.range || 1);
}

Creep.prototype.getMoveGoal = function() {
	return this.memory.goal;
}

Creep.prototype.clearMoveGoal = function() {
	delete this.memory.goal;
}

Creep.prototype.setMoveGoal = function(goal) {
	if(!goal.pos)
		throw new Error("Expected postion");
	this.memory.goal = goal;
	return OK;
} */
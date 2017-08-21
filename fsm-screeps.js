/**
 * fsm-screeps.js
 * 
 * Collection of reusable FSM classes for screeps
 */
"use strict";

var FSM = require('FSM');


/**
 * Basic roles. Can be used for creeps, structures, rooms, or empire-wide.
 */
class Role extends FSM.StateMachine {
	constructor(states) {
		super(states)
	}

	tick(target) {
		super.tick(target, target.memory);
	}

	force(target, state, params) {
		let store = new FSM.Store(target.memory);
		let tick = new FSM.Tick(this, target, store);
		tick.transition(state, params);
	}
}

class PatrolRole extends Role {
	constructor(posA, posB) {
		super({
			walkA: new WalkState(posA),
			walkB: new WalkState(posB)
		});
	}
}

/**
 * Test of the walk code. Picks random points in a room to move to.
 */
class WanderRole extends Role {
	constructor() {
		super({
			walk: new WalkState(),
			wander: new WanderState()
		});
	}

	getDefaultStateName() {
		return 'wander';
	}
}

/**
 * Combination walk test / Room scanning. 
 */
class ScoutRole extends Role {
	constructor() {
		super({
			walk: new WalkState(),
			scout: new ScoutState()
		});
	}

	tick(target) {
		super.tick(target);
		if (!target.room.controller)
			return;
		if (target.room.controller.owner != undefined
			&& !target.room.controller.my) {
			let owner = target.room.controller.owner.username;
			Log.warn('Room ' + target.room.name + ' owned by ' + owner + '! Marked to avoid');
			this.force(target, 'scout');
			Route.block(target.room.name);
		}
		// do global scout stuff.
		// if we die, mark the room as hostile?
	}

	getDefaultStateName() {
		return 'scout';
	}
}


/**
 * Creates scoped memory, cleans up when leaving state
 */
class ScopedState extends FSM.State {
	// Not good enough!
	enter(tick) {
		tick.store.set(this.name, {});
	}

	exit(tick) {
		tick.store.clear(this.name);
	}
}

/**
 * Wander: Test movement by picking random points in a room to walk to.
 */
class WanderState extends FSM.State {
	constructor() {
		super('wander');
	}

	tick(tick) {
		let { fsm, target, store } = tick;
		let x = randInt(1, 48);
		let y = randInt(1, 48);
		let newPos = target.room.getPositionAt(x, y);
		tick.transition('walk', {
			dest: newPos,
			radius: 0,
			nextState: 'wander'
		});
	}

}

class ScoutState extends FSM.State {
	constructor() { super('scout'); }

	enter(tick) {
		Log.info('Scout holding for 5 ticks');
		tick.target.memory.defer = Game.time + 5;
	}

	tick(tick) {
		let { fsm, target, store } = tick;
		let randomRoomName = _.sample(Game.map.describeExits(target.room.name));
		let goal = new RoomPosition(25, 25, randomRoomName);
		Log.info("Scout heading to pos: " + goal);
		tick.transition('walk', {
			dest: goal,
			radius: 20, // 25 around center so 25 + 25 = 50
			nextState: 'scout'
		});
	}
}

/**
 * Cleaned up walk state
 * params:
 *		dest: pos or {pos,range}
 */
class WalkState extends State {
	constructor() {
		super('walk');
	}

	/** overridable method for cost matrix lookups */
	getCostMatrix(roomName) {
		// Log.info('Requesting cost matrix for: ' + roomName);
		let cm = _.get(global, ['logisticsMatrix', roomName]);
		if (cm) {
			// Log.info('found globally cached matrix!');
			return cm;
		}

		cm = _.get(Memory, 'rooms.' + roomName + '.cm.obstacle')
		if (cm) {
			// Log.info('found memory-cached obstacle matrix');
			return PathFinder.CostMatrix.deserialize(cm);
		}
		return new CostMatrix.ObstacleMatrix(roomName);
	}

	/** called when stuck - return true to cancel rest of action */
	stuck(tick, count) {
		let { fsm, target, store } = tick;
		// Log.warn(target.name + ' is stuck at ' + target.pos + '! (' + count + ')');
		if (count > 5) {
			let { dest, path, i, stuck, lastPos, nextState } = store.get('_walk');
			// Log.warn('Repathing!');
			return tick.transition(this.name, { dest: dest, nextState: nextState });
		}
		return false;
	}

	/** is there a high level plan for this? */
	can(tick, params) {
		if (_.get(params, 'dest') == null)
			throw new Error("WalkState needs destination!");
		if (!_.get(params, 'nextState'))
			throw new Error("WalkState needs next state!");

		let { fsm, target, store } = tick;
		let destName = _.get(params.dest, 'pos.roomName') || _.get(params.dest, 'roomName');
		return (Route.findRoute(target.pos.roomName, destName) === ERR_NO_PATH)
			? false : true;
	}

	/** find path on enter event */
	enter(tick, params) {
		let { fsm, target, store } = tick;
		let { opts = {} } = params;
		let destName = _.get(params.dest, 'pos.roomName') || _.get(params.dest, 'roomName');
		let rooms = Route.findRoute(target.pos.roomName, destName);
		if (!rooms || rooms === ERR_NO_PATH)
			throw new Error("No route plan!");
		// console.log(ex(rooms));
		rooms.push(target.room.name);

		// If we're on top of the top, change early?
		// if(target.pos.isNearTo()

		// pathfinder action
		let lookup = _.callback(rn => this.getCostMatrix(rn), this);
		_.defaults(opts, {
			'roomCallback': rn => _.contains(rooms, rn) ? (lookup(rn)) : false,
			'plainCost': Math.max(1, target.plainSpeed),
			'swampCost': Math.max(1, target.swampSpeed),
			maxOps: 2500 * (rooms.length + 1)
		});

		let search = PathFinder.search(target.pos, params.dest, opts);
		// let search = null;
		// Time.measure( () => search = PathFinder.search(target.pos, params.dest, opts) );
		if (!search || !search.path || search.path.length <= 0) {
			return tick.transition(fsm.getDefaultStateName());
		} else
			search.path.unshift(target.pos);
		// console.log('search: ' + JSON.stringify(search));
		// console.log('path: ' + Route.compact(search.path));

		let metric = Math.round(search.ops / search.path.length, 3);
		if (metric > 10)
			Log.info('path found in: ' + search.ops + ' (avg ' + metric + ')' + ' operations');
		/* if(search.ops == 0) {
			Log.notify('Unusally small path? : ' + target.name + " ==> " + ex(search));
		} */

		if (metric > 100) {
			Log.warn("WARNING: Unusually high operations for pathfinder! (" + metric + ") Unit: " + target.name + ' at ' + target.pos);
			target.memory.defer = Game.time + 3;
		}

		if (target.ticksToLive < (search.path.length * 2) + 1) {
			Log.warn('Creep ' + target.name + ' ticks to live (' + target.ticksToLive + ') is less than round trip path! ' + (search.path.length * 2));
			if (this.onLowTicksToLive)
				this.onLowTicksToLive(tick, params.nextState);
		}

		// build initial state
		store.set('_walk', {
			dest: params.dest,
			ops: search.ops,
			path: Route.compact(search.path),
			i: 0,
			stuck: -1,
			// lastPos: target.pos,
			nextState: params.nextState
		});
	}

	/** move closer on tick */
	tick(tick) {
		let { fsm, target, store } = tick;
		if (target.fatigue > 0)
			return;
		let { dest, path, i, stuck, lastPos, nextState } = store.get('_walk');
		let { pos, range } = dest;

		// Log.info('test: ' + ex(pos || dest) + ", " + (range || 1));
		if ((i >= path.length) || target.pos.inRangeTo(pos || dest, range || 1)) {
			// if( (i >= path.length) ) {
			if (tick.transition(nextState) == false)
				tick.transition(fsm.getDefaultStateName());
			return;
			/* if(target.pos.inRangeTo(pos || dest, range || 1))
				return tick.transition(nextState);
			else
				return tick.transition(this.name, {dest: dest, nextState: nextState}); */
		} else {
			let isStuck = _.matches(target.pos)(lastPos);
			if (isStuck) {
				i--;
				stuck++;
				if (this.stuck(tick, stuck) === true)
					return;
			} else
				stuck = 0;
			let dir = path.charAt(i);
			if (target.move(dir) === OK)
				i++;
		}
		// track if we're actually moving
		store.set('_walk.i', i);
		store.set('_walk.stuck', stuck);
		store.set('_walk.lastPos', target.pos);
	}

	exit(tick) {
		tick.store.clear('_walk');
	}
}

/**
 * Improved creep pathing, with support for parameters.
 *   {RoomPosition} dest		- where are we walking to?
 *	 Number			radius		- how close do we need to be?
 *	 String			nextState	- what to do after we get there?
 *   [String]		avoid		- rooms to avoid
 *	 [String]		prefer		- rooms to prefer
 *	 {CostMatrix}	cm			- cost matrix
 *	 {Function}		rc			- room callback for routing?
 */
class WalkState2 extends State {
	constructor(defaultDest) {
		super('walk');
		this.defaultDest = defaultDest;
	}

	/**
	 * 'can' functions should be stateless.
	 */
	can(tick, params) {
		if ((!params || !params.dest) && !this.defaultDest)
			throw new Error("WalkState needs destination!");

		let srcPos = tick.target.pos;
		let dstPos = _.create(RoomPosition.prototype, params.dest);

		return (Route.findRoute(srcPos.roomName, dstPos.roomName) === ERR_NO_PATH)
			? false
			: true;
		return true;
	}

	enter(tick, params) {
		tick.store.set('_walk', params);
	}

	// E58S46,E59S46,E60S46,E60S45,E60S44,E60S43,E60S42,E59S42
	// E58S46,E59S46,E59S45,E59S44,E59S43,E59S42

	/**
	 * roles['wander'].force(Game.creeps.Allison, 'walk', {dest: {x: 21, y: 31, roomName: 'E59S42'}, nextState: 'wander'})
	 * Route: E58S47,E59S47,E59S46,E59S45,E59S44,E59S43,E59S42
	 */
	path(target, fromPos, toPos, opts = {}) {
		// Log.warn('WARNING: Pathfinder in operation!');		
		/**
		 * If we're not in the same room, find a route!
		 */
		let rooms = [target.room.name];
		if (fromPos.roomName != toPos.pos.roomName) {
			Log.warn("Destination outside room, finding route plan: " + fromPos.roomName + " ==> " + toPos.pos.roomName);
			// rooms =	_.map(Game.map.findRoute(fromPos.roomName, toPos.pos.roomName, this.routeCallbackFactory(toPos.pos.roomName)), 'room')
			rooms = Route.findRoute(fromPos.roomName, toPos.pos.roomName);
			if (rooms === ERR_NO_PATH)
				return null;
			rooms.push(target.room.name);
		}
		Log.info('Route: ' + rooms);

		/**
		 * Now find the path!
		 */
		_.defaults(opts, {
			// 'roomCallback': rn => _.contains(rooms, rn)?(new PathFinder.CostMatrix):false,
			'roomCallback': rn => _.contains(rooms, rn) ? (new CostMatrix.ObstacleMatrix(rn)) : false,
			'plainCost': 2,
			// 'swampCost': target.canSwampTravel()?2:5,
			'swampCost': target.swampSpeed,
			maxOps: 316000
		});

		let search = PathFinder.search(fromPos, toPos, opts);
		if (!search || !search.path || search.path.length <= 0) {
			Log.error("no path!");
			return null;
		}

		// console.log('starting: ' + fromPos);
		// _.each(search.path, r => r.createFlag(null,COLOR_BLUE,COLOR_RED))
		console.log('path: ' + JSON.stringify(search.path));
		// console.log('parts: '+ ex(_.countBy(search.path, 'roomName')));
		search.path.unshift(fromPos);

		return search.path;
	}

	/**
	 * Reduce to array of directions
	 */
	compact(arr) {
		// Keep first room position
		var list = [];
		var i = 1;
		var last = 0;
		for (i = 1; i < arr.length; i++) {
			var a = arr[i - 1];
			var b = arr[i];
			var dir = a.getDirectionTo(b);
			if (a.roomName != b.roomName) {
				var opp = 1 + (dir + 3) % 8;
				Log.warn("Border crossing: pushing " + last + " instead of " + dir + " ..or " + opp + "?");
				list.push(opp);
			} else
				list.push(dir);
			last = dir;
		}
		return list.join("");
	}

	/**
	 * We _could_ use enter state to build and store path, but if we want to limit path length
	 * we'd have to call back into enter function.
	 * this way though, we can just rebuild path if we get lost
	 */
	tick(tick) {
		// require('fsm-screeps').roles.wander.force(Game.creeps.Camden, 'wander')
		// Game.spawns.Spawn1.createCreep([MOVE],null,{role:'wander'})
		// Game.creeps.Blake.cancelOrder('move')
		// console.log('tick: ' + Game.time)
		let { fsm, target, store } = tick;
		if (target.spawning)
			return;

		let params = store.get('_walk');
		let roomPos = _.create(RoomPosition.prototype, params.dest || this.defaultDest);
		let radius = _.get(params, 'radius', 1);
		let path = _.get(params, 'path');
		let indx = _.get(params, 'indx', 0);
		let opts = _.get(params, 'opts', {});
		let lastPos = params['lastPos'];

		if (!path) {
			path = this.path(target, target.pos, { pos: roomPos, range: radius }, params.opts);
			if (!path) {
				tick.transition(params.nextState);
				return;
			}
			path = this.compact(path);
			Log.info('Compact path: ' + path);
			store.set('_walk.path', path);
			store.set('_walk.indx', 0);
		}
		// E56S45 
		// console.log('Range to target: ' + (target.pos.getRangeTo(roomPos) - radius) );	
		if ((indx > path.length) || target.pos.inRangeTo(roomPos, radius))
			return tick.transition(_.get(params, 'nextState', 'idle'));
		else {
			let isStuck = _.matches(target.pos)(lastPos);
			if (isStuck) {
				console.log(target.name + ' is stuck at ' + target.pos + '!');
				indx--;
				let stuck = store.get('_walk.stuck', 0) + 1;
				store.set('_walk.stuck', stuck);
				// console.log('stuck moving: ' + path.charAt(indx));
				if (stuck > 5) {
					Log.warn('Stuck, repathing');
					// store.clear('_walk.path');
					// console.log(ex(store.get('_walk')));
					return tick.transition(this.name, _.omit(params, ['path', 'indx', 'lastPos', 'stuck']));
				}
			}

			let dir = path.charAt(indx);
			if (target.move(dir) === OK)
				indx++;
		}
		// track if we're actually moving
		store.set('_walk.indx', indx);
		store.set('_walk.lastPos', target.pos);
	}

	exit(tick) {
		// _.invoke(Game.flags, 'remove');
		tick.store.clear('_walk');
	}
}

/**
 * dest, radius, opts, nextState
 */
class SimpleWalkState extends State {
	constructor() { super('walk'); }
	enter(tick, params) {
		tick.store.set('_walk', params);
	}

	tick(tick) {
		let params = tick.store.get('_walk');
		let roomPos = _.create(RoomPosition.prototype, params.dest);
		let radius = _.get(params, 'radius', 1);
		if (creep.pos.inRangeTo(roomPos, radius))
			tick.transition(_.get(params, 'nextState', 'idle'));
		else
			creep.moveTo(roomPos, params.opts);
	}

	exit(tick) {
		// wipe path memory.
		tick.store.clear('_walk');
	}
}

module.exports = {
	Role: Role,
	SimpleWalkState: SimpleWalkState,
	WalkState: WalkState,
	WanderState: WanderState,
	roles: {
		patrol: new PatrolRole(),
		wander: new WanderRole(),
		scout: new ScoutRole(),
	}
}

/** let's cheat and put it all on global scope */
_.assign(global, module.exports);


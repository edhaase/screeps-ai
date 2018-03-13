/**
 * extension-roomobject
 *
 * This file is for any features that help multiple types of room objects.
 */
"use strict";

/**
 * Generalized target locking function for actors.
 *
 * The selector function picks all available candidates, but only runs during
 * the target selection phase. This is where your CPU heavy work should go.
 *
 * The validator function is ran for each candidate, and once per call to
 * ensure the target is still valid for use, so you want this function to be as
 * cheap as possible. The parameter is technically optional, with all values
 * being considered valid. But then why are you using this?
 *
 * The chooser function is ran once at the end of target selection, to pick
 * which of the valid candidates you want to use. This parameter is optional,
 * defaulting to the first item in the array if omitted. It expects a single
 * result so opt for a _.min or _.max over a sort.
 *
 * The prop parameter is the key used to store the target's id in memory. This
 * optionally allows us to have multiple target locks with different names. 
 *
 * @param function selector - Gets a list of target candidates
 * @param function validator - Check if a target is still valid
 * @param function chooser - Pick the best target from the list
 * @param string prop - Property name in memory to store the target id
 */
RoomObject.prototype.getTarget = function (selector, validator = _.identity, chooser = _.first, prop = 'tid') {
	var target, tid = this.memory[prop];
	if (tid != null) // Sanity check for cassandra migration
		target = Game.getObjectById(tid);
	if (target == null || !validator(target,this)) {
		this.room.visual.circle(this.pos, { fill: 'red' });
		var candidates = _.filter(selector.call(this, this), x => validator(x,this));
		if (candidates && candidates.length)
			target = chooser(candidates, this);
		else
			target = null;
		if (target)
			this.memory[prop] = target.id;
		else
			this.memory[prop] = undefined;
	}
	//if(target && target.pos.roomName == this.pos.roomName)
	//	target.room.visual.line(this.pos, target.pos, {lineStyle: 'dashed', opacity: 0.5});
	return target;
};

/**
 *
 */
RoomObject.prototype.getTargetDeep = function (selector, validator = _.identity, chooser = _.first, prop = 'memory.tid') {
	var tid = _.get(this, prop);
	var target = Game.getObjectById(tid);
	if (target == null || !validator(target)) {
		this.room.visual.circle(this.pos, { fill: 'red' });
		var candidates = _.filter(selector.call(this, this), validator);
		if (candidates && candidates.length)
			target = chooser(candidates, this);
		else
			target = null;
		if (target)
			_.set(this, prop, target.id);
		else
			_.set(this, prop, null);
	}
	// if(target && target.pos.roomName == this.pos.roomName)
	// 	target.room.visual.line(this.pos, target.pos, {lineStyle: 'dashed', opacity: 0.5});
	return target;
};


/**
 * Similar to getTarget, but ensures no other actor is assigned to this target.
 *
 * @param function selector - Gets a list of target candidates
 * @param function restrictor - Called at start of target selection, expected to return array of invalid targets
 * @param function validator - Check if a target is still valid
 * @param function chooser - Pick the best target from the list
 * @param string prop - Property name in memory to store the target id
 */
RoomObject.prototype.getUniqueTarget = function (selector, restrictor, validator = _.identity, chooser = _.first, prop = 'tid') {
	var tid = this.memory[prop];
	var target = Game.getObjectById(tid);
	if (tid == null || target == null || !validator(target,this)) {
		this.room.visual.circle(this.pos, { fill: 'red' });
		this.clearTarget(prop);
		var invalid = restrictor.call(this, this) || [];
		var candidates = _.filter(selector.call(this, this), x => validator(x,this) && !invalid.includes(x.id));
		if (candidates && candidates.length)
			target = chooser(candidates, this);
		else
			target = null;
		if (target)
			this.memory[prop] = target.id;
	}
	// if(target && target.pos.roomName == this.pos.roomName)
	//	target.room.visual.line(this.pos, target.pos, {lineStyle: 'dashed', opacity: 0.5});	
	return target;
};

/**
 * Function wrapper version - Should optimize better.
 *
 * @param function selector - Gets a list of target candidates
 * @param function restrictor - Called at start of target selection, expected to return array of invalid targets
 * @param function validator - Check if a target is still valid
 * @param function chooser - Pick the best target from the list
 * @param string prop - Property name in memory to store the target id
 *
 * @return function - Return function to call
 */
global.createUniqueTargetSelector = function (selector, restrictor, validator = _.identity, chooser = _.first, prop = 'tid') {
	return function(roomObject) {
		return RoomObject.prototype.getUniqueTarget.call(roomObject, selector, restrictor, validator, chooser, prop);
	};
};

/**
 * Clear target lock for actor
 */
RoomObject.prototype.clearTarget = function (prop = 'tid') {
	this.memory[prop] = undefined;
};

RoomObject.prototype.setTarget = function (target, prop = 'tid') {
	if (!target)
		return null;
	this.room.visual.circle(this.pos, { fill: 'blue' });
	if (typeof target == 'string')
		this.memory[prop] = target;
	else
		this.memory[prop] = target.id;
	return this;
};

/**
 * Unit groups - Assign groups and shared memory space
 */
Object.defineProperty(RoomObject.prototype, 'group', {
	set: function (value) {
		this.memory.gid = value;
	},
	get: function () {
		if (this === RoomObject.prototype)
			return null;
		return this.memory.gid;
	},
	configurable: true,
	enumerable: false
});

Object.defineProperty(RoomObject.prototype, 'gmem', {
	get: function () {
		var id = this.group;
		if (this === RoomObject.prototype || id == null)
			return null;
		if (!Memory.groups)
			Memory.groups = {};
		if (!Memory.groups[id])
			Memory.groups[id] = {};
		return Memory.groups[id];
	},
	configurable: true
});

/**
 * Refresh a stale object. Maybe caching will have merit.
 */
RoomObject.prototype.refresh = function () {
	return _.merge(this, Game.getObjectById(this.id));
};

/**
 * Throttle function with in-memory tracking, so we're not constantly
 * keeping track of Game.time modulus.
 */
RoomObject.prototype.throttle = function (freq, prop, fn) {
	if (!this.memory[prop] || Game.time > this.memory[prop]) {
		fn();
		this.memory[prop] = Game.time + freq;
	}
};

/**
 * Receive message on room object. Extend this message to any
 * entity using the message bus.
 *
 * @param mixed msg - string or object sent
 * @param number tick - the tick the message was sent on
 *
 * @return false to repeat message (up until it expires)
 *
 * ex: StructureTerminal.prototype.receiveMessage = function(msg) {}
 */
RoomObject.prototype.receiveMessage = function (msg, sender, tick = Game.time) {
	var AB = Game.time & 1;
	console.log(`Receiving message ${JSON.stringify(msg)} on channel ${AB} from ${sender} on tick ${tick}`);
};

/**
 * Send a message to an entity to be received on the next tick.
 * The next tick delivery ensures all messages can be processed
 * and states updated before logic begins, as well as preventing
 * infinite loops.
 *
 * @param string id - object id to receive
 * @param mixed data - string or object to send
 */
global.sendMessage = function (id, data = {}, expire = 5, sender = 'global') {
	if (typeof id !== 'string')
		throw new TypeError('Expected id string or flag name');
	var AB = 1 - (Game.time & 1);
	console.log(`Sending message on to ${id} on channel ${AB}`);
	if (!Memory.messages)
		Memory.messages = [];
	if (!Memory.messages[AB])
		Memory.messages[AB] = [];
	return Memory.messages[AB].push({
		id, sender,
		data: JSON.stringify(data),
		tick: Game.time,
		expire: Game.time + expire
	});
};

/**
 * Helper to pass in the sender id
 */
RoomObject.prototype.sendMessage = function (id, data = {}, expire = 5) {
	return sendMessage(id, data, expire, this.id || this.name);
};

/**
 * Process loop for message bus
 * Call once per tick to deliver messages to entities.
 *
 * Messages may deliver at a later time.
 *
 */
global.processMessages = function () {
	var AB = Game.time & 1;
	var obj, status;
	if (!Memory.messages || !Memory.messages[AB] || !Memory.messages[AB].length)
		return;
	_.remove(Memory.messages[AB], function ({ id, sender, data, tick, expire }) {
		if (Game.time > expire)
			return true;
		obj = Game.getObjectById(id) || Game.flags[id];
		if (!obj)
			return false;
		status = obj.receiveMessage(JSON.parse(data), sender, tick);
		return (status == null) ? true : status;
	});
};

/**
 * Very, very simplified state machine for actors with memory.
 *
 * @param mixed start - must be in this state to evaluate
 * @param function condition - criteria for switch
 * @param mixed end - what state to transition to
 * @param function onEnter - (optional) function to run when switching
 *
 * Example:
 *
 *   transition(undefined, () => true, 'gather')
 *   transition('gather', () => this.carryTotal >= this.carryCapacity, 'work')
 *   transition('work', () => this.carryTotal <= 0, 'gather')
 */
RoomObject.prototype.transition = function (start, condition, end, onEnter) {
	var state = this.getState();
	if (state === start && condition.call(this, this)) {
		state = end;
		if (onEnter !== undefined)
			onEnter();
		this.setState(end);
	}
	return state;
};

/**
 *
 *
 */
RoomObject.prototype.transitions = function (obj,def) {
	var state = this.getState();
	if(!obj)
		throw new TypeError('Expected transitions object');
	// Log.warn(`Transitions for ${this.name} state ${state}`,'Creep')
	if(!obj[state] || !obj[state].length) {
		Log.warn(`No transitions for ${this.name} state ${state} [${Object.keys(obj)}]`,'Creep');
		return this.setState(def);
	}
	for (var i = 0; i < obj[state].length; i++) {
		var [condition, end, onEnter=null] = obj[state][i];
		if (condition.call(this, this)) {
			state = end;
			if(onEnter)
				onEnter.call(this,this);
			this.setState(state);
			break;
		}
	}
	return state;
};

/**
 * Pushdown automata state machine
 */
const MAX_STACK_DEPTH = 100;

RoomObject.prototype.invokeState = function() {
	if(!this.memory.stack || !this.memory.stack.length)
		return false;
	var [[state,scope]] = this.memory.stack;
	var method = `run${state}`;
	if(!this[method])
		return false;
	// Log.debug(`Invoking action ${state} (${method}) for ${this}`, 'RoomObject');
	this[method](scope);
	return true;
};

/**
 * @param {string} [defaultState] - Fallback state if none defined.
 */
RoomObject.prototype.getState = function (defaultState = 'I') {
	if(!this.memory.stack)
		return defaultState;
	return this.memory.stack[0][0] || defaultState;
};

/**
 * @param {string} state - Name of state to switch to.
 * @param {*} scope - Any data you want to supply to the state.
 */
RoomObject.prototype.setState = function (state, scope) {
	if (state == null)
		throw new TypeError('State can not be null');
	if (!this.memory.stack)
		this.memory.stack = [[]];
	this.clearTarget();
	this.memory.stack[0] = [state, scope];
	return state;
};

/**
 * @param {string} state - Name of state to push
 * @param {*} scope - Any data you want to supply to the state.
 */
RoomObject.prototype.pushState = function (state, scope={}) {
	if (!this.memory.stack)
		this.memory.stack = [];
	var method = `run${state}`;
	if (this[method] == null)
		throw new Error(`No such state or action ${method}`);
	if (this.memory.stack.length >= MAX_STACK_DEPTH)
		throw new Error('Automata stack limit exceeded');
	Log.debug(`Pushing state ${state} to ${this}`, 'RoomObject');
	this.clearTarget();
	this.memory.stack.unshift([state, scope]);
	return state;
};


RoomObject.prototype.pushStates = function(arr=[]) {
	if(!this.memory.stack)
		this.memory.stack = [];
	if(this.memory.stack.length + arr.length >= MAX_STACK_DEPTH)
		throw new Error('Automata stack limit exceed');
	this.clearTarget();
	_.each(arr, a => this.memory.stack.unshift(a));
};

/** Pop the current state off the stack */
RoomObject.prototype.popState = function () {
	if (!this.memory.stack || !this.memory.stack.length)
		return;
	const [state] = this.memory.stack.shift();
	Log.debug(`Popping state ${state} from ${this}`, 'RoomObject');
	this.clearTarget();
	if (!this.memory.stack.length)
		this.memory.stack = undefined;
};

/** Clear the stack */
RoomObject.prototype.clearState = function() {
	this.clearTarget();
	this.memory.stack = undefined;
};

/**
 * Programmable steps!
 * ex: Game.spawns.Spawn1.submit({body: [MOVE], memory: {role: 'noop',stack:[['Eval',{script:'this.move(TOP)'}]]}, priority: 100})
 */
RoomObject.prototype.runEval = function (scope) {
	var {script,exit} = scope;
	if(exit && eval(exit))
		this.popState();
	else
		eval(script);
};

RoomObject.prototype.runEvalOnce = function (scope) {
	this.popState();
	eval(scope);
};

// Cycle through states
RoomObject.prototype.runCycle = function (scope) {

};

// Repeat another state indefinitely
RoomObject.prototype.runRepeat = function (scope) {
	return this.pushState(scope);
};

// Conditional
RoomObject.prototype.runIIF = function(scope) {

};

RoomObject.prototype.runWait = function(scope) {
	switch (typeof scope) {
	case 'number':
		if (Game.time > scope)
			this.popState();
		break;
	case 'string':
		if(eval(scope))
			this.popState();
		break;
	case 'object':
		break;
	}
};

/**
 * Rampart benefits
 */
defineCachedGetter(RoomObject.prototype, 'hitsEffective', function () {
	if (this.structureType !== STRUCTURE_RAMPART) {
		var rampart = this.pos.getStructure(STRUCTURE_RAMPART);
		if (rampart)
			return this.hits + rampart.hits;
	}
	return this.hits;
});


/**
 * Helper functions for all room objects.
 */
RoomObject.prototype.getAdjacentContainer = function () {
	return _.find(this.room.structures, s => s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(this, 1));
};

/**
 * Find and cache/store the closest spawn for re-use.
 *
 * @param string prop - key name to store spawn name in (cache or memory)
 */
RoomObject.prototype.getClosestSpawn = function (opts = {}, prop = 'memory') {
	if (!this[prop].spawn || !Game.spawns[this[prop].spawn] || Game.spawns[this[prop].spawn].isDefunct() || this[prop].resetSpawn <= Game.time) {
		const spawns = _.reject(Game.spawns, s => s.isDefunct());
		const { goal, cost, path } = this.pos.findClosestByPathFinder(spawns, (spawn) => ({ pos: spawn.pos, range: 1 }), opts);
		if (!goal)
			return null;
		this[prop].spawn = goal.name;
		this[prop].steps = path.length;
		this[prop].cost = cost;				// est ticks to get there
		this[prop].resetSpawn = Game.time + CREEP_LIFE_TIME;
		Log.debug(`Assigning spawn ${this[prop].spawn} at steps ${path.length} and cost ${cost} to ${this}`, 'RoomObject');
	}
	return [Game.spawns[this[prop].spawn], this[prop].cost, this[prop].steps];
};

/**
 * Similar to room position getClosest, but caches the result in memory.
 */
RoomObject.prototype.getClosest = function (selector, validator = _.identity, range = 1, prop = 'ctid') {
	// Not sure we need this.
	// Plus, not clearing targets.
	return this.getTarget(
		selector,
		validator,
		(candidates) => this.pos.findClosestByPathFinder(candidates, ({ pos }) => ({ pos, range })),
		prop
	);
};

/**
 * Look call helpers
 */
RoomObject.prototype.lookNear = function (asArray, range = 1) {
	var { x, y } = this.pos;
	return this.room.lookAtArea(Math.max(0, y - range),
		Math.max(0, x - range),
		Math.min(49, y + range),
		Math.min(49, x + range),
		asArray);
};

RoomObject.prototype.lookForNear = function (lookFor, asArray, range = 1) {
	var { x, y } = this.pos;
	return this.room.lookForAtArea(lookFor,
		Math.max(0, y - range),
		Math.max(0, x - range),
		Math.min(49, y + range),
		Math.min(49, x + range),
		asArray);
};

/**
 * Return look results for open terrain around object.
 */
RoomObject.prototype.getAvailablePositions = function () {
	return _.filter(this.lookForNear(LOOK_TERRAIN, true, 1), x => x.terrain !== 'wall');
};

/**
 * Bitwise memory for rooms, creeps, flags and structures
 */
RoomObject.prototype.enableBit = function (bit) {
	// let bits = this.memory.bits || 0;    
	if (this.memory !== undefined)
		return (this.memory.bits |= bit);
	return 0;
};

RoomObject.prototype.disableBit = function (bit) {
	if (this.memory !== undefined)
		return (this.memory.bits &= ~bit);
	return 0;
};

RoomObject.prototype.checkBit = function (bit) {
	if (this.memory !== undefined)
		return ((this.memory.bits || 0) & bit) !== 0;
	return false;
};

RoomObject.prototype.clearBits = function () {
	if (this.memory !== undefined)
		this.memory.bits = undefined;
};

RoomObject.prototype.canUseBits = function () {
	return this.memory !== undefined;
};

/**
 * Checks for a link in range
 */
RoomObject.prototype.getLink = function(range=2) {
	const [link] = this.pos.findInRange(FIND_MY_STRUCTURES, range, {filter: {structureType: STRUCTURE_LINK}});
	return link;
};

/**
 * Create a link for a given object
 */
RoomObject.prototype.planLink = function(range=1,adjust=2) {
	if(this.getLink(range+1) != null)
		return ERR_FULL;
	const origin = this.room.getOrigin().pos;
	if(!origin)
		throw new Error('Origin expected');
	try {
		const pos = origin.findPositionNear(this.pos, range, {
			plainSpeed: 2,
			swampSpeed: 5,
			roomCallback: (r) => FIXED_OBSTACLE_MATRIX[r]
		}, adjust);
		Log.debug(`Adding link to ${pos} for ${this}`, 'Planner');
		this.room.addToBuildQueue(pos, STRUCTURE_LINK);
		return OK;
	} catch(e) {
		Log.error(`Error planning link for ${this} at ${this.pos}`, 'RoomObject');
		Log.error(e.stack);
		return ERR_NO_PATH;
	}
};

/**
 * Resource extensions
 */
defineCachedGetter(Resource.prototype, 'decay', ({ amount }) => Math.ceil(amount / ENERGY_DECAY));

defineCachedGetter(RoomObject.prototype, 'total', function () {
	if (this instanceof Resource)
		return this.amount;
	else if (this instanceof Creep)
		return this.carryTotal;
	else if (this.store !== undefined)
		return _.sum(this.store);
	return 0;
});
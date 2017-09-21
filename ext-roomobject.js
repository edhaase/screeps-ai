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
	if (target == null || !validator(target)) {
		this.room.visual.circle(this.pos, { fill: 'red' });
		var candidates = _.filter(selector.call(this, this), validator);
		if (candidates && candidates.length)
			target = chooser(candidates, this);
		else
			target = null;
		if (target)
			this.memory[prop] = target.id;
		else
			delete this.memory[prop];
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
	if (tid == null || target == null || !validator(target)) {
		this.room.visual.circle(this.pos, { fill: 'red' });
		this.clearTarget(prop);
		var invalid = restrictor.call(this, this) || [];
		var candidates = _.filter(selector.call(this, this), x => validator(x) && !invalid.includes(x.id));
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
 * Clear target lock for actor
 */
RoomObject.prototype.clearTarget = function (prop = 'tid') {
	// delete this.memory[prop];
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
 * ex: transitions([
 *   [STATE_GATHER, () => this.carryTotal >= this.carryCapacity, STATE_UNLOAD, () => this.clearTarget() ],
 * 	 [STATE_UNLOAD, () => this.carryTotal <= 0, STATE_GATHER, () => this.clearTarget() ]
 * ])
 */
RoomObject.prototype.transitions = function (arr) {
	var state = this.getState();
	var enter, prev = state;
	for (var i = 0; i < arr.length; i++) {
		var [start, condition, end, onEnter] = arr[i];
		if (state === start && condition.call(this, this)) {
			state = end;
			enter = onEnter;
			// Test: save time by exit early
			if (enter) enter();
			return this.setState(state);
		}
	}
	if (enter)
		enter();
	if (state !== prev)
		this.setState(state);
	return state;
};

/**
 * Hash lookup: Far more performant than just scanning an array
 * ex: transitions({
 *  STATE_GATHER: [
 *		[() => this.carryTotal >= this.carryCapacity, STATE_UNLOAD, () => this.clearTarget() ]
 *	],
 * 	STATE_UNLOAD: [
 *		[() => this.carryTotal <= 0, STATE_GATHER, () => this.clearTarget()]
 *	]})
 */
RoomObject.prototype.getState = function (defaultState = 'I') {
	return this.memory.state || defaultState;
};

RoomObject.prototype.setState = function (state) {
	this.memory.state = state;
	return state;
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
RoomObject.prototype.getClosestSpawn = function (prop = 'memory') {
	if (!this[prop].spawn || !Game.spawns[this[prop].spawn] || Game.spawns[this[prop].spawn].isDefunct()) {
		const spawn = this.pos.findClosestSpawn();
		if (!spawn)
			return null;
		this[prop].spawn = spawn.name;
		Log.info(`Assigning spawn ${this[prop].spawn} to ${this}`);
	}
	return Game.spawns[this[prop].spawn];
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
		delete this.memory.bits;
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
	const pos = origin.findPositionNear(this.pos, range, {
		plainSpeed: 2,
		swampSpeed: 5,
		roomCallback: (r) => logisticsMatrix[r]
	}, adjust);
	Log.debug(`Adding link to ${pos} for ${this}`, 'Planner');
	this.room.addToBuildQueue(pos, STRUCTURE_LINK);
	return OK;
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
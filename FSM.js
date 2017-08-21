/**
 * fsm.js
 *
 * ES6 finite state machine with immutability to limit mistakes
 *
 * Features:
 *		Immutable objects to prevent annoying mistakes
 *		Reusable states
 *		CPU limiting
 *		Early-run next state
 */
"use strict";

/** 
 * Basis for all states
 */
class State {
	/** @property name - state name */
	/** @property blocking - blocking states prevent the early execution of other states when they change. */

	/**
	 * Only time the state is mutable is during construction.
	 */
	constructor(name) {
		if (name == undefined || !_.isString(name))
			throw new Error("State constructor expected string for parameter 1")
		this.expected = 0; // expected cpu cost
		this.name = name;
	}

	/** required if we want super-states that change the behavior of their children */
	_can(tick, params, fromState) { return this.can(tick, params, fromState); }
	_enter(tick, params, fromState) { return this.enter(tick, params, fromState) };
	_tick(tick) { return this.tick(tick); }
	_exit(tick, toState) { return this.exit(tick, toState); }

	/**
	 * Test if we can transition to this state.
	 * @param Tick tick
	 * @param Object [params]
	 * @param State fromState
	 */
	can(tick, params, fromState) { return true; }

	/**
	 * Called when we first switch to this state
	 */
	enter(tick, params, fromState) { }

	/**
	 * Called each tick while we're in this state.
	 */
	tick(tick) { }

	/**
	 * Called when we switch away from this state.
	 * @param Tick tick
	 * @param State toState
	 */
	exit(tick, toState) { }
}

/**
 *
 */
class VerboseState extends State {
	constructor(name) {
		super(name);
		console.log('constructed ' + this.name);
	}

	_enter(tick, params, fromState) {
		console.log('enter ' + this.name + ' <= ' + fromState);
		this.enter.apply(this, arguments);
	}

	_tick() {
		console.log('tick ' + this.name);
		this.tick.apply(this, arguments);
	}

	_exit(tick, toState) {
		console.log('exit ' + this.name + ' => ' + toState);
		this.exit.apply(this, arguments);
	}
}

/**
 * 
 */
class MemoryScopedState extends State {
	constructor(name) {
		super(name);
		console.log('constructed ' + this.name);
	}

	_enter() {
		console.log('enter ' + this.name);
		this.enter.apply(this, arguments);
	}

	_tick() {
		console.log('tick ' + this.name);
		this.tick.apply(this, arguments);
	}

	_exit() {
		console.log('exit ' + this.name);
		this.exit.apply(this, arguments);
	}
}


/**
 *
 */
class IdleState extends VerboseState {
	constructor() {
		super('idle');
	}

	/* enter() { console.log('enter idle'); } 
	exit() { console.log('exit idle'); }
	 */
	/* tick(tick) { 
		let {fsm, target, store} = tick;
		// console.log(JSON.stringify(store));
	} */
}

/**
 *
 */
class WaitState extends VerboseState {
	constructor(delay = 5) {
		super('wait');
		this.delay = delay;
	}

	enter(tick, params) {
		super.enter(tick);

		if (params && params.delay)
			tick.store.set('delay', params.delay);
		else
			tick.store.set('delay', this.delay);
		tick.store.set('start', Game.time);
	}

	tick(tick) {
		super.tick(tick);
		let delay = tick.store.get('delay');
		if (Game.time > tick.store.get('start') + delay)
			tick.transition('idle');
	}

	exit(tick) {
		let { fsm, target, store } = tick;
		store.clear('delay');
		store.clear('start');
	}
}

/**
 * Immutable tick object, potentially bad on cpu
 */
class Tick {
	/** @property {Object} target */
	/** @property Store - memory store */
	/** @property StateMachine - reference to parent state machine */
	constructor(fsm, target, store) {
		if (!(fsm instanceof StateMachine))
			throw new TypeError("Expected StateMachine");
		if (!(store instanceof Store))
			throw new TypeError("Expected Store");
		this.fsm = fsm;
		this.target = target;
		this.store = store;
		Object.freeze(this);
		// Time.measure( () => Object.freeze(this) );
	}

	/**
	 * tick.state property
	 */
	get stateName() {
		return this.store.get('state');
	}

	/**
	 * tick.state property
	 */
	get state() {
		return this.fsm.getState(this.stateName);
	}

	/**
	 * Since we contain a reference to all neccesary data, let's have some shorthand for transitions.
	 * @param Tick
	 * @param String
	 * @param String
	 * @return bool - true if transition succeeded
	 */
	transition(toName, params) {
		// let {fsm, target, store} = tick;
		if (!this.canTransitionTo(toName, params))
			return false;
		// console.log("State change " + this.stateName + " ==> " + toName);		
		let nextState = this.fsm.getState(toName);
		try {
			let prevState = this.stateName;
			if (prevState != undefined)
				this.state._exit(this, toName);
			this.store.set('state', toName);
			this.state._enter(this, params, prevState);
		} catch (e) {
			this.store.set('state', this.fsm.getDefaultStateName());
			Log.error("State transition error: " + e);
			Log.error(e.stack);
			return false;
		}
		return true;
	}

	/**
	 * @param String
	 * @param [Object]
	 */
	canTransitionTo(stateName, params) {
		let currState = (this.stateName) ? this.state : null;
		let nextState = this.fsm.getState(stateName);
		if (nextState._can(this, params, currState) === true)
			return true;
		return false;
	}
}

/**
 * StateMachine
 *
 * Each state has a name, 
 */
class StateMachine {
	constructor(states, concurrent = 3) {
		if (states == undefined || !_.isObject(states))
			throw new TypeError("StateMachine constructor expects states")
		this.states = states;
		this.concurrent = concurrent;
		_.each(this.states, (state, name) => Object.freeze(state));
		Object.seal(this);
	}

	/**
	 * 
	 */
	tick(target, store) {
		// must be supplied
		if (store == undefined)
			throw new Error("store cannot be null");

		// wrap as store object
		if (!(store instanceof Store))
			store = new Store(store);

		// get current state. defaults to idle.
		let tick = new Tick(this, target, store);
		this.execute(tick);
	}

	/**
	 *
	 */
	execute(tick, depth = 0) {
		if (!(tick instanceof Tick))
			throw new TypeError("StateMachine execute expects Tick")

		if (depth > this.concurrent)
			return;

		if (Game.cpu.getUsed() > Game.cpu.tickLimit - 100) {
			console.log("WARNING: High CPU usage in FSM. Cancelling.");
			return;
		}

		let currStateName = tick.stateName;
		if (!currStateName) {
			currStateName = this.getDefaultStateName();
			tick.transition(currStateName);
		}

		tick.state._tick(tick);
		let nextStateName = tick.stateName;
		if (nextStateName != currStateName)
			return this.execute(tick, depth + 1);
	}


	/**
	 * Find state
	 */
	getState(name) {
		if (!this.states[name])
			throw new Error("No such state: " + name);
		return this.states[name];
	}

	/**
	 * @return string
	 */
	getDefaultStateName() {
		throw new Error("No default state name");
	}
}

/**
 * Memory store
 */
class Store {
	constructor(obj) {
		if (obj == undefined)
			throw new Error("Store cannot be undefined");
		this.obj = obj;
		Object.seal(this);
	}

	get(path, defaultValue = null) {
		return _.get(this.obj, path, defaultValue);
	}

	set(path, value) {
		_.set(this.obj, path, value);
		return this;
	}

	clear(path) {
		// console.log('delete ' + path);
		delete this.obj[path];
	}
}

/** */
module.exports = {
	/* core classes */
	StateMachine: StateMachine,
	State: State,
	Store: Store,
	Tick: Tick,

	/** examples */
	VerboseState: VerboseState,
	IdleState: IdleState,
	WaitState: WaitState,
	MemoryScopedState: MemoryScopedState

}

/** let's cheat and put it all on global scope */
_.assign(global, module.exports);
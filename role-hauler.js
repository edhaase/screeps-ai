/**
 * Dedicated haulers
 *  memory: {role: 'hauler', site, dropoff}
 */
"use strict";

var FSM = require('FSM');
var ScreepsFSM = require('fsm-screeps');

class HaulerRole extends ScreepsFSM.Role {
	constructor() {
		super({
			idle: new IdleState,
			walk: new HaulerWalkState,
			gather: new GatherState,
			unload: new UnloadState
		});
	}

	tick(creep) {
		super.tick(creep);
		// find damaged road under us to repair
		let controller = creep.room.controller;
		creep.flee(5);
		if (controller && controller.my && controller.level >= 3)
			return;
		// let work = creep.getActiveBodyparts(WORK);
		let work = (creep.hits == creep.hitsMax) ? 2 : 0;
		let repairPower = REPAIR_POWER * work;
		if (work) {
			// let road = _.find(creep.pos.lookFor(LOOK_STRUCTURES), s => s.structureType === STRUCTURE_ROAD && (s.hitsMax - s.hits) >= repairPower);
			if (!creep.room.checkBit(BIT_DISABLE_REPAIR)) {
				let road = creep.pos.getStructure(STRUCTURE_ROAD, ({ hits, hitsMax }) => (hitsMax - hits >= repairPower));
				if (road)
					creep.repair(road);
			}
			else {
				let cs = _.find(creep.pos.lookFor(LOOK_CONSTRUCTION_SITES), s => s.structureType === STRUCTURE_ROAD);
				if (cs)
					creep.build(cs);
			}
		}
	}

	getDefaultStateName() {
		return 'idle';
	}
}

/**
 * Modified walk state
 */
class HaulerWalkState extends ScreepsFSM.WalkState {
	/* stuck() {
		// do nothing but wait
	} */

	tick(tick) {
		super.tick(tick);
		let nextState = tick.store.get('_walk.nextState');
		// console.log('next? ' + nextState);
		if (tick.target.carryTotal <= 0 && nextState == 'unload')
			return tick.transition('walk', {
				dest: { pos: tick.store.get('site'), range: 1 },
				nextState: 'gather'
			});

		this.bounce(tick);
	}

	onLowTicksToLive(tick, nextState) {
		let { fsm, target, store } = tick;
		// Log.info(target.name + ' entering recycle state');
		if (nextState === 'gather') {
			target.say('recycle!');
			target.setRole('recycle');
		}
	}

	bounce(tick) {
		let { fsm, target, store } = tick;

		if (tick.stateName === 'gather') {
			let creep = target;
			var adj = _.map(creep.lookForNear(LOOK_CREEPS, true), 'creep');
			var sub = _.find(adj, c => c.id != creep.id && c.my && c.memory.role === 'hauler' && _.get(c.memory, '_walk.nextState') === 'unload' && c.carry.energy > 20)
			if (sub) {
				creep.say("I'm helping!");
				console.log('Creep ' + creep.name + ' is assisting ' + sub.name + ' at ' + creep.pos);
				sub.transfer(creep, RESOURCE_ENERGY);
			}
		}
	}
}

/**
 * Pick a state based on where we are and what we should be doing.
 */
class IdleState extends FSM.State {
	constructor() {
		super('idle');
	}

	tick(tick) {
		let { fsm, target, store } = tick;
		// Log.info('Hauler ' + target.name + ' idle at ' + target.pos + ' moving to target site');
		let pos = _.create(RoomPosition.prototype, store.get('site'));

		if (target.pos.isNearTo(pos)) {
			tick.transition('gather');
		} else {
			// avoid rooms under threat?
			let roomName = store.get('site').roomName;
			if (roomName != target.pos.roomName
				&& Game.rooms[roomName]
				&& Game.rooms[roomName].controller != undefined
				&& Game.rooms[roomName].hostiles
				&& !_.isEmpty(Game.rooms[roomName].hostiles)) {
				target.say('holding!');
				// Log.warn('Gather room ' + roomName + ' under threat, ' + target.name + ' holding');
				return target.defer(5);
			}

			// 2016-10-27: holding for room visibility. should start moving once _any other creep_
			// is in the room.
			if (roomName != target.pos.roomName && Game.rooms[roomName] == undefined) {
				target.say('hold!');
				// Log.warn('Gather room ' + roomName + ' not visible, ' + target.name + ' holding');
				return target.defer(5);
			}

			tick.transition('walk', {
				dest: { pos: store.get('site'), range: 1 },
				nextState: 'gather'
			});
		}
	}
}

/**
 *
 */
class GatherState extends FSM.State {
	constructor() {
		super('gather');
	}


	tick(tick) {
		let { fsm, target, store } = tick;
		let pickup = _.create(RoomPosition.prototype, store.get('site'));
		if (target.carryCapacityAvailable <= 10)
			return tick.transition('walk', {
				dest: { pos: store.get('dropoff'), range: 1 },
				nextState: 'unload'
			});

		if (!target.pos.isNearTo(pickup))
			return tick.transition('walk', {
				dest: { pos: store.get('site'), range: 1 },
				nextState: 'gather'
			});

		if (target.pos.roomName != pickup.roomName)
			return tick.transition('walk', {
				dest: { pos: store.get('site'), range: 1 },
				nextState: 'gather'
			});

		let dropped = target.pos.findInRange(FIND_DROPPED_RESOURCES, 2, { filter: r => r.amount > 100 });
		let container = _.find(pickup.lookFor(LOOK_STRUCTURES), s => s.store != undefined);
		if (dropped && dropped.length) {
			let d = _.max(dropped, 'amount');
			if (target.pos.getRangeTo(d) > 1)
				target.move(target.pos.getDirectionTo(d.pos));
			_.any(dropped, r => target.pickup(r) === OK);
		} else if (container) {
			/* alloted amount works, but doesn't withdraw multiple types each tick
			let types = Math.max(1, Object.keys(container.store).length);
			let goal = target.carryCapacity / types;			
			_.each(container.store, (amt,type) => target.withdraw(container,type,goal) ); */
			// _.each(container.store, (amt,type) => target.withdraw(container,type));		
			target.withdrawAny(container);
		}

	}
}

/**
 *
 */
class UnloadState extends FSM.State {
	constructor() {
		super('unload');
	}

	tick(tick) {
		let { fsm, target, store } = tick;
		// if we're empty..
		if (target.carryTotal <= 0)
			return tick.transition('walk', {
				dest: { pos: store.get('site'), range: 1 },
				nextState: 'gather'
			});

		// if we're out of place..
		let rp = _.create(RoomPosition.prototype, store.get('dropoff'));
		if (!target.pos.isNearTo(rp))
			return tick.transition('walk', {
				dest: { pos: store.get('dropoff'), range: 1 },
				nextState: 'unload'
			});

		// look for targets (prefer designated)
		let container = _.find(rp.lookFor(LOOK_STRUCTURES), s => s.store !== undefined);
		// if( container ) { // && (_.sum(container.store) < CONTAINER_CAPACITY) ) {		
		if (container && (_.sum(container.store) < container.storeCapacity - 50)) {
			// return _.each(target.carry, (amt,type) => target.transfer(container, type));
			return target.transferAny(container);
		}

		// otherwise look for stuff nearby
		var adj = _.map(target.lookForNear(LOOK_STRUCTURES, true), LOOK_STRUCTURES);
		let link = _.find(adj, s => s.structureType === STRUCTURE_LINK); // || s.structureType === STRUCTURE_CONTAINER);		
		if (link && target.carry[RESOURCE_ENERGY])
			target.transfer(link, RESOURCE_ENERGY);
		// return target.transfer(link, RESOURCE_ENERGY);


		_.each(target.carry, (amt, type) => target.drop(type));
	}
}


module.exports = new HaulerRole;
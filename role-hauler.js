/**
 * Dedicated haulers
 *  memory: {role: 'hauler', site, dropoff}
 */
'use strict';
/*
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
		const { controller } = creep.room;
		creep.flee(5);
		if (controller && controller.my && controller.level >= 3)
			return;
		if (creep.hitPct < 0.25)
			creep.pushState('HealSelf');
		// let work = creep.getActiveBodyparts(WORK);
		const work = (creep.hits === creep.hitsMax) ? 2 : 0;
		const repairPower = REPAIR_POWER * work;
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


class HaulerWalkState extends ScreepsFSM.WalkState {

	tick(tick) {
		super.tick(tick);
		const nextState = tick.store.get('_walk.nextState');
		// console.log('next? ' + nextState);
		if (tick.target.carryTotal <= 0 && nextState == 'unload')
			return tick.transition('walk', {
				dest: { pos: tick.store.get('site'), range: 2 },
				nextState: 'gather'
			});

	}

	onLowTicksToLive(tick, nextState) {
		const { fsm, target, store } = tick;
		// Log.info(target.name + ' entering recycle state');
		if (nextState === 'gather') {
			target.say('recycle!');
			target.setRole('recycle');
		}
	}
}

class IdleState extends FSM.State {
	constructor() {
		super('idle');
	}

	tick(tick) {
		const { fsm, target, store } = tick;
		// Log.info('Hauler ' + target.name + ' idle at ' + target.pos + ' moving to target site');
		const pos = _.create(RoomPosition.prototype, store.get('site'));

		if (target.pos.isNearTo(pos)) {
			tick.transition('gather');
		} else {
			// avoid rooms under threat?
			const { roomName } = store.get('site');
			if (roomName !== target.pos.roomName
				&& Game.rooms[roomName]
				&& Game.rooms[roomName].controller != null
				&& Game.rooms[roomName].hostiles
				&& !_.isEmpty(Game.rooms[roomName].hostiles)) {
				target.say('holding!');
				// Log.warn('Gather room ' + roomName + ' under threat, ' + target.name + ' holding');
				return target.defer(5);
			}

			// 2016-10-27: holding for room visibility. should start moving once _any other creep_
			// is in the room.
			if (roomName !== target.pos.roomName && Game.rooms[roomName] == null) {
				target.say('hold!');
				// Log.warn('Gather room ' + roomName + ' not visible, ' + target.name + ' holding');
				return target.defer(5);
			}

			tick.transition('walk', {
				dest: { pos: store.get('site'), range: 2 },
				nextState: 'gather'
			});
		}
	}
}

class GatherState extends FSM.State {
	constructor() {
		super('gather');
	}


	tick(tick) {
		const { fsm, target, store } = tick;
		const pickup = _.create(RoomPosition.prototype, store.get('site'));
		if (target.carryCapacityAvailable <= 10) {
			if (!store.get('dropoff'))
				target.suicide();
			return tick.transition('walk', {
				dest: { pos: store.get('dropoff'), range: 1 },
				nextState: 'unload'
			});
		}

		if (!target.pos.inRangeTo(pickup, 2))
			return tick.transition('walk', {
				dest: { pos: store.get('site'), range: 2 },
				nextState: 'gather'
			});

		if (target.pos.roomName !== pickup.roomName)
			return tick.transition('walk', {
				dest: { pos: store.get('site'), range: 2 },
				nextState: 'gather'
			});

		const dropped = pickup.findInRange(FIND_DROPPED_RESOURCES, 2, { filter: r => r.amount > 100 });
		const structures = _.map(target.lookForNear(LOOK_STRUCTURES, true, 2), LOOK_STRUCTURES);
		const container = _.find(structures, s => s.store != null);
		if (dropped && dropped.length) {
			const d = _.max(dropped, 'amount');
			if (target.pos.getRangeTo(d) > 1)
				target.moveTo(d.pos, { range: 1, maxRooms: 1 });
			_.any(dropped, r => target.pickup(r) === OK);
		} else if (container) {
			target.withdrawAny(container);
		}

	}
}


class UnloadState extends FSM.State {
	constructor() {
		super('unload');
	}

	enter(tick) {
		const { fsm, target, store } = tick;
		const dropoff = store.get('dropoff');
		if (!dropoff || !dropoff.roomName)
			return;
		store.set('origin', dropoff.roomName);
	}

	tick(tick) {
		const { fsm, target, store } = tick;
		// if we're empty..
		if (target.carryTotal <= 0)
			return tick.transition('walk', {
				dest: { pos: store.get('site'), range: 2 },
				nextState: 'gather'
			});

		// if we're out of place..
		const rp = _.create(RoomPosition.prototype, store.get('dropoff'));
		if (!target.pos.isNearTo(rp))
			return tick.transition('walk', {
				dest: { pos: store.get('dropoff'), range: 1 },
				nextState: 'unload'
			});

		// look for targets (prefer designated)
		const container = _.find(rp.lookFor(LOOK_STRUCTURES), s => s.store !== undefined);
		// if( container ) { // && (_.sum(container.store) < CONTAINER_CAPACITY) ) {		
		if (container && (_.sum(container.store) < container.storeCapacity - 50) && target.transferAny(container) === OK)
			return;

		// otherwise look for stuff nearby
		var adj = _.map(target.lookForNear(LOOK_STRUCTURES, true), LOOK_STRUCTURES);
		const link = _.find(adj, s => s.structureType === STRUCTURE_LINK); // || s.structureType === STRUCTURE_CONTAINER);
		if (link && target.carry[RESOURCE_ENERGY] && target.transfer(link, RESOURCE_ENERGY) === OK)
			return;
		// return target.transfer(link, RESOURCE_ENERGY);


		_.each(target.carry, (amt, type) => target.drop(type));
	}
}


module.exports = new HaulerRole; */

module.exports = {
	body: function () {

	},
	init: function () {
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		// if(this.carryCapacityAvailable <= 0) {
		const state = this.getState('U');
		if (state === 'U') {
			this.setState('G');
			this.pushState("MoveTo", { pos: this.memory.site, range: 1 });
			if (!this.memory.dropoff)
				this.setRole('recycle');
			const rp = _.create(RoomPosition.prototype, this.memory.dropoff);
			const container = _.find(rp.lookFor(LOOK_STRUCTURES), s => s.store !== undefined);
			if (container && (_.sum(container.store) < container.storeCapacity - 50) && this.transferAny(container) === OK)
				return;
			// otherwise look for stuff nearby
			var adj = _.map(this.lookForNear(LOOK_STRUCTURES, true), LOOK_STRUCTURES);
			const link = _.find(adj, s => s.structureType === STRUCTURE_LINK); // || s.structureType === STRUCTURE_CONTAINER);
			if (link && this.carry[RESOURCE_ENERGY] && this.transfer(link, RESOURCE_ENERGY) === OK) {
				const diff = Math.min(this.carry[RESOURCE_ENERGY], link.energyCapacityAvailable);
				// this.carry[RESOURCE_ENERGY] -= link.energyCapacityAvailable;
				Object.defineProperty(this.carry, RESOURCE_ENERGY, {
					value: this.carry[RESOURCE_ENERGY] - link.energyCapacityAvailable,
					configurable: true
				});
				Object.defineProperty(link, 'energy', { value: link.energy + diff, configurable: true });
			}
			_.each(this.carry, (amt, type) => amt > 0 && this.drop(type, amt));
		} else if (state === 'G') {
			const pickup = _.create(RoomPosition.prototype, this.memory.site);
			if (pickup.roomName === this.pos.roomName) {
				const dropped = pickup.findInRange(FIND_DROPPED_RESOURCES, 2, { filter: r => r.amount > 100 });
				const structures = _.map(this.lookForNear(LOOK_STRUCTURES, true, 2), LOOK_STRUCTURES);
				const container = _.find(structures, s => s.store != null);
				var pile;
				var limit = this.carryCapacityAvailable;
				if (dropped && dropped.length) {
					const d = _.max(dropped, 'amount');
					if (this.pos.getRangeTo(d) > 1)
						return this.moveTo(d.pos, { range: 1, maxRooms: 1 });
					pile = _.find(dropped, r => this.pickup(r) === OK);
					if (pile)
						limit -= pile.amount;

				}
				if (container && limit >= 0) {
					this.withdrawAny(container, limit);
				}
			}
			this.setState('U');
			this.pushState("MoveTo", { pos: this.memory.dropoff, range: this.memory.range || 1 });
		}
	}
};

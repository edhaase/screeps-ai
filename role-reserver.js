/**
 * role-reserver.js
 *
 * Deploy reserver to hold site
 *
 * Game.spawns.Spawn1.enqueue([CLAIM,CLAIM,MOVE,MOVE], null, {role:'reserver', site: new RoomPosition(20,23,'E57S46')})
 * 2-part claim bits up reservation.
 * 129 ticks to walk there, 500 ticks to live, holds for 362 (ish) (or 2*CLAIM - TRAVEL)
 * Sprint for: 1300 energy every 800 ticks
 * Claim flag could track time until arrival, predict when to schedle new ones?
 */
"use strict";
/* module.exports = function(creep) {
	var pos = _.create(RoomPosition.prototype, creep.memory.site);
	if(!creep.pos.isNearTo(pos)) {
		creep.moveTo(pos, {reusePath:5});
	} else {
		if(!creep.memory.travelTime)
			creep.memory.travelTime = CREEP_CLAIM_LIFE_TIME - creep.ticksToLive;
		creep.reserveController(creep.room.controller);
		creep.room.memory.reservation = Game.time + _.get(creep.room.controller, 'reservation.ticksToEnd', 0);
	}

} */

// module.exports.body = [CLAIM,CLAIM,MOVE,MOVE];

var FSM = require('FSM');
var ScreepsFSM = require('fsm-screeps');

class ReserverRole extends ScreepsFSM.Role {
	constructor() {
		super({
			idle: new IdleReserveState,
			walk: new ReserveWalk,
			reserve: new ReserveState,
		});
	}

	getDefaultStateName() {
		return 'idle';
	}
}

class ReserveWalk extends ScreepsFSM.WalkState {
	// Use logistics matrix. Avoids obstacles and prefers roads
	// 'Ought to cache this
	getCostMatrix(roomName) {
		return LOGISTICS_MATRIX[roomName];
	}
}

class IdleReserveState extends FSM.State {
	constructor() {
		super('idle');
	}

	tick(tick) {
		const { fsm, target, store } = tick;
		const pos = _.create(RoomPosition.prototype, store.get('site'));


		var routing = Memory.routing || {};
		if (_.contains(routing.avoid, pos.roomName))
			return Log.warn(`Reserver ${target.name} at ${target.pos}, unable to reach target site ${pos}, room is blacklisted`, 'Creep');

		Log.debug(`Reserver ${target.name} idle at ${target.pos}, moving to target site ${pos}`, 'Creep');
		if (target.pos.isNearTo(pos)) {
			tick.transition('reserve');
		} else {
			tick.transition('walk', {
				dest: { pos: tick.store.get('site'), range: 1 },
				nextState: 'reserve'
			});
		}
	}
}

class ReserveState extends FSM.State {
	constructor() {
		super('reserve');
	}
	enter(tick) {
		const { fsm, target, store } = tick;
		target.memory.travelTime = CREEP_CLAIM_LIFE_TIME - target.ticksToLive;
		// Log.info('Reserver at ' + target.pos + ' switch to reserve!');
	}

	tick(tick) {
		const { fsm, target, store } = tick;
		let status = OK;

		try {
			if (target.pos.inRangeTo(target.room.controller, 1)
				&& target.room.controller.owner
				&& target.room.controller.owner.username
				&& !target.room.controller.my
				&& target.hasActiveBodypart(CLAIM))
				return target.attackController(target.room.controller);

			if ((status = target.reserveController(target.room.controller)) != OK) {
				Log.warn(`ReserveState: ${status} at ${target.pos}`);
				if (status === ERR_NOT_IN_RANGE)
					tick.transition('walk', {
						dest: { pos: tick.store.get('site'), range: 1 },
						nextState: 'reserve'
					});
			}
		} finally {
			target.room.memory.reservation = Game.time + _.get(target.room.controller, 'reservation.ticksToEnd', 0);
		}
	}
}

module.exports = new ReserverRole;
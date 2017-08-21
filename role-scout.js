/**
 * role-scout.js
 *
 * Combination walk test / Room scanning. 
 */
"use strict";
var FSM = require('FSM');
var ScreepsFSM = require('fsm-screeps');

/**
 * Scout role is a finite state machine for driving a scout unit,
 * that explores the map and grants us visibility in far away places.
 */
class ScoutRole extends ScreepsFSM.Role {
	constructor() {
		super({
			scout: new ScoutState(),
			walk: new ScoutWalk
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

class ScoutWalk extends ScreepsFSM.WalkState {
	constructor() {
		super();
	}

	tick(tick) {
		let { fsm, target, store } = tick;
		let lastRoom = store.get('_walk.lastPos.roomName');
		// console.log(lastRoom + " => " + target.pos.roomName);
		if (target.pos.roomName != lastRoom) {
			Log.info('Scout crossed border!');
			if (SEGMENTS[SEGMENT_COSTMATRIX] == undefined)
				return Log.warn('Segment not loaded');
			else {
				let cm = (new CostMatrix.FixedObstacleMatrix(target.pos.roomName)).serialize();
				if (_.any(cm, c => c != 0)) {
					Log.info("Obstacles noted. Saved matrix for room " + target.pos.roomName);
					// _.set(Memory.rooms, target.pos.roomName + '.cm.obstacle', cm);
					var segment = SEGMENTS[SEGMENT_COSTMATRIX];
					var { roomName } = target.pos;
					if (!segment.data[roomName])
						segment.data[roomName] = {};
					segment.data[roomName]['om'] = cm;
					segment.ts = Game.time; // Bump it up to save.
				} else {
					Log.info("No man-made obstaclces. No matrix needed");
				}
			}
		}

		super.tick(tick);
	}
}

/**
 * Scout state is unique to the scout, so we don't need it to be reusable.
 *  ..unless we want scouting demos?
 */
class ScoutState extends FSM.State {
	constructor() { super('scout'); }

	enter(tick) {
		// Log.info('Scout holding for 5 ticks');
		tick.target.say('Holding!');
		tick.target.memory.defer = Game.time + 5;
	}

	tick(tick) {
		let { fsm, target, store } = tick;
		let flag = store.get('flag');
		if (flag && Game.flags[flag]) {
			tick.transition('walk', {
				dest: { pos: Game.flags[flag].pos, range: 1 }, // 25 around center so 25 + 25 = 50
				nextState: 'scout'
			});
		} else {
			let randomRoomName = _.sample(Game.map.describeExits(target.room.name));
			let goal = new RoomPosition(25, 25, randomRoomName);
			Log.info("Scout heading to pos: " + goal);
			tick.transition('walk', {
				dest: { pos: goal, range: 20 }, // 25 around center so 25 + 25 = 50
				nextState: 'scout'
			});
		}
	}
}

module.exports = new ScoutRole;
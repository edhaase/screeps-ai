/**
 * Drop miner. Moves to worksite and mines until he's dead.
 */
"use strict";

/*
module.exports = function(creep) {
    var flag = Game.flags['Claim'];
    if(!creep.pos.isNearTo(flag.pos))
        creep.moveTo(flag.pos, {reusePath: 5}); // switch to better pathfinding?
    
    if(creep.pos.isNearTo(flag.pos)) {
        var r = creep.claimController(creep.room.controller);
        console.log("Claim: " + r);
    }
        // var source = flag.pos.lookFor(LOOK_SOURCES)[0];
}
*/

var FSM = require('FSM');
var ScreepsFSM = require('fsm-screeps');

/** */
class ClaimerRole extends ScreepsFSM.Role
{
	constructor() {
		super({
			idle: new IdleState,
			walk: new WalkState,
		});
	}
	
	getDefaultStateName() {
		return 'idle';
	}	
}

/** */
class IdleState extends FSM.State
{
	constructor() {
		super('idle');
	}
	
	tick(tick) {
		let {fsm, target, store} = tick;
		let flag = Game.flags['Claim'];
		if(!flag)
			return target.say('idle!');
				
		if(target.pos.isNearTo(flag.pos)) {
			let status = target.claimController(target.room.controller);
			Log.info('Claimer status: ' + status);
			if(status === OK) {
				Log.notify('Claimed room ' + target.pos.roomName);
				target.setRole('recycle');
			}
		} else {
			if( tick.transition('walk', {
				dest: { pos: flag.pos, range: 1},
				nextState: 'idle'
			}) == false) {
				target.memory.defer = Game.time + 5;
				console.log('No path for claimer ' + target.name);
			}
		}
	}	
}

module.exports = new ClaimerRole;
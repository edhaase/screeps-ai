/**
 * Simple claimer. Moves to a position and claims a controller.
 */
"use strict";

module.exports = function(creep) {
	// var flag = Game.flags['Claim'];
	var pos = _.create(RoomPosition.prototype, creep.memory.pos);
	if(!creep.pos.isNearTo(pos)) {
		creep.moveTo(pos, {reusePath: 5, range: 1});
	} else {
		var status = creep.claimController(creep.room.controller);
		console.log(`Claimer: ${status}`);
		if(status === OK) {
			Log.notify(`Claimed room ${creep.pos.roomName}`);
			creep.setRole('recycle');
		}
	}
};
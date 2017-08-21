/**
 * role-pioneer.js
 */
"use strict";

/*
 "sign": {
    "username": "Leonyx",
    "text": "?",
    "time": 16882786,
    "datetime": "2017-01-21T02:58:45.655Z"
  }
  */

/**
 * Rules for claiming a room:
 * 
 */
function canClaimRoom(room) {
	let controller = room.controller;
	if (!controller)
		return false;
	var { owner, reservation, sign } = controller;
	if (owner)
		return false; // We can't claim it either, it's not ours.
	if (reservation)
		return false;
	if (sign && (Game.time - sign.time < 20000 * 5)) {
		// var {username,text,time,datetime} = sign;
		return false;
	}
	return true;
}

function canClaimAnything() {
	return Game.gcl.level - _.sum(Game.rooms, 'my');
}

module.exports = function () {
	var { dest, rooms } = this.memory;
	if (!canClaimAnything())
		return this.setRole('recycle');
	if (!dest || (Game.rooms[dest] && !canClaimRoom(Game.rooms[dest]))) {
		if (_.isEmpty(rooms)) {
			Log.warn('Pioneer has no rooms to explore');
			return this.setRole('recycle');
			// return this.defer(15);
		}
		// Why did we shut this off? ..Cause we want to pass in preferred order
		// this.memory.rooms = _.shuffle(this.memory.rooms);
		dest = this.memory.rooms.shift();
		this.memory.dest = dest;
		Log.warn('Pioneer chose room ' + dest);
	}
	this.say(dest);

	this.flee();
	if (this.pos.roomName !== dest)
		return this.moveToRoom(dest);

	var controller = this.room.controller;
	if (!controller || !canClaimRoom(this.room))
		return this.memory.dest = null;

	var status = this.claimController(controller);
	if (status == ERR_NOT_IN_RANGE)
		this.moveTo(controller, { range: 1, maxRooms: 1 });
	else if (status != OK) {
		Log.warn('Status: ' + status, 'Pioneer');
	}
};
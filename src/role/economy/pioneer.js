/**
 * role.pioneer.js
 * 
 * Dispatched to claim a new room from a list of candidates
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';

/**
 * Rules for claiming a room:
 */
const MAX_SIGN_AGE = 20000 * 3;
function canClaimRoom(room) {
	const { controller } = room;
	if (!controller)
		return false;
	const { owner, reservation, sign } = controller;
	if (owner || (reservation && reservation.username !== WHOAMI))
		return false; // We can't claim it either, it's not ours.
	// if (sign && (Game.time - sign.time < MAX_SIGN_AGE)) { // Too canadian
	// var {username,text,time,datetime} = sign;
	//	return false;
	// }
	return true;
}

function canClaimAnything() {
	return Game.gcl.level - _.sum(Game.rooms, 'my');
}

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
	run: function () {
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
			Log.warn(`${this.name}/${this.pos} Pioneer chose room ${dest}`, 'Creep');
		}
		this.say(dest);

		this.flee();
		if (this.pos.roomName !== dest)
			return this.pushState("MoveToRoom", dest);

		const { controller } = this.room;
		if (!controller || !canClaimRoom(this.room))
			return this.memory.dest = null;

		var status = this.claimController(controller);
		if (status === ERR_NOT_IN_RANGE)
			this.moveTo(controller, { range: 1, maxRooms: 1 });
		else if (status === ERR_GCL_NOT_ENOUGH)
			this.setRole('recycle');
		else if (status !== OK) {
			Log.warn(`${this.name}/${this.pos} status: ${status}`, 'Pioneer');
		}
	}
};
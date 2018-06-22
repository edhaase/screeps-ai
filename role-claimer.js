/**
 * role-claimer.js
 *
 * Simple claimer. Moves to a position and claims a controller.
 */
'use strict';

/* global Log */

module.exports = {
	body: [CLAIM, MOVE],
	init: function () {
		this.pushState("EvadeMove", { pos: this.memory.pos, range: 1 });
	},
	/* eslint-disable consistent-return */
	run: function () {
		var status = this.claimController(this.room.controller);
		if (status === OK) {
			Log.notify(`Claimed room ${this.pos.roomName}`);
			this.setRole('recycle');
		} else {
			Log.warn(`Unable to claim ${this.pos.roomName} status ${status}`, 'Claimer');
		}
	}
};
/**
 * role.claimer.js
 *
 * Simple claimer. Moves to a position and claims a controller.
 * 
 * @todo Add work parts and logic to push controller to RCL 2
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';

/* global Log */

export default {
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
			Log.warn(`${this.name}/${this.pos} failed to claim controller with status ${status}`, 'Claimer');
		}
	}
};
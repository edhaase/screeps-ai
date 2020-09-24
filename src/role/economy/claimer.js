/**
 * role.claimer.js
 *
 * Simple claimer. Moves to a position and claims a controller.
 * 
 * @todo Add work parts and logic to push controller to RCL 2
 * @example Game.spawns.Spawn48.submit({ body: [MOVE,CLAIM], memory: { role: 'claimer', pos: new RoomPosition(18,9,'E59S57')} });
 */
'use strict';

import { Log } from '/os/core/Log';
import Body from '/ds/Body';

/* global Log */

export default {
	minBody: [CLAIM, MOVE],
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
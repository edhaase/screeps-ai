/**
 * role.signer.js - Sets controller messages
 *
 * Memory:
 *	room: (optional) if no dest, can move to room instead and find dest
 *	dest: position of controller
 *	msg: what to set the controller to. Empty string to remove.
 *
 * example:  {role: 'signer', dest: new RoomPosition(21,41,'W2N7'), msg: 'Zenity'}, 1);
 * example:  {role: 'signer', room: 'W1N7', msg: 'Zenity'}, 1)
 * example:  {role: 'signer', room: 'W1N7', msg: ''}, 1)
 * example:  {role: 'signer', room: 'W3N3', msg: 'Test'}, priority: 100})
 */
'use strict';

import { Log, LOG_LEVEL } from '/os/core/Log';

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	minBody: [MOVE],
	/* eslint-disable consistent-return */
	run: function () {
		var { room, dest, msg } = this.memory;
		if (dest == null && room != null) {
			if (this.pos.roomName === room) {
				this.say('Found');
				this.memory.dest = this.room.controller.pos;
			} else
				this.moveToRoom(room);
			return;
		}
		const pos = new RoomPosition(dest.x, dest.y, dest.roomName);
		if (!this.pos.isNearTo(pos))
			return this.moveTo(pos, { range: 1 });
		const status = this.signController(this.room.controller, msg);
		if (status === OK)
			return this.setRole('recycle');
		else
			Log.warn(`${this.name}/${this.pos} Failed to sign controller with status ${status}`);
	}
};
/**
 * role-signer.js - Sets controller messages
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

module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function() {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
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
		const pos = _.create(RoomPosition.prototype, dest);
		if (!this.pos.isNearTo(pos))
			return this.moveTo(pos, { range: 1 });
		const status = this.signController(this.room.controller, msg);
		if (status === OK)
			return this.setRole('recycle');
		else
			Log.warn(`Unable to sign controller: ${status}`);
	}
};



module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function() {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function(creep) {
		creep.pushStates([
			['SetRole', 'recycle'],
			['EvalOnce', `this.signController(this.room.controller, "${creep.memory.msg}")`],
			['EvalOnce', 'this.pushState("EvadeMove",{pos:this.memory.dest})'],
			['EvalOnce', 'this.memory.dest = this.room.controller.pos'],
			['MoveToRoom', creep.memory.room]
		]);
	},
	run: function(creep) {
		/* Maybe not neccesary if our stack machine is good enough? */
		creep.say('Done!');
	}
};
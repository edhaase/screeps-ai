/**
 * role-signer.js - Sets controller messages
 *
 * Memory:
 *	room: (optional) if no dest, can move to room instead and find dest
 *	dest: position of controller
 *	msg: what to set the controller to. Empty string to remove.
 *
 * example: Game.spawns.Spawn1.enqueue([MOVE], null, {role: 'signer', dest: new RoomPosition(21,41,'W2N7'), msg: 'Zenity'}, 1);
 * example: Game.spawns.Spawn1.enqueue([MOVE], null, {role: 'signer', room: 'W1N7', msg: 'Zenity'}, 1)
 * example: Game.spawns.Spawn1.enqueue([MOVE], null, {role: 'signer', room: 'W1N7', msg: ''}, 1)
 */
'use strict'; 

module.exports = {
	run: function() {
		var {room,dest,msg} = this.memory;
		if(dest == undefined && room != undefined) {
			if(this.pos.roomName == room) {
				this.say('Found');
				this.memory.dest = this.room.controller.pos;
			} else
				this.moveToRoom(room);
			return;
		}
		let pos = _.create(RoomPosition.prototype, dest);
		if(!this.pos.isNearTo(pos))
			return this.moveTo(pos, {range: 1});
		let status = this.signController(this.room.controller, msg);
		if(status === OK)
			return this.setRole('recycle');
		else
			Log.warn('Unable to sign controller: ' + status);
	}
}
/**
 * role-scout.js
 */
'use strict';

module.exports = {
	init: function (creep) {
		this.memory.roomName = _.sample(Game.map.describeExits(creep.pos.roomName));
	},
	body: function () {

	},
	run: function () {
		const { roomName = this.pos.roomName } = this.memory;
		if (this.pos.roomName !== roomName)
			return this.moveToRoom(roomName);
		const exits = Game.map.describeExits(this.pos.roomName);
		this.memory.roomName = _.sample(exits);
		this.say('Arrived!');
		if (!this.room.my && Memory.empire && Memory.empire.remoteMine && _.any(exits, exit => Game.rooms[exit] && Game.rooms[exit].my)) {
			this.say('Want!');
			this.room.find(FIND_SOURCES).forEach(s => {
				s.pos.createLogicFlag(null, FLAG_MINING, SITE_REMOTE);
				s.pos.createLogicFlag(null, FLAG_MINING, SITE_PICKUP);
			});
			if (this.room.controller) {
				this.room.controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESERVE);
				this.room.controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESPOND);
			}
			Log.info(`Scout wants ${this.pos.roomName} as it's near our empire`);
		}
		Log.debug(`${this.name} picked room ${roomName}`);
	}
};
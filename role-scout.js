/**
 * role-scout.js
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
	init: function (creep) {

	},
	/* eslint-disable consistent-return */
	run: function () {
		const { roomName = this.pos.roomName } = this.memory;
		if (this.pos.roomName !== roomName)
			return this.moveToRoom(roomName);
		const {room} = this;
		// @todo if hostile, leave the way we entered
		// @todo score rooms, don't pick at random
		// @todo gather intel on rooms we pass through along the way
		// @todo move intel to Game.rooms?
		const exits = Game.map.describeExits(this.pos.roomName);
		this.memory.roomName = _.sample(exits);
		Log.debug(`${this.name} picked room ${roomName}`,'Creep');
		this.say('Arrived!');
		require('Intel').scanRoom(room);
		if (!this.room.my && Memory.empire && Memory.empire.remoteMine && _.any(exits, exit => Game.rooms[exit] && Game.rooms[exit].my)) {
			this.say('Want!');
			if(Room.getType(this.pos.roomName) !== 'SourceKeeper' && this.room.controller && !this.room.controller.owner) {
				this.room.find(FIND_SOURCES).forEach(s => {
					s.pos.createLogicFlag(null, FLAG_MINING, SITE_REMOTE);
					s.pos.createLogicFlag(null, FLAG_MINING, SITE_PICKUP);
				});
				if (this.room.controller) {
					this.room.controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESERVE);
					this.room.controller.pos.createLogicFlag(null, FLAG_MILITARY, STRATEGY_RESPOND);
				}
				Log.info(`Scout wants ${this.pos.roomName} as it's near our empire`,'Creep');
			}
		}
		
	}
};
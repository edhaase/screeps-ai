/**
 * role.scout.js
 */
'use strict';

const Intel = require('Intel');

/* global Log */
/* global FLAG_MINING, FLAG_MILITARY, SITE_REMOTE, SITE_PICKUP, STRATEGY_RESERVE, STRATEGY_RESPOND */

module.exports = {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {
		// Since we can't call this while spawning..
		this.pushState('EvalOnce', { script: 'this.notifyWhenAttacked(false)' });
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { roomName } = this.memory;	
		if (roomName && this.pos.roomName !== roomName)
			return this.moveToRoom(roomName);
		const { room } = this;
		// @todo if hostile, leave the way we entered
		// @todo score rooms, don't pick at random
		// @todo gather intel on rooms we pass through along the way
		// @todo move intel to Game.rooms?
		// const exits = Game.map.describeExits(this.pos.roomName);
		const exits = _.omit(Game.map.describeExits(this.pos.roomName), (v, k) => !Game.map.isRoomAvailable(v));
		this.memory.roomName = _.sample(exits);
		Log.debug(`${this.name} picked room ${roomName}`, 'Creep');
		this.say('Arrived!');
		Intel.scanRoom(room);
		if (Intel.markCandidateForRemoteMining(room))
			this.say('Want!');
	}
};
/**
 * role.scout.js
 */
'use strict';

import { ICON_ANTENNA } from '/lib/icons';
import { IS_SAME_ROOM_TYPE } from '/Intel';
import { Log, LOG_LEVEL } from '/os/core/Log';
import { scanRoom } from '/Intel';
import { MAP_ICON_SIZE, MAP_ICON_OPACITY } from '/os/core/constants';

/* global Log */
/* global FLAG_ECONOMY, FLAG_MILITARY, SITE_REMOTE, SITE_PICKUP, STRATEGY_RESERVE, STRATEGY_RESPOND */

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	minBody: [MOVE],
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
		const exits = _.omit(Game.map.describeExits(this.pos.roomName), (v, k) => !IS_SAME_ROOM_TYPE(this.pos.roomName, v));
		this.memory.roomName = _.sample(exits);
		Log.debug(`${this.name}/${this.pos} picked room ${roomName}`, 'Creep');
		this.say(ICON_ANTENNA, true);
		this.memory.idle = true;
		
		scanRoom(room);
		markCandidateForRemoteMining(room);
		markCandidateForCommodityMining(room);		
		markCandidateForLooting(room);

		if (Game.map.visual)
			Game.map.visual.text(ICON_ANTENNA, new RoomPosition(25, 25, this.pos.roomName), { opacity: MAP_ICON_OPACITY, fontSize: MAP_ICON_SIZE });
	}
};
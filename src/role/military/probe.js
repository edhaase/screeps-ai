/**
 * Tests defenses, looking for weak tower code. If we have an intel event, use that.
 * But we might not have visibility, and therefore have to use memory to make
 * some assumptions about what killed us.
 * 
 * If we made it to the goal room or close enough to before we died, we can assume
 * tower fire is what killed is.
 * 
 * Possible probe types:
 *  [MOVE] - If ignored we could park site stompers in the room
 *  [MOVE,CARRY] - If ignored we can send disruptors to dump their energy on the floor
 *  []
 */
'use strict';

import { Log } from '/os/core/Log';

export default {
	boosts: [],
	body: function () {
		// Depends..
	},
	init: function () {
		this.memory.body = _.map(this.body, 'part');
	},
	cleanup: function (memory, name) {
		const { lastKnown } = memory;
		const pos = new RoomPosition(lastKnown.x, lastKnown.y, lastKnown.roomName);
		if (pos.roomName === memory.dest) {
			Log.warn(`${name} probe died near ${pos} -- updating intel`,  'Creep')
		} else {
			Log.warn(`${name} probe died near ${pos} -- test failed`,  'Creep')
		}
	},
	/* eslint-disable consistent-return */
	run: function () {
		this.memory.lastKnown = this.pos;

	}
};
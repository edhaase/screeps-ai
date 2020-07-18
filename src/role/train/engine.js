/**
 * role.train.engine.js - Pathfinding and logistics
 */
'use strict';

import Body from '/ds/Body';

import { unauthorizedHostile } from '/lib/filter';

export default {
	priority: function () {
		// (Optional)
	},
	body: function ({ room }) {
		return Body.repeat([CARRY, MOVE], room.energyAvailable);
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
	run: function () {
		const { train, link } = this.memory;
	}
};
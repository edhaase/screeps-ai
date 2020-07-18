/**
 * role.train.car.js - Following and logistics
 */
'use strict';

import Body from '/ds/Body';

import { unauthorizedHostile } from '/lib/filter';
import { createShardLocalUUID } from '/os/core/uuid';
import { Log, LOG_LEVEL } from '/os/core/Log';

const trains = {};

export default {
	priority: function () {
		// (Optional)
	},
	body: function ({ room }) {
		return Body.repeat([CARRY, MOVE], room.energyAvailable);
	},
	init: function () {
		if (!this.memory.train) {
			this.memory.train = createShardLocalUUID();			
			trains[this.memory.train] = {};
			Log.debug(`New train created ${this.memory.train}`, 'Train');
		}
		const { train } = this.memory;
		
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { train, next, prev } = this.memory;
		if (!trains[train])
			trains[train] = {};
		

		if (!Game.creeps[prev]) {
			Log.debug(`${this.name}/${this.pos} Unable to find next car, updating`, 'Train');
			const next = _.find(Game.creeps, c => c.memory.role === 'train.car' &&  !Game.creeps[c.memory.next] )
		}
	}
};
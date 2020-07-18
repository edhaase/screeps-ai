/**
 * role.charvest.js
 *
 * Economy unit. Harvests commodities
 * 
 * gpbn('spawn')[0].submit({room: 'E60S47', body: [WORK,CARRY,MOVE,MOVE], memory: {role: 'charvest', pos: new RoomPosition(18,31,'E60S47'), did: '5f09af66070638c85b5826c1'}})
 */
'use strict';

import Body from '/ds/Body';
import { ICON_CIGARETTE } from '/lib/icons';
import { Log, LOG_LEVEL } from '/os/core/Log';

export const MINIMUM_TTL_TO_HARVEST_COMMODITY = 250;
const MINIMUM_TTL_TO_RENEW = 750;
const MAX_DEPOSIT_COOLDOWN = 100;
const MINIMUM_DEPOSIT_TTL_TO_ATTEMPT = 500;

/**
 * 
 * @param {*} deposit 
 */
export function can_we_harvest_commodity(deposit) {
	const { depositType, cooldown, lastCooldown, ticksToDecay } = deposit;
	if (cooldown + lastCooldown >= ticksToDecay)
		return false;
	if (lastCooldown >= MAX_DEPOSIT_COOLDOWN)
		return false;
	if (ticksToDecay < MINIMUM_DEPOSIT_TTL_TO_ATTEMPT)
		return false;
	return true;
}

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function ({ room }) {
		return Body.repeat([WORK, CARRY, MOVE, MOVE], room.energyCapacityAvailable);
	},
	init: function () {
		this.memory.w = HARVEST_DEPOSIT_POWER * this.getActiveBodyparts(WORK);
	},
	/* eslint-disable consistent-return */
	run: function () {
		const { pos, did } = this.memory;
		const workPerOperation = this.memory.w;

		/**
		 * If we need to unload then go unload.
		 */
		if (this.ticksToLive < MINIMUM_TTL_TO_HARVEST_COMMODITY)
			return this.setRole('recycle');
		if (this.carryCapacityAvailable < workPerOperation)
			return this.pushState('Unload', null);

		/**
		 * If we're not near the commodity, go track it down.
		 */
		const dest = new RoomPosition(pos.x, pos.y, pos.roomName);
		if (!this.pos.isNearTo(dest)) {
			/**
			 * We're probably near a colony. If we're low on life, try to renew
			 */
			if (this.ticksToLive <= MINIMUM_TTL_TO_RENEW)
				return this.pushState('RenewSelf', {});
			return this.pushState('EvadeMove', { pos: dest, range: 1 });
		}

		/**
		 * We're in position! Harvest away.
		 */
		const deposit = Game.getObjectById(did);
		if (deposit.lastCooldown >= MAX_DEPOSIT_COOLDOWN || deposit.cooldown >= this.ticksToLive || !deposit)
			return this.setRole('recycle');
		if (deposit.cooldown) {
			if (Math.random() < 0.05)
				this.say(ICON_CIGARETTE, true);
			return;
		}

		const status = this.harvest(deposit);
		switch (status) {
			case OK:
				break;
			case ERR_NOT_IN_RANGE:
				this.pushState('MoveTo', { pos: did.pos, range: 1 });
				break;
			default:
				Log.error(`${this.name}/${this.pos} failed to harvest deposit with status ${status}`);
		}
	}
};
/**
 * role.linkman.js - Link manager
 *
 * max size: LINK_CAPACITY / CARRY_CAPACITY
 * example: {role: 'electrician', lid: '57ad30b099a2ec8577b18b1c'}
 */
'use strict';

const BALANCE_FREQUENCY = 3;
const HIGH_PCT = 0.75;
const LOW_PCT = 0.50;

export default {
	priority: function () {
		// (Optional)
	},
	body: function () {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function () {

	},
	/* eslint-disable consistent-return */
	run: function () {
		// About to die, bail cargo
		if (this.ticksToLive === 1)
			this.transfer(this.room.storage, RESOURCE_ENERGY);
		if (this.ticksToLive % BALANCE_FREQUENCY !== 0)
			return this.say('HOLD');

		const { lid } = this.memory;
		const link = Game.getObjectById(lid);
		const { room } = this;
		const energyNetPct = room.energyInNetwork / room.energyCapacityInNetwork;
		const container = room.storage || room.terminal;

		this.say(_.round(energyNetPct, 2), true);

		// Too high and the network will stay full (we kind of already have this issue normally)
		// Too low, and upgraders starve (as well as probably other stuff)
		if (energyNetPct > HIGH_PCT && link.energy >= CARRY_CAPACITY) {
			// pull energy out of link, put in storage (or terminal)
			if (this.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
				this.moveTo(link, { ignoreRoads: true });
			this.transferOrMove(container, RESOURCE_ENERGY);
		} else if (energyNetPct < LOW_PCT) {
			// pull from storage and put in link
			this.transferOrMove(link, RESOURCE_ENERGY);
			if (this.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
				this.moveTo(container, { ignoreRoads: true });
		} else {
			this.defer(3);
		}
	}
};


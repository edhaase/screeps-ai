/**
 * role.filler.js
 * 
 * example: {role: 'filler', src: '57c73fa7f1334a26787ba171', dest: '57cfad464d6dda234de240ae', res: RESOURCE_ENERGY, amt: 500000}
 * example: {role: 'filler', src: '57f3f810904e9c5270ba754a', dest: '581e2ff080328b1e26e1ae3c', res: RESOURCE_POWER}
 */
'use strict';

module.exports = {
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
		let { src, dest, res = RESOURCE_ENERGY, amt = Infinity } = this.memory;

		src = Game.getObjectById(src);
		dest = Game.getObjectById(dest);

		if (amt <= 0)
			return this.setRole('recycle');

		if (this.ticksToLive <= 3)
			return this.transfer(src, res);

		if (this.carryTotal === 0) {
			// let limit = (amt === Infinity) ? amt : undefined;
			const wamt = (amt !== Infinity) ? Math.min(amt, this.carryCapacity) : undefined;
			const status = this.withdraw(src, res, wamt);
			if (status === ERR_NOT_IN_RANGE)
				this.moveTo(src);
		} else {
			/* eslint-disable indent */
			switch (this.transfer(dest, res, this.carry[res])) {
				case ERR_FULL:
					this.defer(3);
					break;
				case ERR_NOT_IN_RANGE:
					this.moveTo(dest);
					break;
				case OK:
					amt -= this.carry[res];
					break;
			}
		}

		this.memory.amt = (amt !== Infinity) ? amt : undefined;
	}
};

/*
 * role.TANK
 *  doesn't attack, just heals 
 */
'use strict';

export default {
	boosts: [],
	priority: function () {
		// (Optional)
	},
	body: function() {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	/* eslint-disable consistent-return */
	run: function () {
		var {site} = this.memory;
		if (!site) return;

		var flag = Game.flags[site];

		this.moveTo(flag, {range: 0});
		this.heal(this);
	}
};
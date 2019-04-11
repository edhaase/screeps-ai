/*
 * role.TANK
 *  doesn't attack, just heals 
 */
'use strict';

// Game.spawns.Spawn1.submit({body: Util.RLD([5,MOVE,5,HEAL]), memory:{role:'tank',site:'Tank'} })
module.exports = {
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
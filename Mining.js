/**
 * Mining.js
 *
 * Handles the basics of mining operations
 * 
 * @TODO: Game.getObjectById doesn't work for remote objects, has to visible, so we need to store room positions instead of source ids.
 * @TODO: Allow colored flag for remote mining outputs, rather than a command based or manual memory edit.
 * @TODO: Prioritize closest mining sites, but account for multiple spawns.
 * @TODO: Mining sites need to have a threat level, to avoid the source keeper
 * @TODO: Account for ticks to regeneration (workers don't need to be waiting if there is something else they can do).
 * @TODO: Divide available energy across required miners/sites. Bigger creeps are nice, but keep the economy from collapsing.
 * Memory at Memory.mining
 *
 * Notes:
 *   200 ticks at 5 work to fill container (10 energy/tick)
 *   300 ticks at 5 work to mine source (10 energy/tick)
 */
"use strict";


module.exports = {	
	disable: function () {
		Memory.mining.enabled = false;
	},

	enableRemotes: function () {
		_.set(Memory, 'mining.remotes', true);
	},

	isRemoteEnabled: function () {
		return _.get(Memory, 'mining.remotes', false);
	},	
};

/**
 * role.noop.js - Basic do-nothing role template.
 */
// Game.spawns.Spawn1.submit({body: [MOVE], memory: {role: 'noop'}, priority: 100})
// Game.spawns.Spawn1.submit({body: [MOVE], memory: {role: 'noop',stack:[['runFleeRoom','W7N2']]}, priority: 100})
'use strict';

module.exports = {
	boosts: [],	// Default boosts
	priority: function () {
		// (Optional) Used for census
	},
	body: function() {
		// (Optional) Used if no body supplied
		// Expects conditions..
	},
	init: function() {
		// Called on successful create
	},
	run: function () {
		// does nothing
	}
};
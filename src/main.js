/** main.js */
'use strict';

/* global DEFER_REQUIRE, ENV */

require('os.core.macros');				// Required because we want to be lazy
require('os.core.constants');			// Required for RUNTIME_ID
global.Log = require('os.core.log');

global.Arr = require('Arr');
global.Util = require('Util');
global.CostMatrix = require('CostMatrix');
global.Event = require('Event');
global.Group = require('Group');
global.Time = require('Time');
global.Player = require('Player');
global.Filter = require('Filter');
global.Route = require('Route');
global.Market = require('Market');
global.Intel = require('Intel');

// Deffered modules though we can load when we have cpu for it
DEFER_REQUIRE('global');
DEFER_REQUIRE('os.core.errors');	// Required here to get the stack trace size increase
DEFER_REQUIRE('os.core.ins.inspector');
DEFER_REQUIRE('os.core.commands.default');
DEFER_REQUIRE('os.ext.spawn');
DEFER_REQUIRE('ext.cache');
DEFER_REQUIRE('ext.constructionsite');
DEFER_REQUIRE('ext.roomobject');
DEFER_REQUIRE('ext.livingentity');
DEFER_REQUIRE('ext.roomposition');
DEFER_REQUIRE('ext.flag');
DEFER_REQUIRE('ext.room');
DEFER_REQUIRE('ext.creep');
DEFER_REQUIRE('ext.creep.actor');
DEFER_REQUIRE('ext.creep.actor.rts');
DEFER_REQUIRE('ext.source');
DEFER_REQUIRE('ext.roomvisual');
DEFER_REQUIRE('ext.structure');
DEFER_REQUIRE('ext.structure.spawn');
DEFER_REQUIRE('ext.structure.tower');
DEFER_REQUIRE('ext.structure.storage');
DEFER_REQUIRE('ext.structure.link');
DEFER_REQUIRE('ext.structure.observer');
DEFER_REQUIRE('ext.structure.container');
DEFER_REQUIRE('ext.structure.controller');
DEFER_REQUIRE('ext.structure.terminal');
DEFER_REQUIRE('ext.structure.lab');
DEFER_REQUIRE('ext.structure.nuker');
DEFER_REQUIRE('ext.structure.extractor');
DEFER_REQUIRE('ext.structure.rampart');
DEFER_REQUIRE('ext.structure.powerbank');
DEFER_REQUIRE('ext.structure.powerspawn');
DEFER_REQUIRE('ext.powercreep');
DEFER_REQUIRE('ext.powercreep.pwr');
DEFER_REQUIRE('ext.tombstone');
DEFER_REQUIRE('Group');

// Defer prototype extensions

const Kernel = require('os.core.kernel');
const kernel = new Kernel();
global.kernel = kernel; // Publish to global scope for commands

const coro = kernel.tick();
module.exports.loop = function () {
	coro.next();
};

if (ENV('runtime.enable_memhack', true)) {
	const memhack = require('os.core.memhack').wrap;
	module.exports.loop = memhack(module.exports.loop);
}
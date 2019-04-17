/** Constant.js - os constants */
'use strict';

/* global MAKE_CONSTANT, ENV */
/* eslint-disable no-magic-numbers */

global.SEGMENT_PROC = 0;	// Process table
global.SEGMENT_MARKET = 1;	// Market stats
global.SEGMENT_CRON = 2;	// Cron schedule
global.SEGMENT_STATS = 3;	// Runtime stats
global.SEGMENT_BUILD = 4;	// Build templates

global.THP_SEGMENT_INTEL = 5; // Intel gathering (Span 3 = Segment 15-17)

global.BUCKET_MAX = ENV('BUCKET_MAX', 10000);

// MAKE_CONSTANT(global, 'RUNTIME_ID', Game.time);
global.RUNTIME_ID = Game.time;
global.IS_PTR = !!(Game.shard && Game.shard.ptr);
global.IS_SIM = !!Game.rooms['sim'];
global.IS_MMO = !!(Game.shard && Game.shard.name && Game.shard.name.startsWith('shard'));

global.INVADER_USERNAME = 'Invader';
global.SOURCE_KEEPER_USERNAME = 'Source Keeper';

MAKE_CONSTANT(global, 'PROCESS_NAMESPACE', 'os.prog.');
MAKE_CONSTANT(global, 'SHARD_TOKEN', (Game.shard && Game.shard.name && Game.shard.name.slice(-1)) || '');
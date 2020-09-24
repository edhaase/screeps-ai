/** Constant.js - os constants */
'use strict';

import { ENV, ENVC } from './macros';

/* global MAKE_CONSTANT, ENV */
/* eslint-disable no-magic-numbers */

global.SEGMENT_PROC = 0;	// Process table
global.SEGMENT_MARKET = 1;	// Market stats
global.SEGMENT_CRON = 2;	// Cron schedule
global.SEGMENT_STATS = 3;	// Runtime stats
global.SEGMENT_BUILD = 4;	// Build templates

global.THP_SEGMENT_INTEL = 5; // Intel gathering (Span 3 = Segment 15-17)

global.BUCKET_MAX = ENV('BUCKET_MAX', 10000);

export const RUNTIME_ID = Game.time;
export const IS_PTR = !!(Game.shard && Game.shard.ptr);
export const IS_SIM = !!Game.rooms['sim'];;
export const IS_MMO = !!(Game.shard && Game.shard.name && Game.shard.name.startsWith('shard'));

export const INVADER_USERNAME = 'Invader';
export const SOURCE_KEEPER_USERNAME = 'Source Keeper';

export const SHARD_TOKEN = (Game.shard && Game.shard.name && Game.shard.name.slice(-1)) || '';

export const DEFAULT_MAP_ICON_OPACITY = 1.0;
export const DEFAULT_MAP_ICON_SIZE = 18;
export const MAP_ICON_SIZE = ENVC('visual.map_icon_size', DEFAULT_MAP_ICON_SIZE, 0, Infinity);
export const MAP_ICON_OPACITY = ENVC('visual.map_icon_opacity', DEFAULT_MAP_ICON_OPACITY, 0, 1.0);
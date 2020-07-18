/** /os/core/uuid.js - unique identifiers */
'use strict';

/* global SHARD_TOKEN */
import { SHARD_TOKEN } from '/os/core/constants';

export function createShardLocalUUID(prefix = '') {
	Game.vpid = ((Game.vpid == null) ? -1 : Game.vpid) + 1;
	return `${prefix}${Game.time.toString(36)}.${SHARD_TOKEN}${Game.vpid.toString(36)}`.toUpperCase();
};

/* @todo unicode ids */
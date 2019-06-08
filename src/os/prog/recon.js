/** os.prog.recon.js - acquires room visibility */
'use strict';

/* global ENVC */

const Process = require('os.core.process');
const PQ = require('os.ds.pq');
const ITO = require('os.core.ito');

const ASSET_UPDPATE_FREQ = ENVC('recon.asset_update', 15, 1);

/**
 * const rooms = Promise.all(['W7N1', 'W8N2']);
 */
class Recon extends Process {
	constructor(opts) {
		super(opts);
		this.title = 'Services visibility requests';

		this.observers = [];
		this.scouts = [];

		this.vision_callbacks = {};
		this.vision_requests = [];
	}

	*run() {
		this.startThread(this.assetTracking, undefined, undefined, `Asset tracking`);
		this.startThread(this.updater, undefined, undefined, `Visibility updates`);
		while (!(yield true)) {
			if (_.isEmpty(this.vision_callbacks)) {
				yield;
				continue;
			}

			const roomName = this.vision_requests.shift();
			const callbacks = this.vision_callbacks[roomName];
			delete this.vision_callbacks[roomName];

			const fn = (c) => c.memory.roomName
			const asset = this.findAssetForRoom(roomName, fn);
			asset.memory.roomName = roomName;
			// const thread = this.startThread(this.recon, [roomName, asset, callbacks], undefined, `Recon worker`);

		}
	}

	*recon(roomName, asset, callbacks) {
		
	}

	*updater() {
		while (!(yield true)) {
			if (_.isEmpty(this.vision_callbacks)) {
				yield;
				continue;
			}
			const room = _.find(Game.rooms, (v, k) => this.vision_callbacks[k]);
			if (!room)
				continue;
			try {
				for (const [res] of this.vision_callbacks[room.name]) {
					res(room);
				}
			} catch (err) {
				for (const [, rej] of this.vision_callbacks[room.name]) {
					rej(err);
				}
			} finally {
				delete this.vision_callbacks[room.name];
			}
		}
	}

	*assetTracking() {
		while (true) {
			const observers = _.filter(Game.structures, 'structureType', STRUCTURE_OBSERVER);
			const scouts = _.filter(Game.creeps, 'memory.role', 'scout');

			this.observers = _.map(observers, o => ITO.make(o.id));
			this.scouts = _.map(scouts, o => ITO.make(o.id));

			yield this.sleepThread(ASSET_UPDPATE_FREQ);
		}
	}

	findAssetForRoom(roomName, filter = _.identity) {
		const observer = _.find(this.observers, o => Game.map.getRoomLinearPosition(roomName, o.pos.roomName, false) <= OBSERVER_RANGE && filter(o));
		if (observer)
			return observer;
		const scout = _.find(this.scouts, s => Game.map.getRoomLinearPosition(roomName, s.pos.roomName, false) <= s.ticksToLive * 50 && filter(s));
		return scout;
	}

	request(roomName) {
		if (Game.rooms[roomName])
			return Promise.resolve(Game.rooms[roomName]);
		if (!this.findAssetForRoom(roomName))
			throw new Error(`No assets in range`);
		return new Promise((res, rej) => {
			if (!this.vision_callbacks[roomName]) {
				this.vision_callbacks[roomName] = [];
				this.vision_requests.push(roomName);
			}
			this.vision_callbacks[roomName].push([res, rej]);
		});
	}

}

global.TEST_RECON = function* (r) {
	const scout = _.find(Game.creeps, 'memory.role', 'scout');
	const room = scout.room;
	const start = Game.time;
	while(Game.creeps[scout.name].pos.roomName === room.name)
		yield; // console.log(`scout: ${room.name} ${scout.pos}`);
	const end = Game.time - start;
	console.log(`Scout left ${room.name} in ${end} ticks`);
	const sources = room.find(FIND_SOURCES);
	console.log(`sources: ${ex(sources)}`);
};

module.exports = Recon;
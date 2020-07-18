/** os.prog.intel.js */
'use strict';

/* global ENV, ENVC, IS_MMO, Log, THP_SEGMENT_INTEL */

import ForeignSegment from '/os/network/foreign';
import Process from '/os/core/process';
import Pager from '/os/core/pager/thp';
import { evict } from '/Intel';

import { IS_MMO } from '/os/core/constants';

export const ALLIANCE_UNKNOWN = '?';
export const LOAN_SEGMENT_PORTALS = 97;
export const LOAN_SEGMENT_CLONES = 98;
export const LOAN_SEGMENT_ALLIANCES = 99;

export default class IntelProc extends Process {
	constructor(opts) {
		super(opts);
		this.title = 'Intelligence gathering';
	}

	*run() {
		const [page] = yield* Pager.read([THP_SEGMENT_INTEL]);
		this.intel = _.attempt(JSON.parse, page);
		if (this.intel instanceof Error || !this.intel) {
			this.warn(`Segment corrupt, resetting`);
			this.intel = {};
		}

		if (IS_MMO) {
			const allianceThread = this.startThread(this.fetchAllianceData, null, undefined, `Alliance loader`);
			allianceThread.timeout = Game.time + 5;
			// yield* this.waitForThread(allianceThread); // Needs to be thread so we can take advantage of timeout.
			yield allianceThread;
		} else {
			this.warn(`We're not running on MMO, some functions may be disabled`);
		}

		this.updateKnownPlayers();
		this.startThread(this.writeThread, null, undefined, `Intel write thread`);
		this.startThread(this.eventLogTracking, null, Process.PRIORITY_IDLE, `Event log tracking`);

		while (true) {
			yield this.sleepThread(255);
			evict();
		}
	}

	/** Watch all visible room events for interesting stuff */
	*eventLogTracking() {
		while (true) {
			// const allEvents = _(Game.rooms).map(r => r.events).flatten().value();
			for (const roomName in Game.rooms) {
				const events = Game.rooms[roomName].events;
				for (const entry of events) {
					try {
						const obj = Game.getObjectById(entry.objectId);
						var target = Game.getObjectById(entry.data && entry.data.targetId);
						if (!obj || obj.my)
							continue;
						if (entry.event == EVENT_TRANSFER && target && (target.room.my || target.room.rented)) {
							// It's a transfer event. But we care about stealing.
							// withdraw:  eventLog.push({event: C.EVENT_TRANSFER, objectId: target._id, data: {targetId: object._id, resourceType: intent.resourceType, amount}});
							// transfer:  eventLog.push({event: C.EVENT_TRANSFER, objectId: object._id, data: {targetId: target._id, resourceType: intent.resourceType, amount}});
							if (obj instanceof LivingEntity && target instanceof LivingEntity) {
								// Can't withdraw from creeps, must be a transfer.
							} else if (obj instanceof Structure || obj instanceof Tombstone) {
								// Containers can't withdraw from creeps, must be a 
							}
							// if (target)
						} else if (entry.event === EVENT_ATTACK_CONTROLLER) {
							target = obj.room.controller;
							// Boost score, and do a better job defending that controller..
							// this.modifyDamage(obj.owner.username, entry.data.damage);
							this.info(`${obj.name}/${obj.pos}/${obj.owner.username} attacking controller in ${roomName} on ${Game.time}`);
						} else if (!target) {
							continue;
						} if (!target.my && !target.room.my && !target.room.rented) {
							continue;
						} else if (entry.event === EVENT_HEAL) {
							this.modifyDamage(obj.owner.username, -1 * entry.data.amount);
							this.info(`${obj.name}/${obj.pos}/${obj.owner.username} healing ${target}/${target.pos} on ${Game.time} (amount ${entry.data.amount})`);
						} else if (entry.event === EVENT_ATTACK) {
							if (obj instanceof StructureTower)
								continue;	// Defending players don't boost aggression.
							this.modifyDamage(obj.owner.username, entry.data.damage);
							this.info(`${obj.name}/${obj.pos}/${obj.owner.username} attacking ${target}/${target.pos} on ${Game.time} (amount ${entry.data.damage})`);
						}
					} catch (e) {
						this.error(JSON.stringify(entry));
						this.error(`Error processing log entry for room ${roomName}: ${e}`);
						this.error(e.stack);
					}
				}
			}
			yield;
		}
	}

	modifyDamage(player, amount) {
		if (!this.intel.threats)
			this.intel.threats = {};
		if (!this.intel.threats[player])
			this.intel.threats[player] = {};
		this.intel.threats[player].damage = (this.intel.threats[player].damage || 0) + (amount || 0);
	}

	*writeThread() {
		while (true) {
			yield this.sleepThread(15);
			const str = JSON.stringify(this.intel);
			//  const compress = LZW.encode(str);
			// this.info(`Writing intel segment compressed, ${compress.length} / ${str.length} bytes`);
			yield Pager.write(THP_SEGMENT_INTEL, str);
		}
	}

	// @todo need to know if we get shot?

	/** Coro or thread for testing a room's defenses for weaknesses */
	*probe(room) {
		yield* this.probeParts(room);
	}

	/** Test different creep bodies for "smart" towers */
	*probeParts(room) {

	}

	updateKnownPlayers() {
		if (!this.intel || !this.intel.alliances)
			return;
		if (this.intel.players == null)
			this.intel.players = {};
		for (const [allianceName, alliance] of Object.entries(this.intel.alliances)) {
			for (const name of alliance)
				this.intel.players[name] = allianceName;
		}
	}

	*fetchAllianceData() {
		// LeagueOfAutomatedNations
		try {
			const [alliancesPage, botsPage] = yield ForeignSegment.fetchMultiAsync([['LeagueOfAutomatedNations', 99, 1, false], ['LeagueOfAutomatedNations', 98, 0.75, false]]);

			const alliances = _.attempt(JSON.parse, alliancesPage);
			const bots = _.attempt(JSON.parse, botsPage);
			if (alliances instanceof Error) {
				this.warn(`Unable to load alliances data`);
				this.warn(`${alliancesPage}`);
				return;
			} else {
				this.intel.alliances = alliances;	// Override local copy if we have an update
			}
			if (bots instanceof Error)
				this.warn(`Unable to load bots data`);
			else
				this.intel.bots = _.attempt(JSON.parse, bots);
		} catch (e) {
			this.error(`Uncaught error loading alliance data: ${e}`);
		}
	}

}
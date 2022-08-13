/**
 * Handles all the complex logic of expanding into another room or
 * across shards.
 * 
 * @todo consider taking rooms by force
 */
import { ENV } from '/os/core/macros';
import Process from '/os/core/process';
import * as Intel from '/Intel';
import RouteCache from '/cache/RouteCache';
import { IS_SAME_ROOM_TYPE } from '/Intel';
import { Log } from '/os/core/Log';

import claimer from '/role/economy/claimer';
const MINIMUM_CLAIMER_COST = UNIT_COST(claimer.minBody);

export function we_can_expand() {
	if (_.sum(Game.rooms, "my") >= Game.gcl.level)
		return false;
	const spawns = _.reject(Game.spawns, r => r.isDefunct() || r.room.energyCapacityAvailable < MINIMUM_CLAIMER_COST);
	if (!spawns || !spawns.length)
		return this.error(`No available spawn for expansion on tick ${Game.time}`);
	return true;
}

export default class ExpansionProc extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.title = 'Empire Expansion';
	}

	*run() {
		if (ENV('empire.auto_expand', true) === false)
			return this.warn(`Auto expansion disabled, shutting down`); // Nothing to do, shut back down
		if (_.sum(Game.rooms, "my") >= Game.gcl.level)
			return this.warn(`Already at room limit, shutting down`);
		/* while (true) {
			yield;
		} */
		yield* this.expand();
	}

	/** Actually expands to a new room (Kept separte for manual intervention) */
	*expand() {
		// Pick a room!
		// Verify it isn't owned or reserved. Continue picking.
		// Launch claimer!
		// Or build colonizer to target lock a room. (Except which room spawns him?)		
		const spawns = _.reject(Game.spawns, r => r.isDefunct() || r.room.energyCapacityAvailable < MINIMUM_CLAIMER_COST);
		if (!spawns || !spawns.length)
			return this.error(`No available spawn for expansion on tick ${Game.time}`);

		// @todo check if safe to send a claimer
		const candidates = this.getAllCandidateRoomsByScore().value();
		if (!candidates || !candidates.length)
			return this.error(`No expansion candidates`, 'Empire');
		this.warn(`Candidate rooms: ${candidates}`, 'Empire');
		const [first] = candidates;
		const spawn = _.min(spawns, s => Game.map.findRoute(s.pos.roomName, first).length);
		Log.notify(`Expansion in progress! (Origin: ${spawn.pos.roomName})`);
		return yield spawn.submit({ body: [MOVE, CLAIM], memory: { role: 'pioneer', rooms: candidates }, priority: PRIORITY_MED });
	}

	static cpuAllowsExpansion() {
		// return (Memory.stats["cpu1000"] < Game.cpu.limit - 10);
		const estCpuPerRoom = Memory.stats["cpu1000"] / this.ownedRoomCount();
		Log.debug(`Empire estimated ${estCpuPerRoom} cpu used per room`, 'Empire');
		return (Memory.stats["cpu1000"] + estCpuPerRoom) < Game.cpu.limit - 10;
	}

	// @todo Fuzz factor is still problematic.
	getAllCandidateRoomsByScore(range = ENV('empire.expansion_default_range', 5)) {
		return this
			.getAllCandidateRooms(range)
			// .map(r => ({name: r, score: Intel.scoreRoomForExpansion(r) * (0.1+Math.random() * 0.1)}))
			// .sortByOrder(r => r.score, ['desc'])
			.sortByOrder(r => Intel.scoreRoomForExpansion(r) * (0.1 + Math.random() * 0.1), ['desc'])
		// .sortByOrder(r => Intel.scoreRoomForExpansion(r), ['desc'])
	}

	getAllCandidateRooms(range = 3) {
		const start = _.map(this.ownedRooms(), 'name');
		const seen = _.zipObject(start, Array(start.length).fill(0));
		const q = start;
		const candidates = [];
		for (const roomName of q) {
			const dist = seen[roomName] || 0;
			// console.log(`${roomName} ${dist}`);
			if (dist >= range)
				continue;
			const exits = _.values(Game.map.describeExits(roomName));
			for (const exit of exits) {
				if (!IS_SAME_ROOM_TYPE(roomName, exit))
					continue;
				if (seen[exit] !== undefined && dist + 1 >= seen[exit])
					continue;
				seen[exit] = dist + 1;
				const score = _.sortedIndex(q, exit, i => seen[i]);
				q.splice(score, 0, exit);
				// console.log(`exit score: ${score}`);
			}
			if (Room.getType(roomName) !== 'Room')
				continue;
			if ((Game.rooms[roomName] && Game.rooms[roomName].my) || dist <= 1)
				continue;
			if (!Intel.isRoomClaimable(roomName))
				continue;

			candidates.push(roomName);
		}

		return _(candidates);
	}

	/**
	 * Find expansion candidates.
	 *
	 * Ex: Empire.getCandidateRooms('W7N3')
	 * W5N3,W8N5,W5N2,W7N5,W9N3,W7N1
	 * W7N4,W8N4,W5N3,W5N2,W9N3,W9N2
	 */
	getCandidateRooms(start, range = 2) {
		const seen = { [start]: 0 };
		const q = [start];
		const candidates = [];
		for (const roomName of q) {
			const dist = seen[roomName];
			if (dist >= range)
				continue;
			const exits = _.values(Game.map.describeExits(roomName));
			for (const exit of exits) {
				if (!IS_SAME_ROOM_TYPE(roomName, exit) || seen[exit] !== undefined)
					continue;
				seen[exit] = dist + 1;
				q.push(exit);
			}
			if (Room.getType(roomName) !== 'Room')
				continue;
			if (Game.rooms[roomName] && Game.rooms[roomName].my)
				continue;
			if (!_.inRange(RouteCache.findRoute(start, roomName).length, 2, 5))
				continue;
			candidates.push(roomName);
		}

		return candidates;
	}


	ownedRooms() {
		return _.filter(Game.rooms, "my");
	}
}
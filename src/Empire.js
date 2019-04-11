/**
 * Empire.js
 *
 * Rules:
 *		Need at least one RCL 3 room to launch claimers (650 energy)
 *
 *
 * @todo - Account for signage when picking rooms.
 * @todo - Sign controllers to warn players that AI wants a room
 * @todo - dnc (do not claim), array of rooms
 */
'use strict';

/* global Log, Market */
/* global PRIORITY_MIN, PRIORITY_LOW, PRIORITY_MED, PRIORITY_HIGH, PRIORITY_MAX */

const Intel = require('Intel');


const GCL_EXPANSION_GOAL = 10;

if (Memory.empire == null) {
	Memory.empire = { autoExpand: true, credits: 0 };
}

class Empire {
	static isAtExpansionGoal() {
		return (Game.gcl.level >= GCL_EXPANSION_GOAL);
	}

	/**
	 * Draw empire visuals
	 */
	static drawVisuals() {
		var visual = new RoomVisual();
		// drawPie(visual, bucket, BUCKET_MAX, 'Bucket', 'red', 1);
		drawPie(visual, Game.cpu.bucket, BUCKET_MAX, 'Bucket', 'red', 0);
		drawPie(visual, Game.gcl.progress, Game.gcl.progressTotal, 'GCL', 'green', 1);
		// Works, but expensive.
		// As constructionSites complete this jumps all over the place
		/* if(!_.isEmpty(Game.constructionSites)) {
			let buildProgress = _.sum(Game.constructionSites, 'progress');
			let buildProgressTotal = _.sum(Game.constructionSites, 'progressTotal');
			drawPie(visual, buildProgress, buildProgressTotal, 'Build', 'green', 1);
		} */
	}



	// @todo Fuzz factor is still problematic.
	static getAllCandidateRoomsByScore(range = 3) {
		return this
			.getAllCandidateRooms(range)
			// .map(r => ({name: r, score: Intel.scoreRoomForExpansion(r) * (0.1+Math.random() * 0.1)}))
			// .sortByOrder(r => r.score, ['desc'])
			.sortByOrder(r => Intel.scoreRoomForExpansion(r) * (0.1 + Math.random() * 0.1), ['desc'])
		// .sortByOrder(r => Intel.scoreRoomForExpansion(r), ['desc'])
	}

	static getAllCandidateRooms(range = 3) {
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
				if (!Game.map.isRoomAvailable(exit))
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
			if (!Intel.isClaimable(roomName))
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
	static getCandidateRooms(start, range = 2) {
		const seen = { [start]: 0 };
		const q = [start];
		const candidates = [];
		for (const roomName of q) {
			const dist = seen[roomName];
			if (dist >= range)
				continue;
			const exits = _.values(Game.map.describeExits(roomName));
			for (const exit of exits) {
				if (!Game.map.isRoomAvailable(exit) || seen[exit] !== undefined)
					continue;
				seen[exit] = dist + 1;
				q.push(exit);
			}
			if (Room.getType(roomName) !== 'Room')
				continue;
			if (Game.rooms[roomName] && Game.rooms[roomName].my)
				continue;
			if (!_.inRange(Route.findRoute(start, roomName).length, 2, 5))
				continue;
			candidates.push(roomName);
		}

		return candidates;
	}

	/**
	 * Target a room to claim!
	 *
	 * @param string roomName - Name of room to attempt to claim
	 */
	static claimRoom(roomName) {
		if (Game.gcl.level <= this.ownedRoomCount())
			return ERR_GCL_NOT_ENOUGH;
		var claimRooms = []; // Get this from memory?
		if (!claimRooms.includes(roomName))
			claimRooms.push(roomName);
		return OK;
	}


	static ownedRooms() {
		return _.filter(Game.rooms, "my");
	}

	/**
	 *
	 */
	static reservedRooms() {

	}

}

module.exports = Empire;
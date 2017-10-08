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
"use strict";

const EMPIRE_EXPANSION_FREQUENCY = 8191; // Power of 2, minus 1
const GCL_MOVING_AVG_DURATION = 1000;

if (Memory.empire == null) {
	Memory.empire = { autoExpand: true };
}

class Empire {
	static tick() {
		Empire.updateGCL();
		// var used = Time.measure( () => this.drawVisuals() );
		// console.log('used: ' + used);

		if (Game.time & EMPIRE_EXPANSION_FREQUENCY)
			return;

		if (Memory.empire && Memory.empire.autoExpand && this.ownedRoomCount() < Game.gcl.level) {
			if (this.cpuAllowsExpansion())
				Empire.expand();
			else
				Log.warn("Unable to expand, nearing cpu limit", "Empire");
		}
	}

	static updateGCL() {
		if (Memory.gclLastTick == null)
			Memory.gclLastTick = Game.gcl.progress;
		var diff = Game.gcl.progress - Memory.gclLastTick;
		Memory.gclAverageTick = Math.cmAvg(diff, Memory.gclAverageTick, GCL_MOVING_AVG_DURATION);
		Memory.gclLastTick = Game.gcl.progress;
	}

	static cpuAllowsExpansion() {
		// return (Memory.stats["cpu1000"] < Game.cpu.limit - 10);
		const estCpuPerRoom = Memory.stats["cpu1000"] / this.ownedRoomCount();
		Log.debug(`Empire estimated ${estCpuPerRoom} cpu used per room`, 'Empire');
		return (Memory.stats["cpu1000"] + estCpuPerRoom) < Game.cpu.limit - 10;
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

	/**
	 * Find a room to take!
	 */
	static expand() {
		const body = [MOVE, CLAIM];
		const cost = UNIT_COST(body);
		const spawns = _.reject(Game.spawns, r => r.isDefunct() || r.room.energyCapacityAvailable < cost);
		const spawn = _.sample(spawns);
		if (!spawn)
			return Log.error("No available spawn for expansion", "Empire");
		Log.notify("Expansion in progress!");

		const candidates = this.getAllCandidateRooms();
		Log.warn(`Candidate rooms: ${candidates}`, "Empire");
		spawn.submit({ body, memory: { role: 'pioneer', rooms: candidates }, priority: 50 });
		// Pick a room!
		// Verify it isn't owned or reserved. Continue picking.
		// Launch claimer!
		// Or build colonizer to target lock a room. (Except which room spawns him?)
	}


	static getAllCandidateRooms() {
		return _(this.ownedRooms())
			.reverse()
			.map(m => this.getCandidateRooms(m.name, 5))
			.flatten()
			.unique()
			.shuffle()
			.value();
	}

	/**
	 * Find expansion candidates.
	 *
	 * Ex: Empire.getCandidateRooms('W7N3')
	 * W5N3,W8N5,W5N2,W7N5,W9N3,W7N1
	 * W7N4,W8N4,W5N3,W5N2,W9N3,W9N2
	 */
	static getCandidateRooms(start, range = 2) {
		/* return _(Game.map.describeExits(start))
			.reject(r => Room.getType(r) != 'Room' || (Game.rooms[r] && Game.rooms[r].my))
			.value(); */

		// Roughly get rooms at distance 2 away?
		var set = new Set([start]);
		set.forEach(function (roomName) {
			var exits = _.values(Game.map.describeExits(roomName));
			var rooms = _.filter(exits, r => Game.map.getRoomLinearDistance(start, r) <= range);
			_.each(rooms, r => set.add(r));
		});
		return _.reject([...set], r => (Game.rooms[r] && Game.rooms[r].my)
			|| Room.getType(r) !== "Room"
			|| !Game.map.isRoomAvailable(r)
			// || Game.map.getRoomLinearDistance(start, r) <= 1
			|| !_.inRange(Game.map.findRoute(start, r).length, 2, 5));

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

	/**
	 * Returns the number of rooms we own.
	 */
	static ownedRoomCount() {
		// return _.sum(Game.structures, s => s.structureType == STRUCTURE_CONTROLLER);
		return _.sum(Game.rooms, "my");
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
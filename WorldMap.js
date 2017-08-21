/**
 * WorldMap.js
 *
 * ES6 Contiguous world map 
 */
"use strict";

class WorldMap {
	/**
	 * Similar to Game.map.findRoute, but allows for
	 * multiple destination rooms.
	 */
	static findRoute(from, to, cb) {
		// var rc = cb || () => 1;
	}

	/** generator function for find */
	static *find(types) {
		for (var name in Game.rooms)
			yield* Game.rooms[name];
	}

	/** 7 cpu at 11 rooms. Use never. */
	static *allThings() {
		for (var name in Game.rooms)
			yield* Game.rooms[name];
	}

	static test() {
		for (let d of this.dropped())
			console.log(d);
	}

	// Victor! ~0.5 cpu
	static terrain2(roomName) {
		var t;
		for (var x = 0; x < 50; x++)
			for (var y = 0; y < 50; y++)
				t = Game.map.getTerrainAt(x, y, roomName) === 'wall';
	}

	static terrain(roomName) {
		for (var i = 0; i < 2500; i++) {
			let x = Math.floor(i / 50);
			let y = i % 50;
			let t = Game.map.getTerrainAt(x, y, roomName) === 'wall';
			// console.log(new RoomPosition(x,y,roomName) + ' => ' + t);
		}
	}

	/** iterate over rooms - about 0.63 cpu to iterate over 12 rooms */
	static *rooms() {
		yield* _.map(Game.rooms);
	}

	/** .45 cpu for a dozen or more dropped resources */
	static *dropped() {
		for (var r of this.rooms())
			yield* r.find(FIND_DROPPED_RESOURCES);
	}

	/** [object WorldMap] */
	get [Symbol.toStringTag]() {
		return 'WorldMap';
	}
}

Room.prototype[Symbol.iterator] = function* () {
	yield* this.find(FIND_DROPPED_RESOURCES);
	yield* this.find(FIND_CREEPS);
	yield* this.find(FIND_SOURCES);
	yield* this.find(FIND_STRUCTURES);
	yield* this.find(FIND_CONSTRUCTION_SITES);
	yield* this.find(FIND_MINERALS);
	yield* this.find(FIND_NUKES);
}

Room.prototype.findEach = function* (arr, filter) {
	yield* arr.map(x => this.find(x));
}

Room.prototype.findEachAll = function (arr, filter) {
	let r = [];
	for (let o of this.findEach(arr, filter))
		r.push(o);
	return r;

}

module.exports = WorldMap;
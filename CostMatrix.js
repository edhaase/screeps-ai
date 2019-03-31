/**
 * CostMatrix.js
 *
 * ES6 class support for cost matricies
 */
'use strict';

/* global Log, Player */
/* eslint-disable no-magic-numbers */

const Intel = require('Intel');
const { LazyMap } = require('DataStructures');
const LRU = require('LRU');
const { VisibilityError } = require('Error');

const COST_MATRIX_EXPIRATION = 5;
const COST_MATRIX_CACHE_SIZE = 150;

const TILE_UNWALKABLE = 255;
// global.CM_COLORS = Util.getColorRange(256);

/**
 * Base class with functional extensions
 */
class CostMatrix extends PathFinder.CostMatrix {
	/** @inherits static deserialize */
	/** @inherits serialize */

	/**
	 * Slightly faster version of set. For optimal performance, eliminate
	 * the if check.
	 */
	set(x, y, value) {
		if (value !== TILE_UNWALKABLE && this.get(x, y) === TILE_UNWALKABLE)
			return;
		this._bits[x * 50 + y] = value;
	}

	/**
	 * Slightly faster version of get.
	 */
	get(x, y) {
		return this._bits[x * 50 + y];
	}

	add(x, y, value) {
		this.set(x, y, Math.clamp(0, this.get(x, y) + value, 255));
	}

	/** @return CostMatrix - new cost matrix of sum */
	static sum(a, b) {
		const c = new CostMatrix();
		var x, y;
		for (x = 0; x <= 49; x++)
			for (y = 0; y <= 49; y++)
				c.set(x, y, Math.clamp(0, a.get(x, y) + b.get(x, y), 255));
		return c;
	}

	/** @return CostMatrix - new cost matrix of diff */
	static diff(a, b) {
		const c = new CostMatrix();
		var x, y;
		for (x = 0; x <= 49; x++)
			for (y = 0; y <= 49; y++)
				c.set(x, y, Math.clamp(0, Math.abs(b.get(x, y) - a.get(x, y)), 255));
		return c;
	}

	fill(value) {
		this.apply((x, y) => this.set(x, y, value));
		return this;
	}

	/** @return CostMatrix - self */
	apply(fn) {
		var x, y;
		for (x = 0; x <= 49; x++)
			for (y = 0; y <= 49; y++)
				fn.call(this, x, y);
		return this;
	}

	applyInRadius(fn, ax, ay, radius) {
		var dx, dy;
		for (dx = -radius; dx <= radius; dx++)
			for (dy = -radius; dy <= radius; dy++)
				fn.call(this, ax + dx, ay + dy);
		return this;
	}

	applyInRoomRadius(fn, pos, radius) {
		const terrain = Game.map.getRoomTerrain(pos.roomName);
		var dx, dy, ax = pos.x, ay = pos.y;
		for (dx = -radius; dx <= radius; dx++)
			for (dy = -radius; dy <= radius; dy++)
				if (!(terrain.get(ax + dx, ay + dy) & TERRAIN_MASK_WALL))
					fn.call(this, ax + dx, ay + dy);
		return this;
	}

	static fromString(str) {
		return this.deserialize(str);
	}

	static fromArrayMatrix(m) {
		var r = new CostMatrix();
		var x, y;
		for (x = 0; x < 50; x++)
			for (y = 0; y < 50; y++)
				r.set(x, y, m[x][y]);
		return r;
	}

	toString() {
		return JSON.stringify(this.serialize());
	}

	toConsole(pad = 2) {
		for (var y = 0; y <= 49; y++) {
			const ln = [];
			for (var x = 0; x <= 49; x++) {
				// let v = _.padLeft(this.get(x,y).toString(16),2,'0').toUpperCase();
				let n = this.get(x, y);
				n = n.toString(16);
				// n = Math.clamp(0, n, 99);
				let v = _.padLeft(n, pad, '0');

				// if(v == '00') v = '##';
				if (v === _.padLeft(0, pad, '0'))
					v = `<font color="gray">${v}</font>`;
				ln.push(v);
			}
			console.log(ln.join(""));
		}
	}

	/**
	 *
	 */
	/* draw(roomName, color = (v) => CM_COLORS[v]) {
		if (!roomName && this.room)
			roomName = this.room.name;
		var visual = new RoomVisual(roomName);
		for (var x = 0; x < 50; x++)
			for (var y = 0; y < 50; y++) {
				var pos = new RoomPosition(x, y, roomName);
				var weight = this.get(x, y);
				if (weight > 0) {
					if (weight >= 255)
						visual.circle(pos, { fill: 'red' });
					else {
						var v = this.get(x, y);
						visual.text(v, x, y, { color: color(v) });
					}
					// visual.circle(pos, {fill: CM_COLORS[this.get(x,y)]});
				}
			}
	} */

	/** [object CostMatrix] */
	get [Symbol.toStringTag]() { return 'CostMatrix'; }
	static get [Symbol.species]() { return PathFinder.CostMatrix; }

	/** */
	clone() {
		const newMatrix = new CostMatrix;
		newMatrix._bits = new Uint8Array(this._bits);
		return newMatrix;
	}

	setFixedObstacles(room, score = TILE_UNWALKABLE) {
		const { isObstacle } = require('Filter');
		room
			.find(FIND_STRUCTURES, { filter: isObstacle })
			.forEach(s => this.set(s.pos.x, s.pos.y, score));
		return this;
	}

	setSKLairs(room) {
		// Disable while SK mining, until we find a better way.
		// @todo shoud this be FIND_HOSTILE_STRUCTURES?
		room
			.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_KEEPER_LAIR })
			.forEach(s => this.applyInRoomRadius((x, y) => this.set(x, y, 20), s.pos, 6));
		return this;
	}

	// Construction sites? ramparts?
	setDynamicObstacles(room, score = TILE_UNWALKABLE) {
		const { isObstacle } = require('Filter');
		room
			.find(FIND_HOSTILE_CONSTRUCTION_SITES, { filter: c => Player.status(c.owner.username) === PLAYER_ALLY })
			.forEach(s => this.set(s.pos.x, s.pos.y, score));
		room
			.find(FIND_MY_CONSTRUCTION_SITES, { filter: c => isObstacle(c) })
			.forEach(s => this.set(s.pos.x, s.pos.y, score));
		return this;
	}

	setRoads(room, score = 1) {
		room
			.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_ROAD })
			.forEach(s => this.set(s.pos.x, s.pos.y, score));
		return this;
	}

	setTerrainWalls(roomName, score = 255) {
		const terrain = Game.map.getRoomTerrain(roomName);
		for (var x = 0; x < 50; x++) {
			for (var y = 0; y < 50; y++) {
				if (!(terrain.get(x, y) & TERRAIN_MASK_WALL))
					continue;
				this.set(x, y, score);
			}
		}
		return this;
	}

	setCreeps(room, score = 0xFF, filter = _.Identity, c = FIND_CREEPS) {
		room
			.find(c, { filter })
			.forEach(s => this.set(s.pos.x, s.pos.y, score));
	}

	setPortals(room, score = 0xFF) {
		if (room.controller)
			return this;
		room
			.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_PORTAL })
			.forEach(s => this.set(s.pos.x, s.pos.y, score));
		return this;
	}

	iif(condition, action) {
		this.apply((x, y) => {
			if (condition(x, y))
				action(x, y);
		});
		return this;
	}

	setBorder(range = 1, score = TILE_UNWALKABLE) {
		this.iif(
			(x, y) => (x <= range || x >= (49 - range) || y <= range || y >= (49 - range)),
			(x, y) => this.set(x, y, score)
		);
		return this;
	}

	setExitTiles(room, score = TILE_UNWALKABLE) {
		room.find(FIND_EXIT).forEach(e => this.set(e.x, e.y, score));
		return this;
	}
}

/**
 * The fixed obstacle matrix stores a position of obstacles in the world
 * that don't change often. Walls, structures, etc.
 */
class FixedObstacleMatrix extends CostMatrix {
	constructor(roomName) {
		super();
		if (!_.isString(roomName))
			throw new TypeError("FixedObstacleMatrix expects roomName string");

		const room = Game.rooms[roomName];
		if (!room)
			return;
		// don't forget enemy non-public ramparts!
		const { isObstacle } = require('Filter');

		this.setRoads(room);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setExitTiles(room, 5);
		this.setPortals(room);
	}
}

/**
 * Logistics matrix roughly combines obstacle matrix with road matrix
 * to find optimal shipping lane.
 */
class LogisticsMatrix extends CostMatrix {
	/**
	 * @param {string} roomName 
	 * @throws Error
	 */
	constructor(roomName) {
		super();

		const room = Game.rooms[roomName];
		if (!room)
			throw new VisibilityError(roomName);

		if (room.controller) // @todo if not a wall..
			this.applyInRoomRadius((x, y) => this.set(x, y, 1), room.controller.pos, 3);
		this.setRoads(room);
		this.setFixedObstacles(room);
		this.setDynamicObstacles(room);
		this.setSKLairs(room);
		this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, () => true, FIND_HOSTILE_POWER_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_CREEPS);
		this.setCreeps(room, TILE_UNWALKABLE, (c) => c.memory.stuck > 3, FIND_MY_POWER_CREEPS);
		this.setExitTiles(room, 5);
		this.setPortals(room, 254);
	}
}

/**
 * Where are we most likely to get horribly murdered?
 */
class TowerThreatMatrix extends CostMatrix {
	constructor(room) {
		if (_.isString(room))
			if (Game.rooms[room])
				room = Game.rooms[room];
		super(room);
		_.each(
			room.find(FIND_STRUCTURES, { filter: t => (t.structureType === STRUCTURE_TOWER) }),
			this.addTower, this);
	}

	addTower(target) {
		// Just trust that this works..
		this.apply((x, y) => this.add(x, y,
			Math.clamp(TOWER_OPTIMAL_RANGE,
				TOWER_FALLOFF_RANGE - target.pos.getRangeTo(x, y),
				TOWER_FALLOFF_RANGE) - TOWER_OPTIMAL_RANGE
		));
	}
}

/** Lazy factory */
class LazyPropertyFactory {
	constructor(fn = () => 3) {
		this.fn = fn;
	}

	get(target, key, proxy) {
		if (target[key] === undefined)
			target[key] = this.fn(key);
		return target[key];
	}

	set(target, key, value, proxy) {
		return target[key] = value;
	}
}

/* eslint-disable class-methods-use-this */
/* const MAX_CACHE_COSTMATRIX_AGE = 5;
class LazyMatrixStore {
	constructor(clazz, maxAge = MAX_CACHE_COSTMATRIX_AGE) {
		this.clazz = clazz;
		this.maxAge = maxAge;
	}

	get(target, key, proxy) {
		Log.debug(`Requesting ${this.clazz.name} cost matrix for ${key}`, 'Matrix');
		var ck = `${this.clazz.name}_${key}`;
		var cm = target.get(ck);
		if(!cm) {
			if (Game.rooms[key]) {
				Log.info(`Creating cost matrix for ${ck} (Tick ${Game.time})`, 'Matrix');
				proxy[key] = new this.clazz(key);
			} else {
				// console.log('Loading obstacle matrix for ' + key);
				// Log.debug(`Loading cost matrix for ${key} from memory`, 'Matrix');
				// let om = _.get(Memory.rooms, key + '.cm.obstacle');
				// target[key] = (om) ? CostMatrix.deserialize(om) : new PathFinder.CostMatrix;
				Log.debug(`Creating empty cost matrix for ${ck}`, 'Matrix');
				proxy[key] = new PathFinder.CostMatrix;
			}
		}
		return target.get(ck).matrix;
		// if (target[key] == null || Game.time - target[key].tick > this.maxAge) {
			// let start = Game.cpu.getUsed();
			
			// Log.debug(`Creating cost matrix for ${key}: ${target[key].serialize()}`);
			// console.log('Matrix used: ' + _.round(Game.cpu.getUsed() - start, 3));
		// }
		// return target[key].matrix;
	}

	set(target, key, value, proxy) {
		// console.log('Saving logistics matrix: ' + key);
		var ck = `${this.clazz.name}_${key}`;
		Log.debug(`Saving cost matrix for ${ck}`, 'Matrix');
		return target.set(ck, { matrix: value, tick: Game.time });
	}
} */
// @todo kill proxies
// @todo handle volatile data
/* eslint-enable class-methods-use-this */
// global.LOGISTICS_MATRIX = new Proxy(CostMatrix.cache, new LazyMatrixStore(LogisticsMatrix));
// global.FIXED_OBSTACLE_MATRIX = new Proxy(CostMatrix.cache, new LazyMatrixStore(FixedObstacleMatrix, 30));

global.LOGISTICS_MATRIX = new LazyMap(
	(roomName) => (Game.rooms[roomName] && new LogisticsMatrix(roomName)) || new CostMatrix,
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

// map.get(roomname) has no idea about whether the item exists or if there will be an error.
// we can't throw an error this way.
global.LOGISTICS_MATRIX = new LazyMap(
	(roomName) => {
		try {
			return (new LogisticsMatrix(roomName));
		} catch (e) {
			// Log.error(e.stack);
		}
		return new CostMatrix;
	},
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

/* global.FIXED_OBSTACLE_MATRIX = new LazyMap(
	(roomName) => (Game.rooms[roomName] && new CostMatrix).setFixedObstacles(Game.rooms[roomName]) || new CostMatrix,
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
); */

global.FIXED_OBSTACLE_MATRIX = new LazyMap(
	(roomName) => {
		try {
			if (Game.rooms[roomName])
				return new FixedObstacleMatrix(roomName);
		} catch (e) {
			Log.error(e.stack);
		}
		return new CostMatrix;
	},
	new LRU({ ttl: COST_MATRIX_EXPIRATION, max: COST_MATRIX_CACHE_SIZE })
);

module.exports = {
	CostMatrix: CostMatrix,			// base class
	FixedObstacleMatrix: FixedObstacleMatrix,
	LogisticsMatrix: LogisticsMatrix,
};
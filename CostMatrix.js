/**
 * CostMatrix.js
 *
 * ES6 class support for cost matricies
 */
"use strict";

// global.CM_COLORS = Util.getColorRange(256);

/**
 *
 */
class CostMatrix extends PathFinder.CostMatrix {
	constructor(room) {
		super();
		if (room != null) {
			if (typeof room == 'string')
				this.room = Game.rooms[room];
			else
				this.room = room;
		}
	}

	/**
	 * Slightly faster version of set. For optimal performance, eliminate
	 * the if check.
	 */
	set(x, y, value) {
		if (value !== 255 && this.get(x, y) === 255)
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
		var x,y;
		for (x = 0; x <= 49; x++)
			for (y = 0; y <= 49; y++)
				c.set(x, y, Math.clamp(0, a.get(x, y) + b.get(x, y), 255));
		return c;
	}

	/** @return CostMatrix - new cost matrix of diff */
	static diff(a, b) {
		const c = new CostMatrix();
		var x,y;
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
		var x,y;
		for (x = 0; x <= 49; x++)
			for (y = 0; y <= 49; y++)
				fn.call(this, x, y);
		return this;
	}

	applyInRadius(fn, ax, ay, radius) {
		var dx,dy;
		for (dx = -radius; dx <= radius; dx++)
			for (dy = -radius; dy <= radius; dy++)
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
	get [Symbol.toStringTag]() {
		return 'CostMatrix';
	}

	static get [Symbol.species]() { return PathFinder.CostMatrix; }
	/* static get [Symbol.species]() { return this; } */

	/** */
	clone() {
		const newMatrix = new CostMatrix;
		newMatrix._bits = new Uint8Array(this._bits);
		return newMatrix;
	}

	/** @inherits static deserialize */
	/** @inherits serialize */

	//
	setFixedObstacles(room) {
		if (!room && this.room)
			room = this.room;
		room
			// .find(FIND_STRUCTURES, {filter: s => _.contains(OBSTACLE_OBJECT_TYPES, s.structureType)} )
			.find(FIND_STRUCTURES, { filter: s => OBSTACLE_OBJECT_TYPES.includes(s.structureType) })
			.forEach(s => this.set(s.pos.x, s.pos.y, 0xFF));
		room
			// .find(FIND_MY_CONSTRUCTION_SITES, {filter: s =>  _.contains(OBSTACLE_OBJECT_TYPES, s.structureType)})
			.find(FIND_MY_CONSTRUCTION_SITES, { filter: s => OBSTACLE_OBJECT_TYPES.includes(s.structureType) })
			.forEach(s => this.set(s.pos.x, s.pos.y, 0xFF));
		return this;
	}


	//
	setRoad(room) {
		if (!room && this.room)
			room = this.room;
		room
			.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_ROAD })
			.forEach(s => this.set(s.pos.x, s.pos.y, 1));
		return this;
	}

	//
	setExitUnwalkable() {
		this.apply((x, y) => this.set(x, y, (x <= 1 || x >= 48 || y <= 1 || y >= 48) ? 255 : 0));
		return this;
	}

	iif(condition, action) {
		this.apply((x, y) => {
			if (condition(x, y))
				action(x, y);
		});
		return this;
	}

	setBorderUnwalkable(range = 1) {
		// this.apply( (x,y) => this.set(x,y,(x <= range || x >= (49-range) || y <= range || y >= (49-range))?255:0) );
		this.iif(
			(x, y) => (x <= range || x >= (49 - range) || y <= range || y >= (49 - range)),
			(x, y) => this.set(x, y, 255)
		);
		return this;
	}
}

/**
 * The fixed obstacle matrix stores a position of obstacles in the world
 * that don't change often. Walls, structures, etc.
 */
class FixedObstacleMatrix extends CostMatrix {
	constructor(roomName) {
		if (!_.isString(roomName))
			throw new TypeError("FixedObstacleMatrix expects roomName string");
		super(roomName);

		const room = Game.rooms[roomName];
		if (!room)
			return;
		// don't forget enemy non-public ramparts!
		room
			.find(FIND_STRUCTURES, { filter: s => OBSTACLE_OBJECT_TYPES.includes(s.structureType) })
			.forEach(s => this.set(s.pos.x, s.pos.y, 0xFF));
		room
			.find(FIND_MY_CONSTRUCTION_SITES, { filter: s => OBSTACLE_OBJECT_TYPES.includes(s.structureType) })
			.forEach(s => this.set(s.pos.x, s.pos.y, 0xFF));

		// Disable while SK mining, until we find a better way.
		room
			.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_KEEPER_LAIR })
			.forEach(s => this.applyInRadius((x, y) => this.set(x, y, 20), s.pos.x, s.pos.y, 6));

	}
}

/**
 * Use with plainCost: 2, swampCost: 10 to prefer roads.
 * plainCost only needs to be higher if we generate fatigue
 * swampCost can be same as plainCost if we can swamp travel
 */
class RoadMatrix extends CostMatrix {
	/**
	 * @param String
	 */
	constructor(roomName) {
		super();
		const room = Game.rooms[roomName];
		if (room)
			room
				.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_ROAD })
				.forEach(s => this.set(s.pos.x, s.pos.y, 1));
	}
}

/**
 * Logistics matrix roughly combines obstacle matrix with road matrix
 * to find optimal shipping lane.
 */
class LogisticsMatrix extends FixedObstacleMatrix {
	constructor(roomName) {
		super(roomName);
		const room = Game.rooms[roomName];
		if (!room)
			return;

		// This needs a patch, remparts on spawns and storage are being incorrectly set to walkable
		_.each(room.structuresByType[STRUCTURE_ROAD], s => this.set(s.pos.x, s.pos.y, 1));
		_.each(room.structuresByType[STRUCTURE_RAMPART], s => this.set(s.pos.x, s.pos.y, (s.my) ? 1 : 255));
		/* room
			.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_ROAD} )
			// .find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_CONTAINER || (s.structureType == STRUCTURE_RAMPART && s.my)} )
			.forEach(s => this.set(s.pos.x, s.pos.y, 1));	*/

		room
			.find(FIND_CONSTRUCTION_SITES, { filter: c => c.structureType === STRUCTURE_ROAD })
			.forEach(c => this.set(c.pos.x, c.pos.y, 1));

		room
			.find(FIND_MY_CREEPS, { filter: c => _.get(c.memory, 'stuck', 0) > 3 })
			.forEach(c => this.set(c.pos.x, c.pos.y, 0xff));
		/* room
			.find(FIND_CREEPS)
			.forEach(c => this.set(c.pos.x, c.pos.y, (_.get(c.memory, 'stuck',0) > 3)?0xff:15 )); */
	}
}

/**
 * Where can't we walk?
 */
class ObstacleMatrix extends FixedObstacleMatrix {
	constructor(roomName) {
		super(roomName);

		const room = Game.rooms[roomName];
		if (room && (room instanceof Room)) {
			// room.find(FIND_HOSTILE_CREEPS).forEach(c => this.set(c.pos.x, c.pos.y, 0xfe));		
			room.find(FIND_CREEPS).forEach(c => this.set(c.pos.x, c.pos.y, 0xff));
		}
	}

	toString() {
		return JSON.stringify(this.serialize());
	}
}



/**
 * Where are we most likely to get horribly murdered?
 */
class TowerThreatMatrix extends CostMatrix {
	constructor(room) {
		/* if(_.isString(room))
			if(Game.rooms[room])
				room = Game.rooms[room];
			else
				throw new Error("Must have room visibility"); */
		if (_.isString(room))
			if (Game.rooms[room])
				room = Game.rooms[room];
			else
				return super();
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

/**
 * Exits are unpathable.
 */
class ArenaMatrix extends CostMatrix {
	constructor() {
		super();
		this.apply((x, y) => this.set(x, y, (x <= 1 || x >= 48 || y <= 1 || y >= 48) ? 255 : 0));
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

class LazyMatrixStore {
	get(target, key, proxy) {
		if (target[key] == null) {
			// console.log('New logistics matrix needed for ' + key);
			// let start = Game.cpu.getUsed();
			if (Game.rooms[key]) {
				// console.log('Creating logstics matrix for ' + key);
				// target[key] = new CostMatrix.LogisticsMatrix(key);
				target[key] = new LogisticsMatrix(key);
			} else {
				// console.log('Loading obstacle matrix for ' + key);
				let om = _.get(Memory.rooms, key + '.cm.obstacle');
				target[key] = (om) ? CostMatrix.deserialize(om) : new PathFinder.CostMatrix;
			}
			// Log.debug(`Creating cost matrix for ${key}: ${target[key].serialize()}`);
			// console.log('Matrix used: ' + _.round(Game.cpu.getUsed() - start, 3));
		}
		return target[key];
	}

	set(target, key, value, proxy) {
		// console.log('Saving logistics matrix: ' + key);
		return target[key] = value;
	}
}

// global.logisticsMatrix = new Proxy({}, new LazyPropertyFactory( rn => (Game.rooms[rn])?new CostMatrix.LogisticsMatrix(rn):null ) );
global._logisticsMatrix = {};
global.logisticsMatrix = new Proxy(_logisticsMatrix, new LazyMatrixStore);

module.exports = {
	CostMatrix: CostMatrix,			// base class
	FixedObstacleMatrix: FixedObstacleMatrix,
	ObstacleMatrix: ObstacleMatrix,	// obstructions	
	RoadMatrix: RoadMatrix,			// account for roads
	LogisticsMatrix: LogisticsMatrix,
	TowerThreatMatrix: TowerThreatMatrix,
	ArenaMatrix: ArenaMatrix,

};
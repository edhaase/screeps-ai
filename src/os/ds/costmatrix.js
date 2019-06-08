/** os.ds.costmatrix.js - Cost matrix extensions */
'use strict';

/* global CLAMP */

const TILE_UNWALKABLE = 255;
global.CM_COLORS = Util.getColorRange(256);

class CostMatrix extends PathFinder.CostMatrix {
	/** @inherits static deserialize */
	/** @inherits serialize */

	/** Slightly faster version of set. */
	set(x, y, value) {
		if (value !== TILE_UNWALKABLE && this.get(x, y) === TILE_UNWALKABLE)
			return;
		this._bits[x * 50 + y] = value;
	}

	/** Slightly faster version of get. */
	get(x, y) {
		return this._bits[x * 50 + y];
	}

	add(x, y, value) {
		this.set(x, y, CLAMP(0, this.get(x, y) + value, TILE_UNWALKABLE));
	}

	/** @return CostMatrix - new cost matrix of sum */
	static sum(a, b) {
		const c = new CostMatrix();
		var x, y;
		for (x = 0; x <= 49; x++)
			for (y = 0; y <= 49; y++)
				c.set(x, y, CLAMP(0, a.get(x, y) + b.get(x, y), TILE_UNWALKABLE));
		return c;
	}

	/** @return CostMatrix - new cost matrix of diff */
	static diff(a, b) {
		const c = new CostMatrix();
		var x, y;
		for (x = 0; x <= 49; x++)
			for (y = 0; y <= 49; y++)
				c.set(x, y, CLAMP(0, Math.abs(b.get(x, y) - a.get(x, y)), TILE_UNWALKABLE));
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

	iif(condition, action) {
		this.apply((x, y) => {
			if (condition(x, y))
				action(x, y);
		});
		return this;
	}

	/** Serialization */
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

	/** */
	clone() {
		const newMatrix = new CostMatrix;
		newMatrix._bits = new Uint8Array(this._bits);
		return newMatrix;
	}

	/** Visualization */
	toConsole(pad = 2) {
		for (var y = 0; y <= 49; y++) {
			const ln = [];
			for (var x = 0; x <= 49; x++) {
				// let v = _.padLeft(this.get(x,y).toString(16),2,'0').toUpperCase();
				let n = this.get(x, y);
				n = n.toString(16);
				// n = CLAMP(0, n, 99);
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
	draw(roomName, color = (v) => CM_COLORS[v]) {
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
	}

	/** [object CostMatrix] */
	get [Symbol.toStringTag]() { return 'CostMatrix'; }
	static get [Symbol.species]() { return PathFinder.CostMatrix; }
}

module.exports = CostMatrix;
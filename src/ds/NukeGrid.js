/**
 * 
 */
import { unauthorizedHostile } from '/lib/filter';
import { Log, LOG_LEVEL } from '/os/core/Log';

export default class NukeGrid {
	constructor() {
		this.arr = [];
		this.nukes = [];
	}

	static build(fromRoom) {
		if (!fromRoom)
			throw new TypeError(`Expected room`);
		const st = fromRoom.find(FIND_HOSTILE_STRUCTURES, { filter: unauthorizedHostile });
		if (!st || !st.length) {
			return Log.warn(`${fromRoom}: No valid targets in room`, 'Nuker');
		}
		const g = new this;
		for (const s of st) {
			if (s.structureType === STRUCTURE_RAMPART)
				g.sub(s.hits);
			// g.add(s.hits);
			g.applyInRadius((dx, dy) => g.add(dx, dy, s.hits),
				s.pos.x, s.pos.y, NUKE_RADIUS
			);
		}
		room.find(FIND_NUKES).forEach(n => g.applyInRadius((dx, dy) => g.sub(dx, dy, NUKE_DAMAGE[2]), n.pos.x, n.pos.y, NUKE_RADIUS));
		g.target = g.getBestTarget();
		return g;
	}

	get(x, y) {
		if (this.arr[y] && this.arr[y][x] !== undefined)
			return this.arr[y][x];
		return 0;
	}

	set(x, y, v) {
		if (!this.arr[y])
			this.arr[y] = [];
		this.arr[y][x] = v;
		return v;
	}

	add(x, y, v) {
		this.set(x, y, (this.get(x, y) || 0) + v);
	}

	sub(x, y, v) {
		this.set(x, y, (this.get(x, y) || 0) - v);
	}

	applyInRadius(fn, ax, ay, radius) {
		var dx, dy;
		for (dx = -radius; dx <= radius; dx++)
			for (dy = -radius; dy <= radius; dy++)
				fn.call(this, ax + dx, ay + dy);
		return this;
	}

	getBestTarget() {
		var pos, score = -Infinity, i;
		for (var x = 0; x < 50; x++) {
			for (var y = 0; y < 50; y++) {
				i = this.get(x, y) || 0;
				if (i <= score)
					continue;
				score = i;
				pos = [x, y, score];
			}
		}
		return pos;
	}

	toString() { return "[Grid]"; }
}
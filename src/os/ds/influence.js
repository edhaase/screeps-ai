/** os.ds.influence.js - Influence maps! */
'use strict';

const DEFAULT_MAX_INFLUENCE_DISTANCE = 7;

/**
 * Positive and negative influence?
 * Use two maps for accuracy?
 * 
 * The update is nice, but may need to rebuild from scratch if the map changes
 * or we miss an update.
 * 
 * http://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf
 */
class InfluenceMap {
	constructor() {
		this.pending = {};
		this.data = {};
		this.influences = {};
		this.max_dist = DEFAULT_MAX_INFLUENCE_DISTANCE;
		// @todo If we're blocking propagation we should probably consult the ally list.
		this.blocks_propagation = (r) => Intel.isHostileRoom(r, false);
	}

	toString() {
		return `[InfluenceMap]`;
	}

	clone() {
		const copy = _.cloneDeep(this);
		return Object.setPrototypeOf(copy, this);
	}

	/**
	 * Normalized map is good for combining
	 */
	normalize() {
		const copy = this.clone();
		const max = _.max(copy.data);
		const min = _.min(copy.data);
		for (const key in copy.data) {
			if (copy.data[key] > 0)
				copy.data[key] = (copy.data[key] / max);
			else
				copy.data[key] = -(copy.data[key] / min);
		}
		return copy;
	}

	set(roomName, score) {
		if (!_.isEmpty(this.influences) && !_.any(this.influences, (v, k) => Game.map.getRoomLinearDistance(roomName, k, false) <= this.max_dist))
			return this; // Only add stuff we're going to care about.
		if (!this.influences[roomName])
			this.influences[roomName] = 0.0;
		const delta = score - this.influences[roomName];
		this.influences[roomName] = score;
		this.pending[roomName] = delta;
		return this;
	}

	add(roomName, score) {
		if (!_.isEmpty(this.influences) && !_.any(this.influences, (v, k) => Game.map.getRoomLinearDistance(roomName, k, false) <= this.max_dist))
			return this; // Only add stuff we're going to care about.
		if (!this.influences[roomName])
			this.influences[roomName] = 0.0;
		this.influences[roomName] += score;
		this.pending[roomName] = score;
		return this;
	}

	init() {
		this.pending = this.influences;
		return this.propagateAll();
	}

	*propagateAll(render) {
		const entries = Object.entries(this.pending);
		this.pending = {};
		for (const change of entries) {	
			yield* this.propagate(change);
			if(render) {
				yield this.draw(render);
			}
			
		}
		return this;
	}

	*propagate([origin, delta]) {
		const changes = {};
		const seen = {[origin]: 0};
		const q = [origin];
		const owner = _.get(Memory.intel, [origin, 'owner']);
		for (const roomName of q) {
			yield true;
			const dist = seen[roomName] || 0;
			if (dist >= this.max_range)
				continue;
			const inf = delta - (delta * (dist / this.max_dist));
			if (inf === 0)
				continue;
			changes[roomName] = inf;
			// if (this.blocks_propagation(roomName))	// Can't move through a hostile room directly.
			//	continue;
			if (delta > 0 && Memory.intel[roomName] && Memory.intel[roomName].owner && Player.status(Memory.intel[roomName].owner) === PLAYER_HOSTILE)
				continue;	// Don't push through owned rooms
			if (delta < 0 && Memory.intel[roomName] && Memory.intel[roomName].owner && Memory.intel[roomName].owner !== owner)
				continue;	// @todo check alliance map
			const exits = _.values(Game.map.describeExits(roomName));
			for (const exit of exits) {
				if (!IS_SAME_ROOM_TYPE(roomName, exit))
					continue;
				if (seen[exit] !== undefined && dist + 1 >= seen[exit])
					continue;
				seen[exit] = dist + 1;
				q.push(exit);
			}
		}

		for (const [roomName, change] of Object.entries(changes)) {
			yield true;
			if (!this.data[roomName])
				this.data[roomName] = 0.0;
			// this.data[roomName] += change;
			this.data[roomName] += change;
		}
	}

	report() {
		return _.mapValues(this.data, (v, k) => _.round(v, 3));
	}

	bounds() {
		const entries = _.map(this.data, (v, k) => [ROOM_NAME_TO_COORD(k), v]);
		var lx = Infinity, ux = -Infinity, ly = Infinity, uy = -Infinity;
		for (const [[x, y]] of entries) {
			lx = Math.min(lx, x);
			ux = Math.max(ux, x);
			ly = Math.min(ly, y);
			uy = Math.max(uy, y);
		}
		console.log(`bounds ${lx} ${ly} ${ux} ${uy}`);
		return [lx, uy, ux, ly];
	}

	draw(start) {
		//if (!this.normals)
			this.normals = this.normalize();
		const vmap = require('visual.intel-map');
		const renderBehind = (rN, rv, x, y) => rv.text(_.round(this.normals.data[rN], 2), x, y);
		const renderInFront = (rN, rv, x, y) => rv.text(rN, x, y + 0.75);
		const hue = (x) => 120 * ((1 + x) / 2);
		const sat = (x) => Math.abs(((1 + x) / 2) - 50) / 50;
		// 0.5 + (this.normals.data[rN] * -0.5)
		// -1 = 0 = red
		// 1.0 = 120 = green
		const colorFn = (rN) => Util.hsv2rgb(hue(this.normals.data[rN]), sat(this.normals.data[rN]), 1.0);
		vmap(start, this.normals.data, { roomSize: 3, renderBehind, colorFn, renderInFront });
		return false;
	}

	table(width = 35) {
		const [lx, uy, ux, ly] = this.bounds();
		var row, rows = "";
		for (var v = ly; v <= uy; v++) {
			row = "";
			for (var h = lx; h <= ux; h++) {
				const name = COORD_TO_ROOM_NAME(h, v);
				const score = _.round(this.data[name], 0) || '--';
				row += `<td>${score}</td>`;
			}
			rows += `<tr>${row}</td>`;
		}
		return `<table style='width: ${width}vw'>${rows}</table>`;
	}
}

InfluenceMap.fulltest = function (first) {
	global.INF = this.test();
	spark(INF.propagateAll(first));
};

InfluenceMap.test = function (first) {
	const im = new InfluenceMap();
	const owned = _.pick(Memory.intel, (v, k) => v.owner !== undefined);
	for (const mine of _.filter(Game.rooms, 'my'))
		im.set(mine.name, (mine.controller.level / 8) * 100);
	for (const [roomName, intel] of Object.entries(owned)) {
		const { owner } = intel;
		if (!owner || owner === WHOAMI)
			continue;
		if (Player.status(owner) > PLAYER_HOSTILE)
			continue;
		const level = intel.level || 8;;
		im.set(roomName, -100 * (level / 8));
	}
	return im;  // .init();
	/* im.set('W8N3', 50); // Maybe not _actually_ 100, but base on strength of room
	im.set('W7N2', 50);
	im.set('W7N4', 50);
	im.set('W1N1', -100);
	im.set('W9N1', -100);
	im.set('W9N9', -100);
	im.set('W1N9', -100);
	im.init();

	const b = new InfluenceMap();
	b.set('W8N3', 100);
	b.set('W7N4', 100);
	b.set('W1N1', -100);
	b.set('W9N1', -100);
	b.set('W1N9', -100);
	b.init();

	const c = im.clone();
	c.set('W9N9', 0);
	c.set('W7N2', 0);
	c.propagateAll();
	return [im, b, c]; */
};


module.exports = InfluenceMap;
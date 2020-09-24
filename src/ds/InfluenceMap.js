/**
 * @module
 */
import { hsv2rgb } from '/lib/util';
import { IS_SAME_ROOM_TYPE } from '/os/core/macros';
import { NUMBER_FORMATTER, to_precision, to_fixed } from '/lib/util';
import { PLAYER_STATUS } from '/Player';
import * as Intel from '/Intel';
import * as vmap from '/visual/intel-map';
import LazyMap from '/ds/LazyMap';
import Region from '/ds/Region';
import { EXIT_CACHE } from '/cache/ExitCache';

export const DEFAULT_MAX_INFLUENCE_DISTANCE = 7;

/**
 * @classdesc Describes room level influence on the world map
 * 
 * Positive and negative influence?
 * Use two maps for accuracy?
 * 
 * The update is nice, but may need to rebuild from scratch if the map changes
 * or we miss an update.
 * 
 * http://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf
 * 
 * @todo add methods for finding the frontline (area closest to 0, greatest tension)
 */
export default class InfluenceMap {
	constructor() {
		this.pending = {};
		this.data = {};
		this.influences = {};
		this.max_dist = DEFAULT_MAX_INFLUENCE_DISTANCE;
		this.iterations = 0;
		// @todo If we're blocking propagation we should probably consult the ally list.
		this.blocks_propagation = (r) => Intel.isHostileRoom(r, false);
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
			if (copy.data[key] === 0)
				delete copy.data[key];
		}
		return copy;
	}

	/**
	 * 
	 * @param {*} roomName 
	 * @param {*} score 
	 */
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

	/**
	 * 
	 * @param {*} roomName 
	 * @param {*} score 
	 */
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

	*propagateAll() {
		const entries = Object.entries(this.pending);
		this.pending = {};
		this.iterations = 0;
		for (const change of entries) {
			yield* this.propagate(change);
		}
		console.log(`INF Map Propegation took ${this.iterations} iterations`);
		return this;
	}

	*propagate([origin, delta]) {
		const changes = {};
		const seen = { [origin]: 0 };
		const q = [origin];
		const owner = _.get(Memory.intel, [origin, 'owner']);
		for (const roomName of q) {
			if (++this.iterations % 25 === 0)
				yield true;
			const dist = seen[roomName] || 0;
			if (dist >= this.max_range)
				continue;
			const inf = delta - (delta * (dist / this.max_dist));
			if (inf === 0)
				continue;
			if (Math.abs(inf) > (changes[roomName] || 0))
				changes[roomName] = inf;
			if (delta > 0 && Memory.intel[roomName] && Memory.intel[roomName].owner && Player.status(Memory.intel[roomName].owner) <= PLAYER_STATUS.NEUTRAL)
				continue;	// Don't push through owned rooms
			if (delta < 0 && Memory.intel[roomName] && Memory.intel[roomName].owner && Memory.intel[roomName].owner !== owner)
				continue;	// @todo check alliance map
			const exits = EXIT_CACHE.get(roomName);
			for (const exit of exits) {
				if (!IS_SAME_ROOM_TYPE(roomName, exit))
					continue;
				if (seen[exit] !== undefined && dist + 1 >= seen[exit])
					continue;
				seen[exit] = dist + 1;
				q.push(exit);
			}
		}
		yield true;
		for (const [roomName, change] of Object.entries(changes)) {	
			if (!this.data[roomName])
				this.data[roomName] = 0.0;
			// this.data[roomName] += change;
			this.data[roomName] += change;
		}
	}

	*blur(drawEachTick = false) {
		/**
		 * Starting from each influnencer, spread the influence to nearby rooms and keep the sum
		 */
		const seen = {};
		const edges = [];
		const influences = {};
		const q = [];
		// Set up the initial influence sources and the initial edges
		for (const [roomName, influence] of Object.entries(this.pending)) {
			this.seen[roomName] = true;
			influences[roomName] = influence;
			q.push(roomName);
		}
	}

	bounds() {
		const entries = _.map(this.data, (v, k) => [Region.roomNameToCoord(k), v]);
		var lx = Infinity, ux = -Infinity, ly = Infinity, uy = -Infinity;
		for (const [[x, y]] of entries) {
			lx = Math.min(lx, x);
			ux = Math.max(ux, x);
			ly = Math.min(ly, y);
			uy = Math.max(uy, y);
		}
		return [lx, uy, ux, ly];
	}

	draw() {
		if (!this.normals)
			this.normals = this.normalize();
		const hue = (x) => 120 * ((1 + x) / 2);
		const sat = (x) => Math.abs(((1 + x) / 2) - 50) / 50;
		const colorFn = (rN) => hsv2rgb(hue(this.normals.data[rN]), sat(this.normals.data[rN]), 1.0);
		if (Game.map.visual) {
			for (const roomName in this.normals.data) {
				const room = this.normals.data[roomName];
				Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, {
					fill: colorFn(roomName),
					opacity: 0.75
				});
				Game.map.visual.text(to_fixed(room), new RoomPosition(25, 45, roomName), { opacity: 1.0, fontSize: 12 });
			}
		}
		return false;
	}

	toString() {
		return `[InfluenceMap]`;
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
		if (Player.status(owner) > PLAYER_STATUS.NEUTRAL)
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
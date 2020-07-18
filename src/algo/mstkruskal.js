const DEFAULT_SWAMP_WEIGHT = 10;
const DEFAULT_PLAINS_WEIGHT = 2;

import UnionFind from '/algo/unionfind';
import * as PriorityQueue from '/ds/PriorityQueue';

export default class KruskalMST {
	// let k = new KruskalMST('W8N6'); k.addDefaultNodes().addDefaultEdges(); k.createMST()
	// let k = new KruskalMST('W9N4'); k.addDefaultNodes().addDefaultEdges(); k.createMST(); k.draw(); console.log(k.edges.length)
	// let k = new KruskalMST('W8N3'); k.addDefaultNodes().addDefaultEdges(); k.createMST(); k.draw(); console.log(k.edges.length)
	constructor(roomName, opts = {}) {
		this.roomName = roomName;
		this.opts = opts;
		this.nodes = [];
		this.edgeQueue = new PriorityQueue([], ([node, edgeNode, w]) => w, _.sortedIndex);
		this.terrain = Game.map.getRoomTerrain(roomName);
		this.edges = []; // final edge storage
		if (!this.opts.cm)
			this.opts.cm = new PathFinder.CostMatrix;
	}

	createMST() {
		this.uf = new UnionFind(this.nodes);
		if (!this.nodes.length)
			return this;
		while (this.edgeQueue.length) {
			const [node, edgeNode, weight] = this.edgeQueue.pop(); // todo: check score fn
			if (this.uf.connected(node, edgeNode))
				continue;
			this.uf.union(node, edgeNode);
			this.edges.push([node, edgeNode, weight]);
		}
		this.counts = _.countBy(this.uf.parent);
		this.children = _.countBy(this.edges, e => e[1]);
		return this.edges;
	}

	draw() {
		const visual = new RoomVisual(this.roomName);
		for (const edge of this.edges) {
			const [node, edgeNode, weight] = edge;
			const pos1 = new RoomPosition(node % 50, Math.floor(node / 50), this.roomName);
			const pos2 = new RoomPosition(edgeNode % 50, Math.floor(edgeNode / 50), this.roomName);
			// const hasChild = this.children[node] > 1;			
			// const color = (hasChild == false) ? 'green' : (weight === DEFAULT_SWAMP_WEIGHT) ? 'red' : (weight === DEFAULT_PLAINS_WEIGHT) ? 'yellow' : 'white';
			const color = (weight === DEFAULT_SWAMP_WEIGHT) ? 'red' : (weight === DEFAULT_PLAINS_WEIGHT) ? 'yellow' : 'white';
			// visual.poly([pos1, pos2], { stroke: color });
			visual.poly([pos2, pos1], { stroke: color });
		}
	}

	addStructures() {
		const room = Game.rooms[this.roomName];
		room.find(FIND_MY_STRUCTURES).forEach(s => {
			this.nodes.push(s.pos.y * 50 + s.pos.x);
			this.opts.cm.set(s.pos.x, s.pos.y, 255);
		});
		return this;
	}

	addDefaultNodes() {
		var x, y, weight;
		for (y = 1; y < 48; y++) {
			for (x = 1; x < 48; x++) {
				weight = this.opts.cm.get(x, y);
				if (weight === 255)
					continue;
				if (weight === 0 && (this.terrain.get(x, y) & TERRAIN_MASK_WALL))
					continue;
				this.nodes.push(y * 50 + x);
			}
		}
		return this;
	}

	addNode(pos) {
		this.nodes.push(pos.y * 50 + pos.x);
		return this;
	}

	addDefaultEdges() {
		for (const node of this.nodes) {
			const [y, x] = [Math.floor(node / 50), node % 50];
			const pos = new RoomPosition(x, y, this.roomName);
			// const adj = _.shuffle(pos.getAdjacentPoints());
			const adj = pos.getAdjacentPoints();
			for (const a of adj) {
				const weight = this.getWeight(a.x, a.y);
				if (weight === 255)
					continue;
				// const mod = _.random(1,3);
				// const mod = a.getRangeTo(center);
				// this.edgeQueue.push([node, (a.y * 50 + a.x), weight+mod]);
				this.edgeQueue.push([node, (a.y * 50 + a.x), weight]);
			}
		}
		return this;
	}

	getWeight(x, y) {
		const weight = this.opts.cm.get(x, y);
		if (weight)
			return weight;
		const mask = this.terrain.get(x, y);
		if (mask & TERRAIN_MASK_WALL)
			return 255;
		if (mask & TERRAIN_MASK_SWAMP)
			return this.opts.swampWeight || DEFAULT_SWAMP_WEIGHT;
		return this.opts.plainsWeight || DEFAULT_PLAINS_WEIGHT;
	}

	addEdge(a, b) {
		this.edgeQueue.push({ x, y });
	}
}
global.KruskalMST = KruskalMST;

function unionTest() {
	let uf = new UnionFind(["A", "B", "C", "D", "E"]);
	uf.union("A", "B"); uf.union("A", "C");
	uf.union("C", "D");

	console.log(uf.connected("B", "E"));
	console.log(uf.connected("B", "D"));
}
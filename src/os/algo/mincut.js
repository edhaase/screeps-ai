/**
 * 
 * @author Saurus
 * 
 * Moved constants to top of file
 * Replaced splice(0,1) with shift for performance
 */
'use strict';
/* eslint-disable no-magic-numbers */

const MAX_ROOM_WIDTH = 50;
const MAX_ROOM_HEIGHT = 50;
const INFINI = Infinity;
// const INFINI = Number.MAX_VALUE;

function room_2d_array(room) {
	// 2d- Array mit Raumgröße, gefüllt mit Nullen
	const room_2d = Array(50).fill(0).map(() => Array(50).fill(0));
	// dann per lookAt: an allen Positionen an denen einen Wall wird im 2d Array eine "-1" geschrieben
	const terrain_array = room.lookForAtArea(LOOK_TERRAIN, 0, 0, MAX_ROOM_WIDTH - 1, MAX_ROOM_HEIGHT - 1, true);
	if (terrain_array.length === 0) {
		console.log('get_room_array in room_layout, look-at-for-Area Fehler');
	}
	let i;
	for (i = terrain_array.length - 1; i >= 0; i--) {
		const terrain = terrain_array[i];
		const { x, y } = terrain;
		if (terrain.terrain === 'wall') {
			room_2d[x][y] = -1;
		} else if (x === 0 || y === 0 || x === 49 || y === 49) { // Exit Tiles markieren
			room_2d[x][y] = 3;
		}
	}
	// Nachbarn zu Exit Tiles mit 2 markieren
	let x, y;
	for (y = 1; y < 49; y++) { // Linke Rechte Kante
		if (room_2d[0][y - 1] === 3) room_2d[1][y] = 2;
		if (room_2d[0][y] === 3) room_2d[1][y] = 2;
		if (room_2d[0][y + 1] === 3) room_2d[1][y] = 2;
		if (room_2d[49][y - 1] === 3) room_2d[48][y] = 2;
		if (room_2d[49][y] === 3) room_2d[48][y] = 2;
		if (room_2d[49][y + 1] === 3) room_2d[48][y] = 2;
	}
	for (x = 1; x < 49; x++) { // obere untere Kante
		if (room_2d[x - 1][0] === 3) room_2d[x][1] = 2;
		if (room_2d[x][0] === 3) room_2d[x][1] = 2;
		if (room_2d[x + 1][0] === 3) room_2d[x][1] = 2;
		if (room_2d[x - 1][49] === 3) room_2d[x][48] = 2;
		if (room_2d[x][49] === 3) room_2d[x][48] = 2;
		if (room_2d[x + 1][49] === 3) room_2d[x][48] = 2;
	}
	// Exit Tiles mit -1 markieren (-> keine Kante im Graph)
	for (y = 1; y < 49; y++) { // Linke Rechte Kante
		room_2d[0][y] = -1;
		room_2d[49][y] = -1;
	}
	for (x = 1; x < 49; x++) {
		room_2d[x][0] = -1;
		room_2d[x][49] = -1;
	}
	return room_2d;
}

class Graph {
	constructor(menge_v) {
		this.v = menge_v; // Vertex count
		this.level = Array(menge_v);
		this.edges = Array(menge_v).fill(0).map(() => []); // Array: zu jedem vertex ein Edge Array mit {v,r,c,f} vertex_to,res_edge,capacity,flow
	}

	newEdge(u, v, c) { // Fügt eine neue Kante hinzu
		// Normal forward Edge
		const e = { v: v, r: this.edges[v].length, c: c, f: 0 };
		// reverse Edge for Residal Graph
		const b = { v: u, r: this.edges[u].length, c: 0, f: 0 };
		this.edges[u].push(e);
		this.edges[v].push(b);
	}

	bfs(s, t) { // Breitensuche von S-ource to T-sink die Level setzt und zurückgibt, ob ein Weg von s nach t existiert
		if (t >= this.v) // Falsche Eingabe
			return false;
		// Level zurücksetzen
		this.level.fill(-1);
		this.level[s] = 0;
		// mit Hilfe einer Queue der nächst zu besuchenden Vertices die Level zuordnen
		const q = [];
		let i;
		q.push(s);
		while (q.length) {
			const u = q.shift();
			for (i = 0; i < this.edges[u].length; i++) {
				const edge = this.edges[u][i];
				if (this.level[edge.v] < 0 && edge.f < edge.c) {
					this.level[edge.v] = this.level[u] + 1;
					q.push(edge.v);
				}
			}
		}
		// Schauen ob s->t existiert und zurückgeben
		return this.level[t] >= 0;
	}

	// DFS like: send flow at along path from s->t recursivly while increasing the level of the visited vertices by one
	// u vertex, f flow on path, t =Sink , c Array, c[i] saves the count of edges explored from i
	dfsFlow(u, f, t, c) {
		// Sink , aboard recursion
		if (u === t)
			return f;
		// Visit all edges of the vertex  one after the other
		while (c[u] < this.edges[u].length) {
			const edge = this.edges[u][c[u]];
			if (this.level[edge.v] === this.level[u] + 1 && edge.f < edge.c) { // Edge leads to Vertex with a level one higher, and has flow left
				const flow_till_here = Math.min(f, edge.c - edge.f);
				const flow_to_t = this.dfsFlow(edge.v, flow_till_here, t, c);
				if (flow_to_t > 0) {
					edge.f += flow_to_t; // Add Flow to current edge
					this.edges[edge.v][edge.r].f -= flow_to_t; // subtract from reverse Edge -> Residual Graph neg. Flow to use backward direction of BFS/DFS
					return flow_to_t;
				}
			}
			c[u]++;
		}
		return 0;
	}

	bfsTheCut(s) { // Breitensuche von S-ource to T-sink die Markierungen setzt und vom min-Cut die von-Vertices zurückgibt
		// Level zurücksetzen
		const e_in_cut = [];
		// Level zurücksetzen
		this.level.fill(-1);
		this.level[s] = 1;
		// mit Hilfe einer Queue die erreichbaren Vertices bestimmen
		let i;
		const q = [];
		q.push(s);
		while (q.length) {
			const u = q.shift();
			//console.log('Vertex',u,'************************');
			for (i = 0; i < this.edges[u].length; i++) {
				const edge = this.edges[u][i];
				//console.log(JSON.stringify(edge));
				if (edge.f < edge.c) {
					if (this.level[edge.v] < 1) {
						this.level[edge.v] = 1;
						q.push(edge.v);
					}
				}
				// potentiell sind alle Kanten mit f=c und c>0 im min cut
				// Diese also speichern falls C>0, später überprüfen ob von markierten->unmarkiertem Vertex
				if (edge.f === edge.c && edge.c > 0) {
					edge.u = u;
					e_in_cut.push(edge);
				}
			}
		}
		// Alle Kanten filtern ob von lv=1 -> lv=-1
		const min_cut = [];
		for (i = e_in_cut.length - 1; i >= 0; i--) {
			if (this.level[e_in_cut[i].v] === -1)
				min_cut.push(e_in_cut[i].u);
		}

		//console.log(JSON.stringify(this.edges));
		return min_cut;
	}

	calcMinCut(s, t) {
		if (s === t)
			return -1;
		let flow, returnvalue = 0;
		while (this.bfs(s, t)) {
			// stores how many edges are visited
			const count = Array(this.v + 1).fill(0);
			flow = 0;
			do {
				flow = this.dfsFlow(s, Number.MAX_VALUE, t, count);
				if (flow > 0)
					returnvalue += flow;
			} while (flow);
		}
		return returnvalue;
	}
}

module.exports = {
	// Function to create Source, Sink, Tiles arrays: takes a rectangle-Array for Tiles that are to Protect
	// rects have top-left/bot_right Coordinates x1,y1,x2,y2
	createGraph: function (room, rect) {
		// Erstellt 2d-Array des Raumes, 
		// betretbare Felder (mit Kanten) (plain, swamp) bekommen die Zahl 0, 
		// zuerst die Exit Tile Nachabrfelder eine 2,
		const room_array = room_2d_array(room);
		// Felder innerhalb der Rechtecke sind mit -1 nicht betretbar (keine Kanten), die Ränder als Source die 1
		// Optimierung if: first only edges with own for-loop, than the inner  area
		let j, r, x, y;
		for (j = 0; j < rect.length; j++) {
			r = rect[j];
			for (x = r.x1; x <= r.x2; x++) {
				for (y = r.y1; y <= r.y2; y++) {
					if (x === r.x1 || x === r.x2 || y === r.y1 || y === r.y2) {
						if (room_array[x][y] === 0)
							room_array[x][y] = 1;
					} else
						room_array[x][y] = -1;
				}
			}

		}
		// ********************** Visualisierung
		/* eslint-disable no-constant-condition */
		if (false) {
			const { visual } = room;
			for (x = 0; x < 50; x++) {
				for (y = 0; y < 50; y++) {
					if (room_array[x][y] === -1)
						visual.circle(x, y, { radius: 0.5, fill: '#ba1414', opacity: 0.3 });
					if (room_array[x][y] === 0)
						visual.circle(x, y, { radius: 0.5, fill: '#e8e863', opacity: 0.3 });
					if (room_array[x][y] === 1)
						visual.circle(x, y, { radius: 0.5, fill: '#75e863', opacity: 0.3 });
					if (room_array[x][y] === 2)
						visual.circle(x, y, { radius: 0.5, fill: '#b063e8', opacity: 0.3 });
				}
			}
		}

		// Graph initialisieren und Kanten hinzufügen mit Hilfe des Arrays
		// possible 2*50*50 +2 (st) Vertices (Wall etc unuses later)
		const g = new Graph(2 * 50 * 50 + 2);
		const surr = [[0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1]];
		// per Tile (0 in Array) top + bot with edge of c=1 from top to bott				
		// per exit Tile (2in array) Edge to sink with INInfinity;
		// source is at  pos 2*50*50, sink at 2*50*50+1 as first tile is 0,0 => pos 0
		// top vertices <-> x,y : v=y*50+x   and x= v % 50  y=v/50 (math.floor?)
		// bot vertices <-> top + 2500 
		const source = 2 * 50 * 50;
		const sink = 2 * 50 * 50 + 1;
		let top, bot;
		for (x = 1; x < 49; x++) {
			for (y = 1; y < 49; y++) {
				top = y * 50 + x;
				bot = top + 2500;
				if (room_array[x][y] === 0) { // normal Tile
					g.newEdge(top, bot, 1);
					for (let i = 0; i < 8; i++) {
						const dx = x + surr[i][0];
						const dy = y + surr[i][1];
						if (room_array[dx][dy] === 0 || room_array[dx][dy] === 2)
							g.newEdge(bot, dy * 50 + dx, INFINI);
					}
				} else if (room_array[x][y] === 1) { // protected Tile
					g.newEdge(source, top, INFINI);
					g.newEdge(top, bot, 1);
					for (let i = 0; i < 8; i++) {
						const dx = x + surr[i][0];
						const dy = y + surr[i][1];
						if (room_array[dx][dy] === 0 || room_array[dx][dy] === 2)
							g.newEdge(bot, dy * 50 + dx, INFINI);
					}
				} else if (room_array[x][y] === 2) { // near Exit
					g.newEdge(top, sink, INFINI);
				}
			}
		} // Ende Kontruktion Graph
		return g;
	},

	// Function: calculate min cut tiles from room, rect[]
	getCutTiles: function (room, rect) {
		const graph = this.createGraph(room, rect);
		const source = 2 * 50 * 50; // Position Source / Sink in Room-Graph
		const sink = 2 * 50 * 50 + 1;
		const count = graph.calcMinCut(source, sink);
		console.log('Number of Tiles in Cut:', count);
		const positions = [];
		if (count > 0) {
			const cut_edges = graph.bfsTheCut(source);
			// Get Positions from Edge
			for (let i = cut_edges.length - 1; i >= 0; i--) {
				const u = cut_edges[i];// x= v % 50  y=v/50 (math.floor?)
				const x = u % 50;
				const y = Math.floor(u / 50);
				positions.push({ x: x, y: y });
			}
		}
		// Visualise Result
		if (positions.length > 0) {
			const { visual } = room;
			for (var i = positions.length - 1; i >= 0; i--) {
				visual.circle(positions[i].x, positions[i].y, { radius: 0.5, fill: '#ff7722', opacity: 0.9 });
			}
		}
		return positions;
	},

	// test mincut
	test: function (roomname) {
		const room = Game.rooms[roomname];
		if (!room)
			return 'O noes';
		let cpu = Game.cpu.getUsed();
		// Rectangle Array, the Rectangles will be protected by the returned tiles
		const rect_array = [];
		rect_array.push({ x1: 16, y1: 13, x2: 24, y2: 20 });
		rect_array.push({ x1: 26, y1: 15, x2: 37, y2: 26 });
		// Get Min cut
		const positions = this.getCutTiles(room, rect_array); // Positions is an array where to build walls/ramparts
		console.log('Positions returned', positions.length);
		cpu = Game.cpu.getUsed() - cpu;
		console.log('Needed', cpu, ' cpu time');
		return 'Finished';
	},

};
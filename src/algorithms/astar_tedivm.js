/**
 * screeps Astar
 *
 * @author Robert Hafner (@tedivm)
 *
 * based off of javascript-astar 0.4.1
 * http://github.com/bgrins/javascript-astar
 * Freely distributable under the MIT License.
 *
 * Implements the astar search algorithm in javascript using a Binary Heap or Priority Queue
 * Includes Binary Heap (with modifications) from Marijn Haverbeke. 
 * http://eloquentjavascript.net/appendix2.html
 *
 * Modified for Screeps by Robert Hafner 
 *
 * Changes include:
 *  - Lazy loading gridnodes from Room
 *  - Additional scoring functions
 *  - Optimized BinaryHeap (from pull request)
 *  - Simplified API
 *  - Optimizations from http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html
 */
'use strict';

/**
 * Simple grid storage class
 */
class Grid {
	constructor() {
		this.arr = new Array(2500);
	}

	get(x, y) {
		var i = (y * 50) + x;
		return this.arr[i];
	}

	set(x, y, value) {
		var i = (y * 50) + x;
		return (this.arr[i] = value);
	}
}


/**
 * Astar
 */
var Astar = function () {

};

Astar.display = true;

Astar.colors = {
	'optimal': 'green',
	'tested': 'yellow'
};

/*
  var wall_path = this.room.findCustomPath(pos1, pos2, {
          'diagonal': false,
          'heuristic': 'manhattan',
          'heuristicModifier': 1.01,
          'scoring': {
            filter: function (position) {
              return !(position.x < 2 || position.x > 47 || position.y < 2 || position.y > 47)
            },
            'terrain': {
              'wall': 1,
              'plain': 12,
              'swamp': 12,
            },
            'structures': {
              'default': 0,
              'road': 12,
              'constructedWall': 1
            },
            'creep': false,
            'distancepenalty': 0.01,
            'directionchange': 0,
          }
        })
		*/
Astar.defaults = {
	'diagonal': true,
	'heuristic': 'manhattan',
	'closest': true,
	'weight': false,
	'heuristicModifier': 5,
	'avoid': [],	// array of RoomPositions to avoid	
	'ignore': [],	// array of RoomPositions to ignore	
	'maxops': false,
	'scoring': {
		'filter': false,
		'avoid': false,
		'ignore': false,
		'creep': 10,
		'terrain': {
			[TERRAIN_MASK_SWAMP]: 2,
			0: 2, /* plains */
			[TERRAIN_MASK_WALL]: 0,
		},
		'structures': {
			'default': 0,
			[STRUCTURE_ROAD]: 2,
			[STRUCTURE_WALL]: 0,
			[STRUCTURE_RAMPART]: false,
			'hostile_rampart': 0
		},
		'distancepenalty': 0.000,
		'directionchange': 0.001,
	}
};

/**
 * Perform an A* Search on a graph given a start and end node.
 *
 * @param {Room} room - room object to search in
 * @param {RoomPosition} start - starting RoomPosition
 * @param {RoomPosition} end - ending RoomPosition
 * @param {Object} [options]
 * @param {bool} [options.closest] Specifies whether to return the
           path to the closest node if the target is unreachable.
 * @param {Function} [options.heuristic] Heuristic function (see
 *          Astar.heuristics).
 */
// new Astar().search(Game.rooms['W8N4'], new RoomPosition(11,12,'W8N4'), new RoomPosition(41,28,'W8N4') )
// Time.measure( () => (new Astar().search(Game.rooms['W8N4'], new RoomPosition(28,33,'W8N4'), new RoomPosition(31,29,'W8N4') )) )
// Time.measure( () => (new Astar().search(new RoomPosition(11,5,'W8N4'), new RoomPosition(28,26,'W8N4') )) )
Astar.prototype.search = function (start, end, user_options = {}) {
	var options = _.defaultsDeep(user_options, Astar.defaults);
	if (start.roomName !== end.roomName)
		throw new Error('Start and end positions must be in same room');
	var weight, heuristic, room = Game.rooms[start.roomName];
	var { scoring, heuristicModifier, diagonal, closest, maxops } = options;
	var ops = 0;

	// Set the heuristic function. Defaults to manhattan.
	if (options.heuristic && this.heuristics[options.heuristic]) {
		heuristic = this.heuristics[options.heuristic];
	} else {
		heuristic = this.heuristics.manhattan;
	}

	this.terrain = Game.map.getRoomTerrain(start.roomName); /* Only handles one room right now anyways */

	// Support for passing a custom scoring function
	if (typeof options.weight == 'function') {
		weight = options.weight;
	} else {
		weight = this.scoring;
	}

	// array of RoomPositions to avoid		
	var avoid_list = new Grid();
	_.each(options.avoid, ({ x, y }) => avoid_list.set(x, y, true));
	scoring.avoid_list = avoid_list;

	// ignore RoomPositions?
	var ignore_list = new Grid();
	_.each(options.ignore, ({ x, y }) => ignore_list.set(x, y, true));
	scoring.ignore_list = ignore_list;

	// The graph builder.
	// var graph = new Graph(room, weight, scoring, diagonal);
	var graph = new ESGraph(room, weight, scoring, diagonal);
	var startNode = graph.getNode(start.x, start.y);
	var endNode = graph.getNode(end.x, end.y);
	var closestNode = startNode; // set the start node to be the closest if required

	var direction = '';

	// var openHeap = new BinaryHeap(node => node.f);
	var openHeap = new PriorityQueue(node => node.f);

	if (heuristicModifier <= 0) {
		start.h = 0;
	} else {
		start.h = heuristic(startNode, endNode) * heuristicModifier;
	}

	openHeap.push(startNode);
	var currentNode, i, il;
	var neighbors, neighbor;
	while ((currentNode = openHeap.pop())) {
		if (currentNode === endNode) {
			return this.pathTo(room, currentNode);
		}

		// Normal case -- move currentNode from open to closed, process each of its neighbors.
		currentNode.closed = true;
		if (scoring.directionchange > 0 && currentNode.parent) {
			direction = currentNode.getDirectionFrom(currentNode.parent);
		}
		// Find all neighbors for the current node.
		neighbors = graph.neighbors(currentNode);

		for (i = 0, il = neighbors.length; i < il; ++i) {
			if (maxops && ops >= maxops) {
				return {
					path: closest ? this.pathTo(room, closestNode) : [],
					ops,
					incomplete: false
				};
			}
			ops++;

			neighbor = neighbors[i];
			if (neighbor.closed || neighbor.isBlocked()) {
				continue;
			}

			// The g score is the shortest distance from start to current node.
			// We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
			var gScore = currentNode.g + neighbor.weight;

			// Penalize changing direction to encourage straight lines
			if (scoring.directionchange > 0 && neighbor.getDirectionFrom(currentNode) !== direction) {
				gScore += scoring.directionchange;
			}

			var beenVisited = neighbor.visited;
			if (!beenVisited || gScore < neighbor.g) {

				// reset the hueristic modifier each run
				heuristicModifier = options.heuristicModifier;

				// If heuristics is disabled don't bother calculating it.
				if (heuristicModifier > 0) {
					// Increase the heuristic score based off of the distance from the goal
					// This encourages straight lines and reduces the search space.
					if (scoring.distancepenalty > 0) {
						heuristicModifier += Math.abs(currentNode.x - endNode.x) * scoring.distancepenalty;
						heuristicModifier += Math.abs(currentNode.y - endNode.y) * scoring.distancepenalty;
					}
					neighbor.h = neighbor.h || heuristic(neighbor, endNode) * heuristicModifier;
				} else {
					neighbor.h = 0;
				}

				// Found an optimal (so far) path to this node.  Take score for node to see how good it is.
				neighbor.visited = true;
				neighbor.parent = currentNode;
				neighbor.g = gScore;
				neighbor.f = neighbor.g + neighbor.h;

				if (closest) {
					// If the neighbour is closer than the current closestNode or if it's equally close but has
					// a cheaper path than the current closest node then it becomes the closest node
					if (neighbor.h < closestNode.h || (neighbor.h === closestNode.h && neighbor.g < closestNode.g)) {
						closestNode = neighbor;
					}
				}

				if (!beenVisited) {
					// Pushing to heap will put it in proper place based on the 'f' value.
					openHeap.push(neighbor);
				} else {
					// Already seen the node, but since it has been rescored we need to reorder it in the heap
					openHeap.rescoreElement(neighbor);
				}
			}
		}
	}

	// No result was found - return closest (if allowed) or empty array
	return closest ? this.pathTo(room, closestNode) : [];
};

/**
 * Heuristic options
 * See list of heuristics: http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html
 */
Astar.prototype.heuristics = {
	manhattan: function (pos0, pos1) {
		var d1 = Math.abs(pos1.x - pos0.x);
		var d2 = Math.abs(pos1.y - pos0.y);
		return d1 + +d2;
	},

	diagonal_weighted: function (pos0, pos1) {
		var D = 1;
		var D2 = Math.sqrt(2);
		var d1 = Math.abs(pos1.x - pos0.x);
		var d2 = Math.abs(pos1.y - pos0.y);
		return (D * (d1 + d2)) + ((D2 - (2 * D)) * Math.min(d1, d2));
	},

	diagonal: function (pos0, pos1) {
		var d1 = Math.abs(pos1.x - pos0.x);
		var d2 = Math.abs(pos1.y - pos0.y);
		return Math.max(d1, d2);
	}
};

/**
 * Astar scoring function
 */
Astar.prototype.scoring = function (room, x, y, scoring = {}) {
	var pos = room.getPositionAt(x, y);

	if (typeof scoring.filter === 'function') {
		if (!scoring.filter(pos)) {
			return 0;
		}
	}

	var score = 0;
	// var terrain = room.lookForAt('terrain', pos)[0]
	const terrain = this.terrain.get(pos.x, pos.y);

	/* todo: fix scoring */
	if (terrain & TERRAIN_MASK_WALL)
		score = scoring.terrain[TERRAIN_MASK_WALL];
	else if (terrain & TERRAIN_MASK_SWAMP)
		score = scoring.terrain[TERRAIN_MASK_SWAMP];
	else if (terrain === 0)
		score = scoring.terrain[0]; /* No flag for plains */
	/* if (!scoring.terrain[terrain]) {
		score = 0;
	} else {
		score = scoring.terrain[terrain];
	} */

	if (score <= 0) {
		return 0;
	}

	if (scoring.structure !== false) {
		var structures = pos.getStructures();
		if (structures.length > 0) {
			for (var structure of structures) {

				var { structureType } = structure;

				if (scoring.structures[structureType] == null) {
					structure = 'default';
				}

				if (scoring.structures[structureType] !== false) {
					score = scoring.structures[structureType];
				}

				if (!structure.my) {
					var hostileStructureType = `hostile_${structureType}`;
					if (scoring.structures[hostileStructureType] !== false) {
						score = scoring.structures[hostileStructureType];
					}
				}

				if (score < 1) {
					return 0;
				}
			}
		}
	}

	if (scoring.creep !== false) {
		var creeps = room.lookForAt('creep', pos);
		if (creeps.length > 0) {
			if (scoring.creep >= 1) {
				score += scoring.creep;
			} else {
				return 0;
			}
		}
	}

	return score;
};

/**
 * 
 */
Astar.prototype.pathTo = function (room, node) {
	var path = [];
	var curr = node;

	do {
		var curr_position = {
			'x': curr.x,
			'y': curr.y
		};

		if (Astar.display && Astar.colors.optimal) {
			room.visual.circle(curr.x, curr.y, { fill: Astar.colors.optimal, opacity: 1.0 });
			// room.createFlagMemoryEfficient(room.getPositionAt(curr.x, curr.y), Astar.colors.optimal)
		}

		if (curr.parent) {
			curr_position.dx = curr.x - curr.parent.x;
			curr_position.dy = curr.y - curr.parent.y;
			curr_position.direction = curr.parent.getDirectionFrom(curr);
			path.unshift(curr_position);
			curr = curr.parent;
		} else {
			// we're at the starting location, which we do not include in the path
			curr = false;
		}
	} while (curr);

	return path;
};

/**
 * A graph memory structure that lazy loads it's grid elements as needed.
 *
 * @param {Room} [room] = Screeps Room object
 * @param {Funtion} [weight] = Weight function for nodes
 * @param {bool} [diagonal] = Specifies whether diagonal moves are allowed
 */
function Graph(room, weight, scoring, diagonal) {
	this.room = room;
	this.weight = weight;
	this.scoring = scoring;
	this.diagonal = diagonal;
	this.grid = [];
}

Graph.prototype.getNode = function (x, y) {

	if (!this.grid[x]) {
		this.grid[x] = [];
	}

	if (!this.grid[x][y]) {

		var weight;
		if (this.scoring.avoid_list[x] && this.scoring.avoid_list[x][y]) {
			weight = 0;
		} else if (this.scoring.ignore_list[x] && this.scoring.ignore_list[x][y]) {
			weight = 1;
		} else {
			weight = this.weight(this.room, x, y, this.scoring);
		}

		this.grid[x][y] = new GridNode(this.room, x, y, weight);
		if (Astar.display && Astar.colors.tested) {
			// this.room.visual.circle(x,y,{fill: Astar.colors.tested});
			this.room.visual.circle(x, y, {
				fill:
					(weight < 1) ? 'red' : Astar.colors.tested,
				opacity: 1.0
			});
		}
	}

	return this.grid[x][y];
};

Graph.prototype.neighbors = function (node) {
	var ret = [];
	var { x, y } = node;

	// West
	if (x - 1 >= 0) {
		node = this.getNode(x - 1, y);
		if (!node.isBlocked()) {
			ret.push(node);
		}
	}

	// East
	if (x + 1 < 50) {
		node = this.getNode(x + 1, y);
		if (!node.isBlocked()) {
			ret.push(node);
		}
	}

	// South
	if (y - 1 >= 0) {
		node = this.getNode(x, y - 1);
		if (!node.isBlocked()) {
			ret.push(node);
		}
	}

	// North
	if (y + 1 < 50) {
		node = this.getNode(x, y + 1);
		if (!node.isBlocked()) {
			ret.push(node);
		}
	}

	if (this.diagonal) {
		// South
		if (y - 1 >= 0) {
			// West
			if (x - 1 >= 0) {
				node = this.getNode(x - 1, y - 1);
				if (!node.isBlocked()) {
					ret.push(node);
				}
			}

			// East
			if (x + 1 < 50) {
				node = this.getNode(x + 1, y - 1);
				if (!node.isBlocked()) {
					ret.push(node);
				}
			}
		}

		// North
		if (y + 1 < 50) {
			// West
			if (x - 1 >= 0) {
				node = this.getNode(x - 1, y + 1);
				if (!node.isBlocked()) {
					ret.push(node);
				}
			}

			// East
			if (x + 1 < 50) {
				node = this.getNode(x + 1, y + 1);
				if (!node.isBlocked()) {
					ret.push(node);
				}
			}
		}
	}

	return ret;
};

/**
 * ES6 Graph - Alt variant of Graph with pre-initilized space.
 *
 * A graph memory structure that lazy loads it's grid elements as needed. 
 * 
 */
class ESGraph extends Graph {
	constructor(room, weight, scoring, diagonal) {
		super();
		this.room = room;
		this.weight = weight;
		this.scoring = scoring;
		this.diagonal = diagonal;
		this.grid = new Array(2500);
		this.terrain = Game.map.getRoomTerrain(room.name); /* Not sure how out this context is messed up so badly */
	}

	getNode(x, y) {
		var weight, i = (y * 50) + x;
		if (!this.grid[i]) {
			// if (this.scoring.avoid_list[x] && this.scoring.avoid_list[x][y]) {
			if (this.scoring.avoid_list.get(x, y)) {
				weight = 0;
			} else if (this.scoring.ignore_list.get(x, y)) {
				weight = 1;
			} else {
				weight = this.weight(this.room, x, y, this.scoring);
			}

			this.grid[i] = new GridNode(this.room, x, y, weight);
			if (Astar.display && Astar.colors.tested) {
				this.room.visual.circle(x, y, {
					fill:
						(weight < 1) ? 'red' : Astar.colors.tested,
					opacity: 1.0
				});
			}
		}
		return this.grid[i];
	}
}

/**
 * 
 */
function GridNode(room, x, y, weight) {

	if (!weight || weight < 1) {
		this.weight = 0;
	} else {
		this.weight = weight;
	}

	this.room = room;
	this.x = x;
	this.y = y;
	this.f = 0;
	this.g = 0; // The g score is the shortest distance from start to current node.
	this.h = 0;
	this.visited = false;
	this.closed = false;
	this.parent = null;
}

GridNode.prototype.toString = function () {
	return `[${this.x} ${this.y}]`;
};

GridNode.prototype.isBlocked = function () {
	return this.weight < 1;
};

GridNode.prototype.getDirectionFrom = function (node) {
	var { x, y } = this;
	// Node is to the left
	if (node.x < x) {
		// Node is to the top
		if (node.y < y) {
			return 8;
		}

		// Node is on the same level
		if (node.y === y) {
			return 7;
		}

		// Node is to the bottom
		if (node.y > y) {
			return 6;
		}
	}

	if (node.x === x) {
		// Node is to the top
		if (node.y < y) {
			return 1;
		}

		// Node is to the bottom
		if (node.y > y) {
			return 5;
		}
	}

	// Node is to the right
	if (node.x > x) {
		// Node is to the top
		if (node.y < y) {
			return 2;
		}

		// Node is on the same level
		if (node.y === y) {
			return 3;
		}

		// Node is to the bottom
		if (node.y > y) {
			return 4;
		}
	}
};

/**
 * Priority queue option for storage. Comparable cpu to heap,
 * but a hair slower.
 */
class PriorityQueue extends Array {
	constructor(scoreFn, scorer = _.sortedLastIndex) {
		super();
		this.scoreFn = scoreFn;
		this.scorer = scorer;
	}

	push(elem) {
		return this.splice(
			this.scorer(this, elem, x => -this.scoreFn(x))
			, 0, elem);
	}

	remove(elem) {
		this.splice(this.indexOf(elem), 1);
	}

	rescoreElement(elem) {
		this.remove(elem);
		this.push(elem);
	}

	size() { return this.length; }
}

/**
 * Binary heap storage option.
 */
function BinaryHeap(scoreFunction) {
	this.content = [];
	this.scoreFunction = scoreFunction;
}

BinaryHeap.prototype = {
	push: function (element) {
		var { content } = this;
		// Add the new element to the end of the array.
		content.push(element);

		// Allow it to sink down.
		this.sinkDown(content.length - 1);
	},
	pop: function () {
		var { content } = this;
		// Store the first element so we can return it later.
		var [result] = content;
		// Get the element at the end of the array.
		var end = content.pop();
		// If there are any elements left, put the end element at the
		// start, and let it bubble up.
		if (content.length !== 0) {
			content[0] = end;
			this.bubbleUp(0);
		}
		return result;
	},
	remove: function (node) {
		var { content } = this;
		var i = content.indexOf(node);

		// When it is found, the process seen in 'pop' is repeated
		// to fill up the hole.
		var end = content.pop();

		if (i !== content.length - 1) {
			content[i] = end;

			if (this.scoreFunction(end) < this.scoreFunction(node)) {
				this.sinkDown(i);
			} else {
				this.bubbleUp(i);
			}
		}
	},
	size: function () {
		return this.content.length;
	},
	rescoreElement: function (node) {
		this.sinkDown(this.content.indexOf(node));
	},
	sinkDown: function (n) {
		var { content, scoreFunction } = this;
		// Fetch the element that has to be sunk.
		var element = content[n];
		//
		var elemScore = scoreFunction(element);
		var parentN = 0,
			parent = 0;
		// When at 0, an element can not sink any further.
		while (n > 0) {
			// Compute the parent element's index, and fetch it.
			parentN = ((n + 1) >> 1) - 1;
			parent = content[parentN];
			// Swap the elements if the parent is greater.
			if (elemScore < scoreFunction(parent)) {
				content[parentN] = element;
				content[n] = parent;
				// Update 'n' to continue at the new position.
				n = parentN;
			}
			// Found a parent that is less, no need to sink any further.
			else {
				break;
			}
		}
	},
	bubbleUp: function (n) {
		var { content, scoreFunction } = this;
		// Look up the target element and its score.
		var { length } = content;
		var element = content[n];
		var elemScore = scoreFunction(element);
		// early declarations with type hints
		var child2N = 0,
			child1N = 0;
		var child1Score = 0;
		var swap = -1; // no type change !! -1 stands for no swap. X2 speed increase !!!
		var child1 = null,
			child2 = null;

		while (true) {
			// Compute the indices of the child elements.
			child2N = (n + 1) << 1;
			child1N = child2N - 1;
			// This is used to store the new position of the element, if any.
			swap = -1;
			// If the first child exists (is inside the array)...
			if (child1N < length) {
				// Look it up and compute its score.
				child1 = content[child1N];
				child1Score = scoreFunction(child1);

				// If the score is less than our element's, we need to swap.
				if (child1Score < elemScore) {
					swap = child1N;
				}
			}

			// Do the same checks for the other child.
			if (child2N < length) {
				child2 = content[child2N];
				if (scoreFunction(child2) < (swap < 0 ? elemScore : child1Score)) {
					swap = child2N;
				}
			}

			// If the element needs to be moved, swap it, and continue.
			if (swap >= 0) {
				content[n] = content[swap];
				content[swap] = element;
				n = swap;
			}
			// Otherwise, we are done.
			else {
				break;
			}
		}
	}
};

/** */
module.exports = {
	Astar,
	BinaryHeap,
	Graph,
	ESGraph,
	GridNode,
	PriorityQueue
};

/** UnionFind - For Kruskal MST algo */
'use strict';

export default class UnionFind {
	// Using x/y positions here 
	constructor(elements) {
		this.count = elements.length; // Number of disconnected components		
		this.parent = {}; // Keep Track of connected components
		// Initialize the data structure such that all
		// elements have themselves as parents
		elements.forEach(e => (this.parent[e] = e));
	}

	union(a, b) {
		const rootA = this.find(a);
		const rootB = this.find(b);

		// Roots are same so these are already connected.
		if (rootA === rootB) return;

		// Always make the element with smaller root the parent.
		if (rootA < rootB) {
			if (this.parent[b] !== b) this.union(this.parent[b], a);
			this.parent[b] = this.parent[a];
		} else {
			if (this.parent[a] !== a) this.union(this.parent[a], b);
			this.parent[a] = this.parent[b];
		}
	}

	// Returns final parent of a node
	find(a) {
		while (this.parent[a] !== a) {
			a = this.parent[a];
		}
		return a;
	}

	// Checks connectivity of the 2 nodes
	connected(a, b) {
		return this.find(a) === this.find(b);
	}
}
global.UnionFind = UnionFind;


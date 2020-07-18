/**
 * Grid class - For mapping an x,y position to a value 
 */
'use strict';

export default class Grid {
	constructor() {
		this.arr = [];
	}

	get(x, y) {
		if (this.arr[y] && this.arr[y][x] !== undefined)
			return this.arr[y][x];
		return undefined;
	}

	set(x, y, v) {
		if (!this.arr[y])
			this.arr[y] = [];
		this.arr[y][x] = v;
		return v;
	}

	toString() { return "[Grid]"; }
}

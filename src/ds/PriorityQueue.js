/**  */
'use strict';

import BaseArray from './BaseArray';

export default class PriorityQueue extends BaseArray {
	constructor(itr = [], scoreFn = _.identity, scorer = _.sortedIndex) {
		super();
		this.scoreFn = scoreFn;
		this.scorer = scorer;
		if (!itr)
			return;
		for (const i of itr)
			this.insert(i);
	}

	insert(elem) {
		const indx = this.scorer(this, elem, x => this.scoreFn(x));
		return this.splice(indx, 0, elem);
	}

	// Fixes a whole lot of weird stuff when using slice to clone
	static get [Symbol.species]() { return BaseArray; }
}
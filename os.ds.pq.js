/**  */
'use strict';

class PriorityQueue extends Array {
	constructor(itr = [], scoreFn = _.Identity, scorer = _.sortedIndex) {
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

	// Use only if change a bunch of elements at once
	sort() {

	}
}

module.exports = PriorityQueue;
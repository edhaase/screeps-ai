/** os.core.pager.thp.js - Transparent huge pages */
'use strict';

/* global MAKE_CONSTANT, ENV */

const Async = require('os.core.async');
const Pager = require('os.core.pager');

const DEFAULT_THP_PAGE_SPAN = 3;

MAKE_CONSTANT(global, 'THP_PAGE_SPAN', ENV('pager.thp_page_span', DEFAULT_THP_PAGE_SPAN));
MAKE_CONSTANT(global, 'THP_MAX_PAGE_COUNT', Math.floor(MAX_PAGE_COUNT / THP_PAGE_SPAN));
MAKE_CONSTANT(global, 'THP_MIN_PAGE_ID', THP_PAGE_SPAN*2); // Leave 6 pages free?
// MAKE_CONSTANT(global, 'THP_MAX_PAGE_ID', THP_MAX_PAGE_COUNT - 1);

class THP {
	static *read(pageIds) {
		if (!Array.isArray(pageIds))
			throw new TypeError(`Expected array, got ${typeof pageIds}`);
		return yield* Async.mapPar(pageIds, this.fetch);
	}

	static *fetch(id) {
		const pages = yield* Pager.read(this.calcPages(id * global.THP_PAGE_SPAN));
		return pages.join('');
	}

	static write(id, v, limit = global.MAX_PAGE_SIZE) {
		for (var i = 0; i < global.THP_PAGE_SPAN; i++) {
			const str = v.slice(limit * i, limit * (i + 1));
			console.log(`writing ${id + i} [${str.length}] [${str}]`);
		}
	}

	static calcPages(offset, span = global.THP_PAGE_SPAN) {
		const pages = [];
		for (var i = 0; i < span; i++)
			pages.push(offset + i);
		return pages;
	}
}

module.exports = THP;
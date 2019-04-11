/** os.core.pager.thp.js - Transparent huge pages */
'use strict';

/* global MAKE_CONSTANT, ENV */

const Async = require('os.core.async');
const Pager = require('os.core.pager');

const DEFAULT_THP_PAGE_SPAN = 3;

MAKE_CONSTANT(global, 'THP_PAGE_SPAN', ENV('pager.thp_page_span', DEFAULT_THP_PAGE_SPAN));
MAKE_CONSTANT(global, 'THP_MAX_PAGE_COUNT', Math.floor(MAX_PAGE_COUNT / THP_PAGE_SPAN));
MAKE_CONSTANT(global, 'THP_MIN_PAGE_ID', THP_PAGE_SPAN * 2); // Leave 6 pages free?
MAKE_CONSTANT(global, 'THP_MAX_PAGE_SIZE', MAX_PAGE_SIZE * THP_PAGE_SPAN);
// MAKE_CONSTANT(global, 'THP_MAX_PAGE_ID', THP_MAX_PAGE_COUNT - 1);

class THP {
	static *read(pageIds) {
		if (!Array.isArray(pageIds))
			throw new TypeError(`Expected array, got ${typeof pageIds}`);
		return yield* Async.mapPar(pageIds, this.fetch);
	}

	static *fetch(id) {
		const pages = yield* Pager.read(THP.calcPages(id * global.THP_PAGE_SPAN));
		return pages.join('');
	}

	static write(id, value, size = global.MAX_PAGE_SIZE) {
		if (value == null || typeof value !== 'string')
			throw new TypeError(`Expected string, ${typeof value}`);
		if (value.length > global.THP_MAX_PAGE_SIZE)
			throw new Error(`Maximum length exceeded ${value.length}/${global.THP_MAX_PAGE_SIZE}`);
		const idx = id * global.THP_PAGE_SPAN;
		for (var i = 0; i < global.THP_PAGE_SPAN; i++) {
			const str = value.slice(size * i, size * (i + 1));
			// console.log(`writing ${id + i} [${str.length}] [${str}]`);
			Pager.write(idx + i, str);
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
/** os.core.pager.js - Memory paging */
'use strict';

/* global ENV, ENVC, MAKE_CONSTANT, Log, SEGMENT_PROC, SEGMENT_CRON, SEGMENT_STATS */

const Async = require('os.core.async');
const LazyMap = require('os.ds.lazymap');
const LRU = require('os.ds.lru');

const DEFAULT_MAX_ACTIVE_PAGES = 10;
const DEFAULT_MAX_PAGE_COUNT = 99;
const DEFAULT_MAX_PAGE_SIZE = 100 * 1024;
const DEFAULT_PAGE_CACHE_LIMIT = 100;
const DEFAULT_PAGES = [SEGMENT_PROC, SEGMENT_CRON, SEGMENT_STATS];

MAKE_CONSTANT(global, 'MAX_ACTIVE_PAGES', ENV('pager.max_active_pages', DEFAULT_MAX_ACTIVE_PAGES));
MAKE_CONSTANT(global, 'MAX_PAGE_COUNT', ENVC('pager.max_page_count', DEFAULT_MAX_PAGE_COUNT, 0, DEFAULT_MAX_PAGE_COUNT));
MAKE_CONSTANT(global, 'MAX_PAGE_SIZE', ENV('pager.max_page_size', DEFAULT_MAX_PAGE_SIZE));
MAKE_CONSTANT(global, 'PAGE_CACHE_LIMIT', ENV('pager.page_cache_limit', DEFAULT_PAGE_CACHE_LIMIT));

const PAGE_CACHE = new LRU({ max: global.PAGE_CACHE_LIMIT });
const PAGE_REQUESTS = new LazyMap(() => 0);

global.PAGE_REQUESTS = PAGE_REQUESTS;

/** On runtime reset let's get the process table loaded */
RawMemory.setActiveSegments(ENV('pager.default_pages', DEFAULT_PAGES));

/**
 * Low level access to memory segments as "pages". These are handled purely as strings.
 * Translation occurs elsewhere.
 */
class Pager {
	static *read(pageIds) {
		if (!Array.isArray(pageIds))
			throw new TypeError(`Expected array, got ${typeof pageIds}`);
		return yield* Async.mapPar(pageIds, this.fetch);
	}

	static *fetch(pageId) {
		Log.debug(`FETCH START ${pageId} on ${Game.time}`, 'Pager');
		if (PAGE_CACHE.has(pageId))
			return PAGE_CACHE.get(pageId);
		if (RawMemory.segments[pageId] === undefined)
			PAGE_REQUESTS.incr(pageId);
		while (RawMemory.segments[pageId] === undefined)
			yield;
		PAGE_CACHE.set(pageId, RawMemory.segments[pageId]);
		Log.debug(`FETCH END ${pageId} on ${Game.time}`, 'Pager');
		return PAGE_CACHE.get(pageId);
	}

	static write(pageId, value) {
		if (value == null || typeof value !== 'string')
			throw new TypeError(`Expected string, ${typeof value}`);
		if (value.length > global.MAX_PAGE_SIZE)
			throw new Error(`Maximum length exceeded ${value.length}/${global.MAX_PAGE_SIZE}`);
		PAGE_CACHE.set(pageId, value);
		RawMemory.segments[pageId] = value;
	}

	static invalidate(pageId) {
		delete PAGE_CACHE[pageId];
	}

	/**
	 * Self-contained state machine. While idle waits for requests.
	 * If requets come in, start serving them by demand. When we're done,
	 * reset to primary segments to save time on next load.
	 */
	static *tick() {
		Log.debug(`Startup on ${Game.time}`, 'Pager');
		while (!(yield)) {
			if (PAGE_REQUESTS.size <= 0)
				continue;

			while (PAGE_REQUESTS.size) {
				const sorted = _.sortByOrder([...PAGE_REQUESTS.keys()], (k) => PAGE_REQUESTS.get(k), ['desc']);
				const segments = _.take(sorted, global.MAX_ACTIVE_PAGES);
				Log.info(`Loading segments ${segments}`, 'Pager');
				RawMemory.setActiveSegments(segments);
				for (const segment of segments)
					PAGE_REQUESTS.delete(segment);
				yield;
			}
			Log.debug(`Page requests complete, resetting to default pages`, 'Pager');
			RawMemory.setActiveSegments(ENV('pager.default_pages', DEFAULT_PAGES));
		}
	}

}

module.exports = Pager;
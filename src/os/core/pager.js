/** /os/core/pager.js - Memory paging */
'use strict';

/* global CLAMP, ENV, ENVC, MAKE_CONSTANT, Log, SEGMENT_PROC, SEGMENT_CRON, SEGMENT_STATS */
/* global MAX_ACTIVE_PAGES, MAX_PAGE_COUNT, PAGE_CACHE, PAGE_REQUESTS, PAGE_WRITES, PAGE_HIT, PAGE_MISS */
import { ENV, ENVC, MAKE_CONSTANT } from '/os/core/macros';

import * as Co from '/os/core/co';
import LazyMap from '/ds/LazyMap';
import LRU from '/ds/Lru';
import { Log, LOG_LEVEL } from '/os/core/Log';

export const DEFAULT_PAGE_WRITE_RESERVE = 0.20; // 20% (2 of 10 pages)
export const DEFAULT_MAX_ACTIVE_PAGES = 10;
export const DEFAULT_MAX_PAGE_COUNT = 99;
export const DEFAULT_MAX_PAGE_SIZE = 100 * 1024;
export const DEFAULT_PAGE_CACHE_LIMIT = 100;
export const DEFAULT_PAGES = [SEGMENT_PROC, SEGMENT_CRON, SEGMENT_STATS];

MAKE_CONSTANT(global, 'MAX_ACTIVE_PAGES', ENV('pager.max_active_pages', DEFAULT_MAX_ACTIVE_PAGES));
MAKE_CONSTANT(global, 'MAX_PAGE_COUNT', ENVC('pager.max_page_count', DEFAULT_MAX_PAGE_COUNT, 0, DEFAULT_MAX_PAGE_COUNT));
MAKE_CONSTANT(global, 'MAX_PAGE_SIZE', ENV('pager.max_page_size', DEFAULT_MAX_PAGE_SIZE));
MAKE_CONSTANT(global, 'PAGE_CACHE_LIMIT', ENV('pager.page_cache_limit', DEFAULT_PAGE_CACHE_LIMIT));
MAKE_CONSTANT(global, 'PAGE_WRITE_RESERVE', ENV('pager.page_write_reserve', DEFAULT_PAGE_WRITE_RESERVE));
MAKE_CONSTANT(global, 'PAGE_EXPIRATION', ENV('pager.page_expiration'));

MAKE_CONSTANT(global, 'PAGE_CACHE', new LRU({ name: 'PageCache', max: global.PAGE_CACHE_LIMIT, ttl: global.PAGE_EXPIRATION }));
MAKE_CONSTANT(global, 'PAGE_REQUESTS', new LazyMap(() => 0));
MAKE_CONSTANT(global, 'PAGE_WRITES', new Map());
global.PAGE_HIT = 0;
global.PAGE_MISS = 0;
global.PAGE_IO_WRITE = 0;
global.PAGE_IO_READ = 0;

/** On runtime reset let's get the process table loaded */
RawMemory.setActiveSegments(ENV('pager.default_pages', DEFAULT_PAGES));

/**
 * Low level access to memory segments as "pages". These are handled purely as strings.
 * Translation occurs elsewhere.
 */
export default class Pager {
	static resetAll() {
		for (var i = 0; i <= MAX_PAGE_COUNT; i++) {
			Pager.write(i, '');
		}
	}

	static *read(pageIds) {
		if (!Array.isArray(pageIds))
			throw new TypeError(`Expected array, got ${typeof pageIds}`);
		return yield* Co.mapPar(pageIds, this.fetch);
	}

	static *fetch(pageId) {
		Log.debug(`FETCH START ${pageId} on ${Game.time}`, 'Pager');
		if (PAGE_CACHE.has(pageId)) {
			global.PAGE_HIT++;
			return PAGE_CACHE.get(pageId);
		}
		global.PAGE_MISS++; // If it's not already loaded, it's a page miss, even if it's available
		if (RawMemory.segments[pageId] === undefined) {
			PAGE_REQUESTS.incr(pageId);
		}
		while (RawMemory.segments[pageId] === undefined)
			yield;
		PAGE_CACHE.set(pageId, RawMemory.segments[pageId]);
		Log.debug(`FETCH END ${pageId} on ${Game.time}`, 'Pager');
		global.PAGE_IO_READ++;
		return PAGE_CACHE.get(pageId);
	}

	static write(pageId, value, immediate = false) {
		if (value == null || typeof value !== 'string')
			throw new TypeError(`Expected string, ${typeof value}`);
		if (value.length > global.MAX_PAGE_SIZE)
			throw new Error(`Maximum length exceeded ${value.length}/${global.MAX_PAGE_SIZE}`);
		if (!immediate && value === PAGE_CACHE.get(pageId))
			return Log.debug(`Skipping page write on page ${pageId} -- data unchanged`, 'Pager');
		PAGE_CACHE.set(pageId, value);
		if (immediate) {
			if (_.size(RawMemory.segments) >= MAX_ACTIVE_PAGES && RawMemory.segments[pageId] === undefined)
				throw new Error(`Can not exceed max active pages`);
			Log.debug(`Writing page ${pageId} on tick ${Game.time}`, 'Pager');
			RawMemory.segments[pageId] = value;
			global.PAGE_IO_WRITE++;
		} else {
			PAGE_WRITES.set(pageId, value);
		}
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
			if (PAGE_REQUESTS.size <= 0 && PAGE_WRITES.size <= 0)
				continue;

			while (PAGE_REQUESTS.size || PAGE_WRITES.size) {
				// Write all available pages
				var write_avail = MAX_ACTIVE_PAGES - _.size(RawMemory.segments);
				for (const [page, value] of PAGE_WRITES.entries()) {
					if (write_avail-- <= 0)
						break;
					Pager.write(page, value, true);
					PAGE_WRITES.delete(page);
				}

				// Set new pages, if we still have pending writes, leave room for them.
				const read_avail = MAX_ACTIVE_PAGES - Math.min(PAGE_WRITES.size, Math.ceil(MAX_ACTIVE_PAGES * PAGE_WRITE_RESERVE));
				const sorted = _.sortByOrder([...PAGE_REQUESTS.keys()], (k) => PAGE_REQUESTS.get(k), ['desc']);
				const segments = _.take(sorted, read_avail);
				if (segments && segments.length) {
					Log.info(`Loading segments ${segments}`, 'Pager');
					RawMemory.setActiveSegments(segments);
					for (const segment of segments)
						PAGE_REQUESTS.delete(segment);
				}
				yield;
			}

			Log.debug(`Page requests complete, resetting to default pages`, 'Pager');
			RawMemory.setActiveSegments(ENV('pager.default_pages', DEFAULT_PAGES));
		}
	}

};
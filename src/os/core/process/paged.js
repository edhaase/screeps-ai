/**
 * @module
 */
/* global ENV, ENVC, MAKE_CONSTANT, MAKE_CONSTANTS, Log */
import Process from '/os/core/process';
import Pager from '/os/core/pager';

/**
 * @classdesc Simplified memory-paged process
 */
export default class PagedProcess extends Process {
	constructor(opts) {
		super(opts);
		this.pager = Pager; // Or PagerTHP
		this.pageIds = [];
		this.pages = [];
		this.immediate = [];
	}

	/**
	 * @callback
	 * @param {*} pageId 
	 */
	onPageCorrupted(pageId) {
		// Throw error to terminate
		// Return object to initialize, override to provide array.
		this.error(`Error parsing ${pageId}`);
		return {};
	}

	onPageDeserialize(str, pageId) {
		return JSON.parse(str);
	}

	onPageSerialize(value, pageId) {
		return JSON.stringify(value);
	}

	/**
	 * Read and parse all pages
	 */
	*read() {
		const pages = yield* this.pager.read(this.pageIds);
		const result = [];
		let dirty = false;
		for (const idx in pages) {
			try {
				result.push(this.onPageDeserialize(pages[idx], this.pageIds[idx]));
			} catch (err) {
				const obj = this.onPageCorrupted(this.pageIds[idx]);
				result.push(obj);
				dirty = true;
			}
		}
		this.pages = result; // Switch it out if it works
		if (dirty)
			this.write();
		return this.pages;
	}

	/**
	 * Write all pages
	 */
	write() {
		for (const indx in this.pages) {
			this.pager.write(this.pageIds[indx], this.onPageSerialize(this.pages[indx]), !!this.immediate[indx]);
		}
	}

	toString() {
		return `[PagedProcess ${this.pid} ${this.friendlyName}]`;
	}
}

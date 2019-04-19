/** os.core.process.paged.js - Memory paged process simplified */
'use strict';

/* global ENV, ENVC, MAKE_CONSTANT, MAKE_CONSTANTS, PROCESS_NAMESPACE, Log */

const Process = require('os.core.process');
const { Pager } = require('os.core.pager');

class PagedProcess extends Process {
	constructor(opts) {
		super(opts);
		this.pager = Pager; // Or PagerTHP
		this.pageIds = [];
		this.pages = [];
	}

	onPageCorrupted(pageId) {
		// Throw error to terminate
		// Return object to initialize, override to provide array.
		return {};
	}

	onPageDeserialize(str, pageId) {
		return JSON.parse(str);
	}

	onPageSerialize(value, pageId) {
		return JSON.stringify(value);
	}

	/** Reloads and parses values */
	*read() {
		const pages = yield* this.pager.read(this.pageIds);
		const result = [];
		let dirty = false;
		for (const idx in pages) {
			try {
				result.push(this.onPageDeserialize(pages[idx], this.pageIds[idx]));
			} catch (err) {
				this.error(`Error parsing ${this.pageIds[idx]}`);
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

	write() {
		for (const indx in this.pages) {
			this.pager.write(this.pageIds[indx], this.onPageSerialize(this.pages[indx]));
		}
	}

	toString() {
		return `[PagedProcess ${this.pid} ${this.friendlyName}]`;
	}
}

module.exports = PagedProcess;

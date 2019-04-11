/** os.core.table.js - Table renderer */
'use strict';

class Table {
	constructor(iterable, opts) {
		this.alias = opts.alias || {};		// Column alias for display and sorting
		this.sort = opts.sort;
		this.tableStyle = opts.tableStyle;

		this.iterable = iterable;
	}

	getRows() {
		const unorderedRows = [...this.iterable];
		if (!this.sort)
			return rows;
		return _.sortByOrder(unorderedRows, Object.keys(this.sort), Object.values(this.sort));
	}

	construct() {
		// const h = _.map(this.keys)		
		// this.header = `<thead><tr></tr></thead>`;

		const rows = this.getRows();
		for (const row of rows) {

		}
	}

	render() {
		return `<table ${this.tableStyle}>${this.header}${this.body}${this.footer}</table>`;
	}
}

module.exports = Table;
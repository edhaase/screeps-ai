import { CLAMP } from '/os/core/math';
import { ROOM_LINK } from '/os/core/macros';

export function html_hsl_span(n, contents, invert = false) {
	const pct = (invert)
		? 120 * CLAMP(0.0, n, 1.0)
		: 120 * (1 - CLAMP(0.0, n, 1.0));
	return `<span style='color:hsl(${pct},100%,50%)'>${contents}</span>`;
}

export function html_truefalse_span(content, state=true) {
	const color = (state) ? 'green' : 'red';
	return `<span style='color: ${color}'>${content}</span>`;
}

/**
 * HTML table in console
  */
export function table(headers, rows, opts = {}) {
	// let tbl = '<table>';
	let tbl = "";
	tbl += '<style>';
	if (opts.trStyle) tbl += `.logtable ${opts.trStyle} `;
	if (opts.thStyle) tbl += `.logtable ${opts.thStyle} `;
	if (opts.tdStyle) tbl += `.logtable ${opts.tdStyle} `;
	tbl += '</style>';
	tbl += `<table style="${opts.tableStyle || ''}" class='logtable'>`;
	// _.each(headers, h => tbl += `<th width="50px">${h}</th>`);
	tbl += "<thead>";
	for (const heading of headers) {
		if (Array.isArray(heading)) {
			const [style, title] = heading;
			tbl += `<th style="${style}">${title}</th>`;
		} else {
			tbl += `<th>${heading}</th>`;
		}
	}
	tbl += "</thead><tbody>";
	for (const row of rows) {
		tbl += `<tr>`;
		for (const cell of row) {
			if (Array.isArray(cell)) {
				const [style, content] = cell;
				tbl += `<td ${style}>${content}</td>`;
			} else {
				tbl += `<td>${cell}</td>`;
			}
		}
		tbl += '</tr>';
	}
	tbl += '</tbody></table>';
	return tbl.replace(/([WE])(\d+)([NS])(\d+)/gi, r => ROOM_LINK(r));
}
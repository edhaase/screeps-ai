import { ENV, ROOM_LINK } from '/os/core/macros';
import { NUMBER_FORMATTER, to_precision, to_fixed } from '/lib/util';
import { table, html_hsl_span, html_truefalse_span } from '/lib/html';

/**
 * 
 * @param {*} sortBy 
 * @param {*} order 
 */
export function proc(sortBy = ENV('commands.proc.default_sort', 'pid'), order = ['asc']) {
	const sorted = _.sortByOrder([...kernel.process.values()], sortBy, order);
	if (!sorted || !sorted.length)
		return "No processes";
	const headers = [
		'pid/name', 'ppid/name',
		['text-align: right', '#threads'],
		['text-align: right', '<span>totalCpu</span>'],
		['text-align: right', 'minCpu'],
		['text-align: right', 'avgUsrCpu'],
		['text-align: right', 'avgSysCpu'],
		['text-align: right', 'maxCpu'],
		['text-align: right', 'age'],
		['width: 8vw', '<span>title</span>']
	];
	const rows = [];
	for (const r of sorted) {
		rows.push([
			`${r.pid}/${r.name}`,
			`${(r.parent && r.parent.pid) || '-'}/${(r.parent && r.parent.name) || '-'}`,
			["style='text-align: right'", r.threads.size],
			["style='text-align: right'", html_hsl_span(r.totalCpu / Game.cpu.limit, to_fixed(r.totalCpu, 3))],
			["style='text-align: right'", html_hsl_span(r.minCpu / Game.cpu.limit, to_fixed(r.minCpu, 3))],
			["style='text-align: right'", html_hsl_span(r.avgUsrCpu / Game.cpu.limit, to_fixed(r.avgUsrCpu, 3))],
			["style='text-align: right'", html_hsl_span(r.avgSysCpu / Game.cpu.limit, to_fixed(r.avgSysCpu, 3))],
			["style='text-align: right'", html_hsl_span(r.maxCpu / Game.cpu.limit, to_fixed(r.maxCpu, 3))],
			["style='text-align: right'", Game.time - r.born],
			`<span>${r.title || '-'}</span>`
		]);
	}
	return table(headers, rows, {
		tableStyle: 'width: 50vw',
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	});
}

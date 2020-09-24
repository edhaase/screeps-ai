/**
 * Audit report shows income and expense of each room and alloted values
 * 
 * @todo consider separate income, expense, upkeep breakdowns
 */
import { DATETIME_FORMATTER, estimate } from '/lib/time';
import { NUMBER_FORMATTER, to_precision, to_fixed } from '/lib/util';
import { table, html_hsl_span, html_truefalse_span } from '/lib/html';

// @todo not census, census is population. this is an audit or debit/credit type thing
export default function report_audit(sort = [10], sortOrder = ['desc']) {
	if (!Memory.audit)
		return 'No audit data';
	// Last audit timestamp
	// Base 20 Remote 46 Reactor 0 Over 0 Decay: 6
	// Upkeep: 17.503, Creep: 15.6, Structure: 1.903
	// Income: 72, Overstock: 0, Expense: 0, Upkeep: 17.503, Net: 54.497, Avail 54.497, Banked: 199544, Adjusted 54.373
	// Allotments: 15 upgrade, 8 repair, 0 build, 31.373 leftover
	const headers = [
		'Room',
		['text-align: right; color: cyan', 'Income'],
		['text-align: right; color: cyan', 'Local'], 				// Base (add color or indicator if we're in 'reactor' state)
		['text-align: right; color: cyan', 'Remote'],
		['text-align: right; color: cyan', 'Overstock'],
		['text-align: right; color: cyan', 'Decay'],
		['text-align: right; color: yellow', 'Expense'],			// Other expenses		
		['text-align: right; color: yellow', 'Upkeep'],				// to_fixed
		['text-align: right; color: yellow', 'Creep'],
		['text-align: right; color: yellow', 'Infrastructure'], 	// Structure decay
		['text-align: right; color: white', 'Net'], 				// r/g for positive/negative
		['text-align: right; color: white', 'Stock'], 				// hsl scale
		['text-align: right; color: white', 'Modifier'], 			// hsl scale
		['text-align: right; color: white', 'Adjusted'],
		['text-align: right; color: white', 'Time'],
	];

	const rows = [];
	for (const [roomName, audit] of Object.entries(Memory.audit)) {
		const { local, remote, overstock, decay, stock, modifier } = audit;
		const { upkeepCreeps, upkeepStructures } = audit;
		const { time } = audit;

		const income = local + remote + decay;
		const upkeep = upkeepCreeps + upkeepStructures;
		const expense = upkeep;
		const net = income - expense;
		const adjusted = net * modifier;

		const stockPct = to_fixed(100 * stock, 2);
		const modPct = to_fixed(100 * modifier, 2);
		rows.push([
			['', roomName],
			["style='text-align: right'", to_fixed(income, 2)],
			["style='text-align: right'", to_fixed(local, 2)],
			["style='text-align: right'", to_fixed(remote, 2)],
			["style='text-align: right'", overstock],
			["style='text-align: right'", to_fixed(decay, 2)],

			["style='text-align: right'", to_fixed(expense, 2)],
			["style='text-align: right'", to_fixed(upkeep, 2)],
			["style='text-align: right'", to_fixed(upkeepCreeps, 2)],
			["style='text-align: right'", to_fixed(upkeepStructures, 2)],

			["style='text-align: right'", to_fixed(net, 2)],
			["style='text-align: right'", html_hsl_span(stock, `${stockPct}%`, true)],
			["style='text-align: right'", html_hsl_span(modifier, `${modPct}%`, true)],
			["style='text-align: right'", to_fixed(adjusted, 2)],
			["style='text-align: right'", DATETIME_FORMATTER.format(time)],
		])
	}
	const fixers = _.map(sort, o => i => parseFloat(i[o][1]));
	const sorted = _.sortByOrder(rows, fixers, sortOrder);
	const opts = {
		tdStyle: "td { padding-right: 7px }",
		thStyle: "th { width: 1vw; padding-right: 7px }",
		tableStyle: "width: 60vw; margin-bottom: 5px'",
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	}
	return table(headers, sorted, opts);
}
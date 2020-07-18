/**
 * Replaces the room level details/summary log spam
 */
import { DATETIME_FORMATTER, estimate } from '/lib/time';
import { NUMBER_FORMATTER, to_precision, to_fixed } from '/lib/util';
import { table, html_hsl_span, html_truefalse_span } from '/lib/html';

// @todo not census, census is population. this is an audit or debit/credit type thing
export default function report_census(sort, sortOrder) {
	// Last census timestamp
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
		['text-align: right; color: yellow', 'Upkeep'],				// to_fixed
		['text-align: right; color: yellow', 'Creep'],
		['text-align: right; color: yellow', 'Infrastructure'], 	// Structure decay
		['text-align: right; color: yellow', 'Expense'],			// Other expenses
		['text-align: right; color: white', 'Net'], 				// r/g for positive/negative
		['text-align: right; color: white', 'Stock'], 				// hsl scale
		['text-align: right; color: white', 'Adjusted'],
	];
	const rows = [];
	// Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${to_precision(total, 3)} total (age: ${Game.time - time}) to ${recipient.username} via ${order.type} order`, 'Market');
	/* for (const t of trx) {
		const { time, amount, resourceType, order, from, to, sender, recipient, description } = t;
		if (ordersOnly && !order)
			continue;
		rows.push([
			time,
			`<span style="padding: 0px; color: ${RES_COLORS[resourceType]}">${resourceType}</span>`,
			["style='text-align: right'", amount],
			["style='text-align: right'", (order && to_fixed(order.price, 3)) || '-'],
			["style='text-align: right'", (order && to_fixed(amount * order.price, 3)) || '-'],
			from, to,
			(sender && sender.username) || '-',
			(recipient && recipient.username) || '-',
			_.escape(description) || '-'
		]);
	} */
	const sorted = _.sortByOrder(rows, sort, sortOrder);
	const opts = {
		tdStyle: "td { padding-right: 7px }",
		thStyle: "th { width: 1vw; padding-right: 7px }",
		tableStyle: "width: 60vw; margin-bottom: 5px'",
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	}
	return table(headers, sorted, opts);
}
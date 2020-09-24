import { to_fixed } from '/lib/util';
import { table, html_hsl_span, html_truefalse_span } from '/lib/html';
import { DATETIME_FORMATTER } from '/lib/time';

/**
 * Transaction report
 * 
 * @param {*} type 
 * @param {*} ordersOnly 
 * @param {*} sort 
 * @param {*} sortOrder 
 */
export function market(type = 'I', ordersOnly = true, sort = [0], sortOrder = ['desc']) {
	const trx = (type === 'I') ? Game.market.incomingTransactions : Game.market.outgoingTransactions;
	const headers = ['Tick',
		'Resource',
		['text-align: right', 'Amount'],
		['text-align: right', ' Price'],
		['text-align: right', 'Total'],
		'From', 'To', 'Sender', 'Recipient',
		['width: 8vw', 'Description']
	];
	const rows = [];	
	for (const t of trx) {
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
	}
	const sorted = _.sortByOrder(rows, sort, sortOrder);
	const opts = {
		tdStyle: "td { padding-right: 7px }",
		thStyle: "th { width: 1vw; padding-right: 7px }",
		tableStyle: "width: 60vw; margin-bottom: 5px'",
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	}
	return table(headers, sorted, opts);
}


/**
 * List of current orders
 */
export function orders() {
	const headers = [
		'Tick', 'Resource', 'Active', 'Type',
		['text-align: right', 'Total'],
		['text-align: right', 'Remaining'],
		['text-align: right', 'Completed'],
		['text-align: right', 'Available'],
		['text-align: right', 'Unavailable'],
		'<span>Price</span>',
		'Room', 'Created', 'Id'
	];
	const rows = [];
	for (const order of Object.values(Game.market.orders)) {
		const { createdTimestamp, active, type, amount, remainingAmount, resourceType, price, totalAmount, roomName, created, id } = order;
		rows.push([
			created,
			`<span style="padding: 0px; color: ${RES_COLORS[resourceType]}">${resourceType}</span>`,
			html_truefalse_span(active, active),
			type,
			["style='text-align: right'", totalAmount],
			["style='text-align: right'", remainingAmount],
			["style='text-align: right'", totalAmount - remainingAmount],
			["style='text-align: right'", amount],
			["style='text-align: right'", remainingAmount - amount],
			`<span>${to_fixed(price, 3)}</span>`,
			roomName,
			DATETIME_FORMATTER.format(createdTimestamp),
			id
		]);
	}
	const sorted = _.sortByOrder(rows, [0], ['desc'])
	return table(headers, rows, {
		tableStyle: "width: 90vw; margin-bottom: 5px'",
		thStyle: "th { width: 1vw }",
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	});
}

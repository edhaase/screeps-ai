/** Market.js - Market code that doesn't fit anywhere else */
"use strict";

module.exports = {
	/**
	 * Periodically update our market history and terminal allotments.
	 * @todo Include sender/recipient (recipient isn't always provided)
	 */
	updateMarket: function (freq = 5) {
		this.updateIncomingMarket(freq);
		this.updateOutgoingMarket(freq);
	},

	/**
	 * Outgoing notifications
	 */
	updateOutgoingMarket: function(freq = 5) {
		var outgoing = Game.market.outgoingTransactions;
		var transaction, i, j, len, total, distance;
		for (j = 0, len = outgoing.length; j < len; j++) {
			transaction = outgoing[j];
			if (Game.time - transaction.time > freq)
				break;
			if (transaction.to && _.get(Game.rooms, transaction.to + '.controller.my', false) === true)
				continue;
			let { from, to, resourceType, amount, order, recipient } = transaction;
			distance = Game.map.getRoomLinearDistance(from, to, true);
			if (order && order.price) {
				total = amount * order.price;
				Game.rooms[from].terminal.credits += (total * (1.0 - TERMINAL_TAX));
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${total} total`, 'Market');
			} else {
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType}`, 'Market');
			}
			if (recipient && recipient.username)
				this.updateRecipient(recipient.username, to, transaction);
		}
	},

	/**
	 * Incoming notifications
	 */
	updateIncomingMarket: function(freq = 5) {
		var incoming = Game.market.incomingTransactions;
		var transaction, i, j, len, total, distance, desc;
		for (i = 0, len = incoming.length; i < len; i++) {
			transaction = incoming[i];
			if (Game.time - transaction.time > freq)
				break;
			let { from, to, resourceType, amount, order, sender } = transaction;
			if (transaction.from && _.get(Game.rooms, transaction.from + '.controller.my', false) === true)
				continue;
			distance = Game.map.getRoomLinearDistance(transaction.from, transaction.to, true);
			// var price = (order.price) ? order.price : 'NA';
			desc = _.escape(transaction.description);
			if (order && order.price) {
				total = amount * order.price;
				Game.rooms[to].terminal.credits -= total;
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${total} total (${desc})`, 'Market');
			} else {
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} (${desc})`, 'Market');
			}
			if (sender && sender.username)
				this.updateSender(sender.username, from, transaction);
			// Game.notify("Transaction received: " + JSON.stringify(transaction,null,2));						
		}
	},

	updateSender: function (name, roomName, transaction) {
		Log.info(`Sender info: ${name} in ${roomName}`);
	},

	updateRecipient: function (name, roomName, transaction) {
		Log.info(`Recipient info: ${name} in ${roomName}`);
	}
};
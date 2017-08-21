/**
 * Lindenmayer systems
 * see: https://en.wikipedia.org/wiki/L-system
 *
 * example: new LSystem('A', {B: 'A', A: 'AB'}).iterate(7)
 * example: new LSystem('0', {1: 11,0: '1[0]0'}).iterate(3)
 */
"use strict";

class LSystem {
	constructor(axiom, rules) {
		this.axiom = axiom;
		this.rules = rules;
		this.symbols = _.keys(rules);
		this.state = axiom;
		this.regex = new RegExp(this.symbols.join('|'), 'gi');
		this.iteration = 0;
	}

	iterate(n = 1) {
		if (n > 1)
			this.iterate(n - 1);
		this.iteration++;
		this.state = this.state.replace(this.regex, (m) => this.gen(m));
		return this;
	}

	gen(m) {
		if (Math.random() < 0.5)
			return m;
		return this.rules[m];
	}

	toString() {
		return this.state;
	}
}


module.exports = LSystem;

module.exports.test = function () {
	var l = new LSystem('F', {
		F: 'FF-[-F+F+F]+[+F-F-F]'
	});
	// Example 1: Algae
	// new LSystem('A', {B: 'A', 'A': 'AB'}).iterate(7)
	return l;
};
"use strict";

import clear from "rollup-plugin-clear";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import rootImport from 'rollup-plugin-root-import';
import cleanup from 'rollup-plugin-cleanup';
import { terser } from "rollup-plugin-terser";

export default [{
	input: 'src/main.js',
	preserveModules: false,
	// external: ['prog.js'],
	output: {
		strict: true,
		dir: 'build/',
		format: 'cjs',
		name: 'main',
		exports: 'named'
	},
	plugins: [
		clear({ targets: ["build"] }),
		rootImport({
			root: `${__dirname}/src`,
			useEntry: 'prepend',
			extensions: '.js'
		}),
		resolve({
			preferBuiltins: true
		}),
		commonjs({
			ignoreGlobal: true
		}),
		// terser()
		cleanup()
	]
}];
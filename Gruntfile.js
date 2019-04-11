'use strict';

module.exports = function (grunt) {
	require('time-grunt')(grunt);

	// Pull defaults (including username and password) from .screeps.json
	const config = require('./.screeps.json');

	// Allow grunt options to override default configuration
	const branch = grunt.option('branch') || config.branch;
	const email = grunt.option('email') || config.email;
	const password = grunt.option('password') || config.password;
	const ptr = grunt.option('ptr') ? true : config.ptr;
	const private_directory = grunt.option('private_directory') || config.private_directory;

	const currentdate = new Date();
	grunt.log.subhead(`Task Start: ${currentdate.toLocaleString()}`);
	grunt.log.writeln(`Branch: ${branch}`);

	// Load needed tasks
	grunt.loadNpmTasks('grunt-screeps');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-file-append');
	grunt.loadNpmTasks("grunt-jsbeautifier");
	grunt.loadNpmTasks("grunt-sync");

	grunt.initConfig({
		/** Watch src for changes and update */
		watch: {
			scripts: {
				files: ['src/**/*.js'],
				//  tasks: ['jsbeautifier:verify', 'private'],
				tasks: ['private'],
				options: {
					interrupt: true,
					debounceDelay: 250
				}
			}
		},
		/** Push all files in the dist folder to screeps. What is in the dist folder
		    and gets sent will depend on the tasks used. */
		screeps: {
			options: {
				email: email,
				password: password,
				branch: branch,
				ptr: ptr
			},
			dist: {
				src: ['dist/*.js']
			}
		},

		/** Copy all files */
		copy: {
			// Pushes the game code to the dist folder so it can be modified before
			// being send to the screeps server.
			screeps: {
				files: [{
					expand: true,
					cwd: 'src/',
					src: '**/*.js',
					dest: 'dist/',
					filter: 'isFile',
					rename: function (dest, src) {
						return dest + src.replace(/\//g, '.');
					}
				}],
			}
		},

		/** Push only the relevant file changes */
		sync: {
			private: {
				files: [{
					expand: true,
					cwd: 'dist/',
					src: '**/*.js',
					dest: private_directory,

				}],
				verbose: true,
				updateAndDelete: true,
				compareUsing: "md5"
			}
		},

		/** Add version constiable using current timestamp.  */
		file_append: {
			versioning: {
				files: [
					{
						append: `\nglobal.SCRIPT_VERSION = ${currentdate.getTime()}\n`,
						input: 'dist/version.js',
					}
				]
			}
		},


		/** Remove all files from the dist folder. */
		clean: { 'dist': ['dist'] },

		/** Apply code styling */
		jsbeautifier: {
			modify: {
				src: ["src/**/*.js"],
				options: {
					config: '.jsbeautifyrc'
				}
			},
			verify: {
				src: ["src/**/*.js"],
				options: {
					mode: 'VERIFY_ONLY',
					config: '.jsbeautifyrc'
				}
			}
		}

	});

	// Combine the above into a default task
	grunt.registerTask('default', ['private']);
	grunt.registerTask('private', ['clean', 'copy:screeps', 'file_append:versioning', 'sync:private']);
	grunt.registerTask('publish', ['clean', 'copy:screeps', 'file_append:versioning', 'screeps']);
	grunt.registerTask('test', ['jsbeautifier:verify']);
	grunt.registerTask('pretty', ['jsbeautifier:modify']);
};
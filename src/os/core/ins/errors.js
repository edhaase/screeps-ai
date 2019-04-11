/** os.core.ins.errors.js - Instrumentation errors */
'use strict';

/**
 * Non-configurable properties can not be changed, so any attempts to do so
 * will result in an error
 */
exports.PropertyNotConfigurable = class PropertyNotConfigurable extends Error {

};

exports.InvalidUsage = class InvalidUsage extends Error {

};

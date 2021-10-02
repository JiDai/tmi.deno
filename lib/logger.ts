import * as utils from './utils.ts';

export enum LogLevel {
	'trace',
	'debug',
	'info',
	'warn',
	'error',
	'fatal',
}

let currentLevel = LogLevel.info;

// Logger implementation..
export function log(level: LogLevel) {
	// Return a console message depending on the logging level..
	return function (message: string) {
		if (level >= currentLevel) {
			console.log(`[${utils.formatDate(new Date())}] ${level}: ${message}`);
		}
	};
}

// Change the current logging level..
export function setLevel(level: LogLevel) {
	currentLevel = level;
}
export const trace = log(LogLevel.trace);
export const debug = log(LogLevel.debug);
export const info = log(LogLevel.info);
export const warn = log(LogLevel.warn);
export const error = log(LogLevel.error);
export const fatal = log(LogLevel.fatal);

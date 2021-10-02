/*
 * Copyright Joyent, Inc. and other Node contributors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import BaseClient from './BaseClient.ts';

class EventEmitter {
	static defaultMaxListeners: number = 10;

	private _events: Record<
		string,
		{
			warned?: boolean;
			listeners: Array<Function>;
		}
	> = {};
	private _maxListeners: number = 10;

	constructor(events: any = {}, maxListeners: number = EventEmitter.defaultMaxListeners) {
		this._events = events;
		this._maxListeners = maxListeners;
	}

	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	setMaxListeners(n: number) {
		this._maxListeners = n;

		return this;
	}

	emit(type: string, ...args: Array<unknown>) {
		if (!this._events) {
			this._events = {};
		}

		if (isUndefined(this._events[type])) {
			return false;
		}

		const listeners = this._events[type].listeners;
		for (let i in listeners) {
			listeners[i].apply(this, args);
		}

		return true;
	}

	addListener(type: string, listener: Function) {
		let maxListeners: number;

		if (!isFunction(listener)) {
			throw TypeError('listener must be a function');
		}

		if (!this._events[type]) {
			this._events[type] = {
				warned: false,
				listeners: [],
			};
		}

		// If we've already got an array, just append.
		if (!Array.isArray(this._events[type].listeners)) {
			this._events[type].listeners = [];
		}

		this._events[type].listeners.push(listener);

		// Check for listener leak
		if (!this._events[type].warned) {
			if (!isUndefined(this._maxListeners)) {
				maxListeners = this._maxListeners;
			} else {
				maxListeners = EventEmitter.defaultMaxListeners;
			}

			if (
				maxListeners &&
				maxListeners > 0 &&
				this._events[type].listeners.length > maxListeners
			) {
				this._events[type].warned = true;
				console.error(
					'(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.',
					this._events[type].listeners.length,
				);
			}
		}

		return this;
	}

	// Modified to support multiple calls..
	once(type: string, listener: Function) {
		if (!isFunction(listener)) {
			throw TypeError('listener must be a function');
		}

		var fired = false;

		if (this._events.hasOwnProperty(type) && type.charAt(0) === '_') {
			var count = 1;
			var searchFor = type;

			for (var k in this._events) {
				if (this._events.hasOwnProperty(k) && k.startsWith(searchFor)) {
					count++;
				}
			}
			type = type + count;
		}
		const self = this;

		function g() {
			if (type.charAt(0) === '_' && !isNaN(Number(type.substr(type.length - 1)))) {
				type = type.substring(0, type.length - 1);
			}
			self.removeListener(type, g);

			if (!fired) {
				fired = true;
				listener.apply(self, arguments);
			}
		}

		g.listener = listener;
		this.addListener(type, g);

		return this;
	}

	// Emits a "removeListener" event if the listener was removed..
	// Modified to support multiple calls from .once()..
	removeListener(type: string, listener: Function) {
		if (!isFunction(listener)) {
			throw TypeError('listener must be a function');
		}

		if (!this._events || !this._events[type]) {
			return this;
		}

		const list = this._events[type].listeners;
		const length: number = list.length;
		const position = -1;
		if (length > 0) {
			for (let i in list) {
				if (list[i] === listener) {
					list.splice(Number(i), 1);
				}
			}
		}

		return this;
	}

	removeAllListeners(type?: string) {
		var key, listeners;

		if (!this._events) {
			return this;
		}

		if (!type) {
			this._events = {};
			return this;
		}

		const list = this._events[type].listeners;
		const length: number = list.length;
		const position = -1;
		if (length > 0) {
			for (let i in list) {
				list.splice(Number(i), 1);
			}
		}

		return this;
	}

	listeners(type: string) {
		let ret: Array<Function>;
		if (!this._events || !this._events[type]) {
			ret = [];
		} else {
			ret = this._events[type].listeners;
		}
		return ret;
	}

	listenerCount(type: string) {
		return this.listeners(type).length;
	}
}

function isFunction(arg: unknown) {
	return typeof arg === 'function';
}

function isNumber(arg: unknown) {
	return typeof arg === 'number';
}

function isObject(arg: unknown) {
	return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg: unknown) {
	return arg === void 0;
}

export default EventEmitter;

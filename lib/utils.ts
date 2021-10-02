const actionMessageRegex = /^\u0001ACTION ([^\u0001]+)\u0001$/;
const justinFanRegex = /^(justinfan)(\d+$)/;
const unescapeIRCRegex = /\\([sn:r\\])/g;
const escapeIRCRegex = /([ \n;\r\\])/g;
const ircEscapedChars: Record<string, string> = { s: ' ', n: '', ':': ';', r: '' };
const ircUnescapedChars: Record<string, string> = { ' ': 's', '\n': 'n', ';': ':', '\r': 'r' };

// Return the second value if the first value is undefined..
export function get(a: unknown, b: unknown) {
	return typeof a === 'undefined' ? b : a;
}

// Race a promise against a delay..
export function promiseDelay<T>(time: number): Promise<typeof setTimeout> {
	// @ts-ignore
	return new Promise((resolve) => setTimeout(resolve, time));
}

// Value is a finite number..
export function isFinite(int: string | number): boolean {
	return isFinite(int as number) && !isNaN(parseFloat(int as string));
}

// Parse string to number. Returns NaN if string can't be parsed to number..
export function toNumber(num: string, precision: number): number {
	const factor = Math.pow(10, isFinite(precision) ? precision : 0);
	return Math.round(Number(num) * factor) / factor;
}

// Value is an integer..
export function isInteger(int: string): boolean {
	return !isNaN(toNumber(int, 0));
}

// Merge two arrays..
export function union<A, B>(a: Array<A>, b: Array<B>): Array<A | B> {
	// @ts-ignore
	return [...new Set([...a, ...b])];
}

// Value is a regex..
export function isRegex(str: string): boolean {
	return /[|\\^$*+?:#]/.test(str);
}

// Value is a valid url..
export function isURL(str: string): boolean {
	return new RegExp(
		'^(?:(?:https?|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?!(?:10|127)(?:\\.\\d{1,3}){3})(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))\\.?)(?::\\d{2,5})?(?:[/?#]\\S*)?$',
		'i',
	).test(str);
}

// Return a random justinfan username..
export function justinfan(): string {
	return `justinfan${Math.floor(Math.random() * 80000 + 1000)}`;
}

// Username is a justinfan username..
export function isJustinfan(username: string): boolean {
	return justinFanRegex.test(username);
}

// Return a valid channel name..
export function channel(str: string): string {
	const channel = (str ? str : '').toLowerCase();
	return channel[0] === '#' ? channel : '#' + channel;
}

// Return a valid username..
export function username(str: string): string {
	const username = (str ? str : '').toLowerCase();
	return username[0] === '#' ? username.slice(1) : username;
}

// Return a valid token..
export function gettoken(str: string): string {
	return str ? str.toLowerCase().replace('oauth:', '') : '';
}

// Return a valid password..
export function password(str: string): string {
	const token: string = gettoken(str);
	return token ? `oauth:${token}` : '';
}

export function actionMessage(msg: string): RegExpMatchArray | null {
	return msg.match(actionMessageRegex);
}

// Replace all occurences of a string using an object..
export function replaceAll(str: string, obj: Record<string, string>): string {
	for (const x in obj) {
		str = str.replace(new RegExp(x, 'g'), obj[x]);
	}
	return str;
}

export function unescapeHtml(safe: string): string {
	return safe
		.replace(/\\&amp\\;/g, '&')
		.replace(/\\&lt\\;/g, '<')
		.replace(/\\&gt\\;/g, '>')
		.replace(/\\&quot\\;/g, '"')
		.replace(/\\&#039\\;/g, "'");
}

// Escaping values:
// http://ircv3.net/specs/core/message-tags-3.2.html#escaping-values
export function unescapeIRC(msg: string): string {
	if (!msg.includes('\\')) {
		return msg;
	}
	return msg.replace(unescapeIRCRegex, (m, p) => (p in ircEscapedChars ? ircEscapedChars[p] : p));
}

export function escapeIRC(msg: string): string {
	return msg.replace(escapeIRCRegex, (m, p) =>
		p in ircUnescapedChars ? `\\${ircUnescapedChars[p]}` : p,
	);
}

// Add word to a string..
export function addWord(line: string, word: string): string {
	return line.length ? line + ' ' + word : line + word;
}

// Split a line but try not to cut a word in half..
export function splitLine(input: string, length: number): [string, string] {
	let lastSpace = input.substring(0, length).lastIndexOf(' ');
	// No spaces found, split at the very end to avoid a loop..
	if (lastSpace === -1) {
		lastSpace = length - 1;
	}
	return [input.substring(0, lastSpace), input.substring(lastSpace + 1)];
}

// Extract a number from a string..
export function extractNumber(str: string): number {
	const parts: Array<string> = str.split(' ');
	for (let i = 0; i < parts.length; i++) {
		if (isInteger(parts[i])) {
			return ~~parts[i];
		}
	}
	return 0;
}

// Format the date..
export function formatDate(date: Date): string {
	let hours = date.getHours();
	let mins = date.getMinutes();

	const hoursString = `${hours < 10 ? '0' : ''}${hours}`;
	const minsString = `${mins < 10 ? '0' : ''}${mins}`;
	return `${hours}:${mins}`;
}

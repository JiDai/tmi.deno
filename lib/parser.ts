/*
	Copyright (c) 2013-2015, Fionn Kelleher All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

		Redistributions of source code must retain the above copyright notice,
		this list of conditions and the following disclaimer.

		Redistributions in binary form must reproduce the above copyright notice,
		this list of conditions and the following disclaimer in the documentation and/or other materials
		provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
	IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
	INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
	OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
	WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
	ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
	OF SUCH DAMAGE.
*/
import * as utils from './utils.ts';
import { Message } from '../types/Message.ts';

const nonspaceRegex = /\S+/g;

function parseComplexTag(
	tags: Record<string, string>,
	tagKey: string,
	splA = ',',
	splB = '/',
	splC?: string,
): Message['tags'] {
	const rawTagValue = tags[tagKey];

	if (rawTagValue === undefined) {
		return tags;
	}

	tags[`${tagKey}-raw`] = rawTagValue;

	const newTags: Message['tags'] = {};

	const spl: Array<string> = rawTagValue.split(splA);

	for (let i = 0; i < spl.length; i++) {
		const parts = spl[i].split(splB);
		let [, val] = parts;

		if (splC !== undefined && val) {
			newTags[parts[0]] = val.split(splC);
		} else {
			newTags[parts[0]] = val;
		}
	}

	return newTags;
}

// Parse Twitch badges..
export function badges(tags: Record<string, string>): Message['tags'] {
	return parseComplexTag(tags, 'badges');
}

// Parse Twitch badge-info..
export function badgeInfo(tags: Record<string, string>): Message['tags'] {
	return parseComplexTag(tags, 'badge-info');
}

// Parse Twitch emotes..
export function emotes(tags: Record<string, string>): Message['tags'] {
	return parseComplexTag(tags, 'emotes', '/', ':', ',');
}

// Parse regex emotes..
export function emoteRegex(
	msg: string,
	code: string,
	id: string,
	obj: Record<string, Array<[number, number]>>,
) {
	nonspaceRegex.lastIndex = 0;
	const regex = new RegExp('(\\b|^|\\s)' + utils.unescapeHtml(code) + '(\\b|$|\\s)');
	let match;

	// Check if emote code matches using RegExp and push it to the object..
	while ((match = nonspaceRegex.exec(msg)) !== null) {
		if (regex.test(match[0])) {
			obj[id] = obj[id] || [];
			obj[id].push([match.index, nonspaceRegex.lastIndex - 1]);
		}
	}
}

// Parse string emotes..
export function emoteString(
	msg: string,
	code: string,
	id: string,
	obj: Record<string, Array<[number, number]>>,
) {
	nonspaceRegex.lastIndex = 0;
	let match;

	// Check if emote code matches and push it to the object..
	while ((match = nonspaceRegex.exec(msg)) !== null) {
		if (match[0] === utils.unescapeHtml(code)) {
			obj[id] = obj[id] || [];
			obj[id].push([match.index, nonspaceRegex.lastIndex - 1]);
		}
	}
}

// Transform the emotes object to a string with the following format..
// emote_id:first_index-last_index,another_first-another_last/another_emote_id:first_index-last_index
export function transformEmotes(emotes: Record<string, Array<[number, number]>>): string {
	let transformed = '';

	Object.keys(emotes).forEach((id) => {
		transformed = `${transformed}${id}:`;
		emotes[id].forEach((index) => (transformed = `${transformed + index.join('-')},`));
		transformed = `${transformed.slice(0, -1)}/`;
	});
	return transformed.slice(0, -1);
}
//
// export function formTags(tags) {
// 	const result = [];
// 	for (const key in tags) {
// 		const value = utils.escapeIRC(tags[key]);
// 		result.push(`${key}=${value}`);
// 	}
// 	return `@${result.join(';')}`;
// }

// Parse Twitch messages..
export function msg(data: string) {
	const message: Message = {
		raw: data,
		tags: {},
		prefix: null,
		command: null,
		params: [],
	};

	// Position and nextspace are used by the parser as a reference..
	let position = 0;
	let nextspace = 0;

	// The first thing we check for is IRCv3.2 message tags.
	// http://ircv3.atheme.org/specification/message-tags-3.2
	if (data.charCodeAt(0) === 64) {
		nextspace = data.indexOf(' ');

		// Malformed IRC message..
		if (nextspace === -1) {
			return null;
		}

		// Tags are split by a semi colon..
		const rawTags = data.slice(1, nextspace).split(';');
		const tagPairs: Record<string, string> = {};

		for (let i = 0; i < rawTags.length; i++) {
			// Tags delimited by an equals sign are key=value tags.
			// If there's no equals, we assign the tag a value of true.
			const tag = rawTags[i];
			const [key, value] = tag.split('=');
			tagPairs[key] = value;
		}

		message.tags = {
			...tagPairs,
			...badges(tagPairs),
			...badgeInfo(tagPairs),
			...emotes(tagPairs),
		};

		position = nextspace + 1;
	}

	// Skip any trailing whitespace..
	while (data.charCodeAt(position) === 32) {
		position++;
	}

	// Extract the message's prefix if present. Prefixes are prepended with a colon..
	if (data.charCodeAt(position) === 58) {
		nextspace = data.indexOf(' ', position);

		// If there's nothing after the prefix, deem this message to be malformed.
		if (nextspace === -1) {
			return null;
		}

		message.prefix = data.slice(position + 1, nextspace);
		position = nextspace + 1;

		// Skip any trailing whitespace..
		while (data.charCodeAt(position) === 32) {
			position++;
		}
	}

	nextspace = data.indexOf(' ', position);

	// If there's no more whitespace left, extract everything from the
	// current position to the end of the string as the command..
	if (nextspace === -1) {
		if (data.length > position) {
			message.command = data.slice(position);
			return message;
		}
		return null;
	}

	// Else, the command is the current position up to the next space. After
	// that, we expect some parameters.
	message.command = data.slice(position, nextspace);

	position = nextspace + 1;

	// Skip any trailing whitespace..
	while (data.charCodeAt(position) === 32) {
		position++;
	}

	while (position < data.length) {
		nextspace = data.indexOf(' ', position);

		// If the character is a colon, we've got a trailing parameter.
		// At this point, there are no extra params, so we push everything
		// from after the colon to the end of the string, to the params array
		// and break out of the loop.
		if (data.charCodeAt(position) === 58) {
			message.params.push(data.slice(position + 1));
			break;
		}

		// If we still have some whitespace...
		if (nextspace !== -1) {
			// Push whatever's between the current position and the next
			// space to the params array.
			message.params.push(data.slice(position, nextspace));
			position = nextspace + 1;

			// Skip any trailing whitespace and continue looping.
			while (data.charCodeAt(position) === 32) {
				position++;
			}

			continue;
		}

		// If we don't have any more whitespace and the param isn't trailing,
		// push everything remaining to the params array.
		if (nextspace === -1) {
			message.params.push(data.slice(position));
			break;
		}
	}
	return message;
}

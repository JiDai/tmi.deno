# tmi.deno

This is a very work in progress port of [tmi.js](https://github.com/tmijs/tmi.js) for Deno. It is working but not well tested. 

## Usage

```ts
import { Client } from './mod.ts';

const client = new Client({
	connection: {
		secure: true,
		server: 'irc-ws.chat.twitch.tv',
	},
	identity: {
		username: '<BOT_USERNAME>',
		password: '<OAUTH_TOKEN>',
	},
	channels: ['<YOUR_CHANNEL>'],
});

try {
	client.connect();
} catch (e) {
	console.log(e);
}
```

## TODO

- Finish tests
- Tests :) 

## Contributing guidelines

Please review the [guidelines for contributing](https://github.com/tmijs/tmi.js/blob/master/CONTRIBUTING.md) of the [tmi.js repository](https://github.com/JiDai/tmi.deno). We reserve the right to refuse a Pull Request if it does not meet the requirements.

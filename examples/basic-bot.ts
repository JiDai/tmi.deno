import { Client } from '../mod.ts';
import { config } from 'https://deno.land/x/dotenv/mod.ts';

const env = config();

/**
 * Fill a .env file to make it work with these variables/values
 */
const {
	BOT_USERNAME, // The bot
	OAUTH_TOKEN, // The token of the bot account
	CHANNEL_NAME, // The channel to join
} = env

async function main() {
	const client = new Client({
		connection: {
			secure: true,
			server: 'irc-ws.chat.twitch.tv',
		},
		options: { debug: true },
		identity: {
			username: BOT_USERNAME,
			password: OAUTH_TOKEN,
		},
		channels: [CHANNEL_NAME],
	});

	try {
		await client.connect();
	} catch (e) {
		console.log(e);
	}
}

main();

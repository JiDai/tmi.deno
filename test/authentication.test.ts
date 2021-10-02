import { assertEquals, assert } from "https://deno.land/std/testing/asserts.ts";
import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.3/mod.ts";

import { Client } from "../mod.ts";

const noop = function() {
};

const catchConnectError = (err: string) => {
	const errors = [
		"Connection closed.",
		"Login unsuccessful.",
		"Error logging in.",
		"Invalid NICK.",
	];
	// if (!errors.includes(err)) {
	// 	console.error(err);
	// }
};

const tests = [
	":tmi.twitch.tv NOTICE #schmoopiie :Login unsuccessful.",
	":tmi.twitch.tv NOTICE #schmoopiie :Error logging in.",
	":tmi.twitch.tv NOTICE #schmoopiie :Invalid NICK.",
];

for (const test of tests) {
	const parts = test.split(":");
	const message = parts[parts.length - 1].trim();

	Deno.test(`Authentification ${message}`, async (t) => {
		// Initialize websocket server
		const wsPort = 7033;

		const server: WebSocketServer = new WebSocketServer(wsPort);
		let client: Client | null = new Client({
			// @ts-ignore
			logger: {
				error: noop,
				info: noop,
			},
			connection: {
				server: "localhost",
				port: wsPort,
				timeout: 1,
			},
		});

		await t.step('handle message properly', async function() {
			server.on("connection", (ws) => {
				ws.on("message", (message: string) => {
					if (!message.indexOf("NICK")) {
						ws.send(test);
					}
				});
			});

			await new Promise(resolve => {
				client!.once("disconnected", (reason: string) => {
					resolve(true);
					assertEquals(reason, message);
				});

				client!.connect().catch(catchConnectError);
			});
		});

		server.close();
		client = null;
	});
}

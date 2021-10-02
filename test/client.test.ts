import { Rhum } from 'https://deno.land/x/rhum@v1.1.11/mod.ts';

import { Client } from '../index.ts';

Rhum.testPlan('Client', () => {
	Rhum.testSuite('client()', () => {
		Rhum.testCase("uses the 'info' log when debug is set", () => {
			const client = new Client({ options: { debug: true } });
			Rhum.asserts.assert(client);
		});

		Rhum.testCase('normalize channel names', () => {
			const client = new Client({ channels: ['avalonstar', '#dayvemsee'] });
			Rhum.asserts.assertEquals(client.config.channels, ['#avalonstar', '#dayvemsee']);
		});

		Rhum.testCase(
			'should default secure to true when opts.connection.server and opts.connection.port not set',
			() => {
				let client = new Client();
				Rhum.asserts.assertEquals(client.secure, true);
				client = new Client({ connection: {} });
				Rhum.asserts.assertEquals(client.secure, true);
			},
		);
		Rhum.testCase(
			'should default secure to false when opts.connection.server or opts.connection.port set',
			() => {
				let client = new Client({ connection: { server: 'localhost' } });
				Rhum.asserts.assertEquals(client.secure, false);
				client = new Client({ connection: { port: 1 } });
				Rhum.asserts.assertEquals(client.secure, false);
				client = new Client({ connection: { server: 'localhost', port: 1 } });
				Rhum.asserts.assertEquals(client.secure, false);
			},
		);

		Rhum.testCase('client getters gets options', () => {
			const opts = { options: { debug: true } };
			const client = new Client(opts);
			Rhum.asserts.assertEquals(client.getOptions(), opts);
		});

		Rhum.testCase('client getters gets channels', () => {
			const client = new Client();
			Rhum.asserts.assertEquals(client.getChannels(), []);
		});
	});
});

Rhum.run();

import * as utils from './utils.ts';
import BaseClient from './BaseClient.ts';
import { BaseClientConfiguration } from '../types/BaseClientConfiguration.ts';

class Client extends BaseClient {
	followersmode: typeof Client.prototype.followersonly;
	followersmodeoff: typeof Client.prototype.followersonlyoff;
	leave: typeof Client.prototype.part;
	r9kmode: typeof Client.prototype.r9kbeta;
	r9kmodeoff: typeof Client.prototype.r9kbetaoff;
	slowmode: typeof Client.prototype.slow;
	slowmodeoff: typeof Client.prototype.slowoff;

	constructor(clientConfiguration: BaseClientConfiguration) {
		super(clientConfiguration);

		// Aliases
		this.followersmode = this.followersonly;
		this.followersmodeoff = this.followersonlyoff;
		this.leave = this.part;
		this.r9kmode = this.r9kbeta;
		this.r9kmodeoff = this.r9kbetaoff;
		this.slowmode = this.slow;
		this.slowmodeoff = this.slowoff;
	}

	// Send action message (/me <message>) on a channel..
	action(channel: string, message: string) {
		channel = utils.channel(channel);
		message = `\u0001ACTION ${message}\u0001`;
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendMessage(this._getPromiseDelay(), channel, message, (resolve, _reject) => {
			// At this time, there is no possible way to detect if a message has been sent has been eaten
			// by the server, so we can only resolve the Promise.
			resolve([channel, message]);
		});
	}

	// Ban username on channel..
	ban(channel: string, username: string, reason: string) {
		channel = utils.channel(channel);
		username = utils.username(username);
		reason = reason || '';
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/ban ${username} ${reason}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseBan event, resolve or reject..
				this.once('_promiseBan', (err: Error) => {
					if (!err) {
						resolve([channel, username, reason]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Clear all messages on a channel..
	clear(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(this._getPromiseDelay(), channel, '/clear', (resolve, reject) => {
			// Received _promiseClear event, resolve or reject..
			this.once('_promiseClear', (err: Error) => {
				if (!err) {
					resolve([channel]);
				} else {
					reject(err);
				}
			});
		});
	}

	// Change the color of your username..
	color(channel: string, newColor: string) {
		newColor = newColor || channel;
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			'#tmijs',
			`/color ${newColor}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseColor event, resolve or reject..
				this.once('_promiseColor', (err: Error) => {
					if (!err) {
						resolve([newColor]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Run commercial on a channel for X seconds..
	commercial(channel: string, seconds: number) {
		channel = utils.channel(channel);
		seconds = seconds || 30;
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/commercial ${seconds}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseCommercial event, resolve or reject..
				this.once('_promiseCommercial', (err: Error) => {
					if (!err) {
						resolve([channel, ~~seconds]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Delete a specific message on a channel
	deletemessage(channel: string, messageUUID: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/delete ${messageUUID}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseDeletemessage event, resolve or reject..
				this.once('_promiseDeletemessage', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Enable emote-only mode on a channel..
	emoteonly(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			'/emoteonly',
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseEmoteonly event, resolve or reject..
				this.once('_promiseEmoteonly', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Disable emote-only mode on a channel..
	emoteonlyoff(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			'/emoteonlyoff',
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseEmoteonlyoff event, resolve or reject..
				this.once('_promiseEmoteonlyoff', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Enable followers-only mode on a channel..
	followersonly(channel: string, minutes: number) {
		channel = utils.channel(channel);
		minutes = minutes || 30;
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/followers ${minutes}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseFollowers event, resolve or reject..
				this.once('_promiseFollowers', (err: Error) => {
					if (!err) {
						resolve([channel, ~~minutes]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Disable followers-only mode on a channel..
	followersonlyoff(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			'/followersoff',
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseFollowersoff event, resolve or reject..
				this.once('_promiseFollowersoff', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Host a channel..
	host(channel: string, target: string) {
		channel = utils.channel(channel);
		target = utils.username(target);
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(2000, channel, `/host ${target}`, (resolve, reject) => {
			// Received _promiseHost event, resolve or reject..
			this.once('_promiseHost', (err: Error, ...remaining: any) => {
				if (!err) {
					resolve([channel, target, ...remaining]);
				} else {
					reject(err);
				}
			});
		});
	}

	// Join a channel..
	join(channel: string): Promise<[string]> {
		channel = utils.channel(channel);
		// Send the command to the server ..
		// @ts-ignore
		return this._sendCommand(0, null, `JOIN ${channel}`, (resolve, reject) => {
			const eventName = '_promiseJoin';
			let hasFulfilled = false;
			const listener = (err: Error, joinedChannel: string) => {
				if (channel === utils.channel(joinedChannel)) {
					// Received _promiseJoin event for the target channel, resolve or reject..
					this.removeListener(eventName, listener);
					hasFulfilled = true;
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				}
			};
			this.addListener(eventName, listener);
			// Race the Promise against a delay..
			const delay = this._getPromiseDelay();
			utils.promiseDelay(delay).then(() => {
				if (!hasFulfilled) {
					this.emit(eventName, 'No response from Twitch.', channel);
				}
			});
		});
	}

	// Mod username on channel..
	mod(channel: string, username: string) {
		channel = utils.channel(channel);
		username = utils.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/mod ${username}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseMod event, resolve or reject..
				this.once('_promiseMod', (err: Error) => {
					if (!err) {
						resolve([channel, username]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Get list of mods on a channel..
	mods(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			'/mods',
			(resolve: Function, reject: Function) => {
				// Received _promiseMods event, resolve or reject..
				this.once('_promiseMods', (err: Error, mods: Array<string>) => {
					if (!err) {
						// Update the internal list of moderators..
						mods.forEach((username) => {
							if (!this.moderators[channel]) {
								this.moderators[channel] = [];
							}
							if (!this.moderators[channel].includes(username)) {
								this.moderators[channel].push(username);
							}
						});
						resolve(mods);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Leave a channel..
	part(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			null,
			`PART ${channel}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promisePart event, resolve or reject..
				this.once('_promisePart', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Send a ping to the server..
	ping() {
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(this._getPromiseDelay(), null, 'PING', (resolve, _reject) => {
			// Update the internal ping timeout check interval..
			this.latency = new Date();
			this.pingTimeout = setTimeout(() => {
				if (this.ws !== null) {
					this.wasCloseCalled = false;
					this.log.error('Ping timeout.');
					this.ws.close();

					clearInterval(this.pingLoop);
					clearTimeout(this.pingTimeout);
				}
			}, this.config.connection?.timeout || 9999);

			// Received _promisePing event, resolve or reject..
			this.once('_promisePing', (latency: string) => resolve([parseFloat(latency)]));
		});
	}

	// Enable R9KBeta mode on a channel..
	r9kbeta(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(this._getPromiseDelay(), channel, '/r9kbeta', (resolve, reject) => {
			// Received _promiseR9kbeta event, resolve or reject..
			this.once('_promiseR9kbeta', (err: Error) => {
				if (!err) {
					resolve([channel]);
				} else {
					reject(err);
				}
			});
		});
	}

	// Disable R9KBeta mode on a channel..
	r9kbetaoff(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			'/r9kbetaoff',
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseR9kbetaoff event, resolve or reject..
				this.once('_promiseR9kbetaoff', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Send a raw message to the server..
	raw(message: string) {
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(this._getPromiseDelay(), null, message, (resolve, _reject) => {
			resolve([message]);
		});
	}

	// Send a message on a channel..
	say(channel: string, message: string) {
		channel = utils.channel(channel);

		if (
			(message.startsWith('.') && !message.startsWith('..')) ||
			message.startsWith('/') ||
			message.startsWith('\\')
		) {
			// Check if the message is an action message..
			if (message.substr(1, 3) === 'me ') {
				return this.action(channel, message.substr(4));
			} else {
				// Send the command to the server and race the Promise against a delay..
				return this._sendCommand(
					this._getPromiseDelay(),
					channel,
					message,
					// @ts-ignore
					(resolve, _reject) => {
						// At this time, there is no possible way to detect if a message has been sent has been eaten
						// by the server, so we can only resolve the Promise.
						resolve([channel, message]);
					},
				);
			}
		}
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendMessage(this._getPromiseDelay(), channel, message, (resolve, _reject) => {
			// At this time, there is no possible way to detect if a message has been sent has been eaten
			// by the server, so we can only resolve the Promise.
			resolve([channel, message]);
		});
	}

	// Enable slow mode on a channel..
	slow(channel: string, seconds: number) {
		channel = utils.channel(channel);
		seconds = seconds || 300;
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/slow ${seconds}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseSlow event, resolve or reject..
				this.once('_promiseSlow', (err: Error) => {
					if (!err) {
						resolve([channel, ~~seconds]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Disable slow mode on a channel..
	slowoff(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(this._getPromiseDelay(), channel, '/slowoff', (resolve, reject) => {
			// Received _promiseSlowoff event, resolve or reject..
			this.once('_promiseSlowoff', (err: Error) => {
				if (!err) {
					resolve([channel]);
				} else {
					reject(err);
				}
			});
		});
	}

	// Enable subscribers mode on a channel..
	subscribers(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			'/subscribers',
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseSubscribers event, resolve or reject..
				this.once('_promiseSubscribers', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Disable subscribers mode on a channel..
	subscribersoff(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			'/subscribersoff',
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseSubscribersoff event, resolve or reject..
				this.once('_promiseSubscribersoff', (err: Error) => {
					if (!err) {
						resolve([channel]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Timeout username on channel for X seconds..
	timeout(channel: string, username: string, seconds: number, reason: string) {
		channel = utils.channel(channel);
		username = utils.username(username);

		if (seconds) {
			reason = String(seconds);
			seconds = 300;
		}

		seconds = seconds || 300;
		reason = reason || '';
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/timeout ${username} ${seconds} ${reason}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseTimeout event, resolve or reject..
				this.once('_promiseTimeout', (err: Error) => {
					if (!err) {
						resolve([channel, username, ~~seconds, reason]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Unban username on channel..
	unban(channel: string, username: string) {
		channel = utils.channel(channel);
		username = utils.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/unban ${username}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseUnban event, resolve or reject..
				this.once('_promiseUnban', (err: Error) => {
					if (!err) {
						resolve([channel, username]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// End the current hosting..
	unhost(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(2000, channel, '/unhost', (resolve, reject) => {
			// Received _promiseUnhost event, resolve or reject..
			this.once('_promiseUnhost', (err: Error) => {
				if (!err) {
					resolve([channel]);
				} else {
					reject(err);
				}
			});
		});
	}

	// Unmod username on channel..
	unmod(channel: string, username: string) {
		channel = utils.channel(channel);
		username = utils.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/unmod ${username}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseUnmod event, resolve or reject..
				this.once('_promiseUnmod', (err: Error) => {
					if (!err) {
						resolve([channel, username]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Unvip username on channel..
	unvip(channel: string, username: string) {
		channel = utils.channel(channel);
		username = utils.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/unvip ${username}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseUnvip event, resolve or reject..
				this.once('_promiseUnvip', (err: Error) => {
					if (!err) {
						resolve([channel, username]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Add username to VIP list on channel..
	vip(channel: string, username: string) {
		channel = utils.channel(channel);
		username = utils.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			channel,
			`/vip ${username}`,
			// @ts-ignore
			(resolve, reject) => {
				// Received _promiseVip event, resolve or reject..
				this.once('_promiseVip', (err: Error) => {
					if (!err) {
						resolve([channel, username]);
					} else {
						reject(err);
					}
				});
			},
		);
	}

	// Get list of VIPs on a channel..
	vips(channel: string) {
		channel = utils.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		// @ts-ignore
		return this._sendCommand(this._getPromiseDelay(), channel, '/vips', (resolve, reject) => {
			// Received _promiseVips event, resolve or reject..
			this.once('_promiseVips', (err: Error, vips: string) => {
				if (!err) {
					resolve(vips);
				} else {
					reject(err);
				}
			});
		});
	}

	// Send an whisper message to a user..
	whisper(username: string, message: string) {
		username = utils.username(username);

		// The server will not send a whisper to the account that sent it.
		if (username === this.getUsername()) {
			return Promise.reject('Cannot send a whisper to the same account.');
		}
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(
			this._getPromiseDelay(),
			'#tmijs',
			`/w ${username} ${message}`,
			// @ts-ignore
			(_resolve, reject) => {
				this.once('_promiseWhisper', (err: Error) => {
					if (err) {
						reject(err);
					}
				});
			},
		).catch((err: Error | string) => {
			// Either an "actual" error occured or the timeout triggered
			// the latter means no errors have occured and we can resolve
			// else just elevate the error
			if (err && typeof err === 'string' && err.indexOf('No response from Twitch.') !== 0) {
				throw err;
			}
			const from = utils.channel(username);
			const userstate = Object.assign(
				{
					'message-type': 'whisper',
					'message-id': null,
					'thread-id': null,
					username: this.getUsername(),
				},
				this.globaluserstate,
			);

			// Emit for both, whisper and message..
			this.emits(
				['whisper', 'message'],
				[
					[from, userstate, message, true],
					[from, userstate, message, true],
				],
			);
			return [username, message];
		});
	}
}

export default Client;

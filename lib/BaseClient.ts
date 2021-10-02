import { EventEmitter } from 'https://deno.land/std@0.92.0/node/events.ts';

import * as logger from './logger.ts';
import * as parse from './parser.ts';
import Queue from './timer.ts';
import * as utils from './utils.ts';
import { BaseClientConfiguration } from '../types/BaseClientConfiguration.ts';
import { Emote } from '../types/Emote.ts';
import { Message } from '../types/Message.ts';
import { LogLevel } from './logger.ts';

const DEFAULT_IRC_SERVER = 'irc-ws.chat.twitch.tv';
const API_BASE_URL = 'https://api.twitch.tv/kraken';
const TMI_DOMAIN = 'tmi.twitch.tv';

abstract class ClientImplementation {
	// abstract action(channel: string, message: string): void;
	//
	// ban(channel: string, username: string, reason): void;
	//
	// clear(channel: string): void;
	//
	// color(channel: string, newColor): void;
	//
	// commercial(channel: string, seconds): void;
	//
	// deletemessage(channel: string, messageUUID: string): void;
	//
	// emoteonly(channel: string): void;
	//
	// emoteonlyoff(channel: string): void;
	//
	// followersonly(channel: string, minutes): void;
	//
	// followersmode(channel: string, minutes): void;
	//
	// followersonlyoff(channel: string): void;
	//
	// followersmodeoff(channel: string): void;
	//
	// host(channel: string, target): void;
	//
	abstract join(channel: string): void;
	//
	// mod(channel: string, username: string): void;
	//
	// mods(channel: string): void;
	//
	// ping(): void;
	//
	// part(channel: string): void;
	//
	// leave(channel: string): void;
	//
	// r9kbeta(channel: string): void;
	//
	// r9kmode(channel: string): void;
	//
	// r9kbetaoff(channel: string): void;
	//
	// r9kmodeoff(channel: string): void;
	//
	// raw(message: string): void;
	//
	// say(channel: string, message: string): void;
	//
	// slow(channel: string, seconds): void;
	//
	// slowmode(channel: string, seconds): void;
	//
	// slowoff(channel: string): void;
	//
	// slowmodeoff(channel: string): void;
	//
	// subscribers(channel: string): void;
	//
	// subscribersoff(channel: string): void;
	//
	// timeout(channel: string, username: string, seconds, reason): void;
	//
	// unban(channel: string, username: string): void;
	//
	// unhost(channel: string): void;
	//
	// unmod(channel: string, username: string): void;
	//
	// unvip(channel: string, username: string): void;
	//
	// vip(channel: string, username: string): void;
	//
	// vips(channel: string): void;
	//
	// whisper(username: string, message: string): void;
}

// Client instance..
class BaseClient extends EventEmitter implements ClientImplementation {
	config: BaseClientConfiguration;

	clientId?: number;
	private _globalDefaultChannel: string;
	private _skipMembership: boolean;
	private _skipUpdatingEmotesets: boolean;
	private _updateEmotesetsTimer: ReturnType<typeof setInterval> = 0;
	private _updateEmotesetsTimerDelay: number;

	maxReconnectAttempts: number;
	maxReconnectInterval: number;
	reconnect: boolean;
	reconnectDecay: number;
	reconnectInterval: number;

	reconnecting: boolean;
	reconnections: number;
	reconnectTimer: number;

	secure: boolean;

	emotes: string = '';
	emotesets: Record<any, any>;

	channels: Array<string>;
	currentLatency: number;
	globaluserstate: Record<any, any>;
	lastJoined: string;
	latency: Date;
	moderators: Record<any, any>;
	pingLoop: number = 0;
	pingTimeout: number = 0;
	reason: string = '';
	username: string;
	userstate: Record<any, any>;
	wasCloseCalled: boolean;
	ws: WebSocket | null;

	server: string = DEFAULT_IRC_SERVER;
	port: number = 80;

	log: Console;

	constructor(config = {}) {
		super();

		this.config = config;
		this.config.channels = this.config.channels || [];
		this.config.connection = this.config.connection || {};
		this.config.identity = this.config.identity || {};
		this.config.options = this.config.options || {};

		this.clientId = this.config.options.clientId;
		this._globalDefaultChannel = utils.channel(
			this.config.options.globalDefaultChannel || '#tmijs',
		);
		this._skipMembership = this.config.options.skipMembership || false;
		this._skipUpdatingEmotesets = this.config.options.skipUpdatingEmotesets || false;
		this._updateEmotesetsTimer = 0;
		this._updateEmotesetsTimerDelay = this.config.options.updateEmotesetsTimer || 60000;

		this.maxReconnectAttempts = this.config.connection.maxReconnectAttempts || Infinity;
		this.maxReconnectInterval = this.config.connection.maxReconnectInterval || 30000;
		this.reconnect = this.config.connection.reconnect || true;
		this.reconnectDecay = this.config.connection.reconnectDecay || 1.5;
		this.reconnectInterval = this.config.connection.reconnectInterval || 1000;

		this.reconnecting = false;
		this.reconnections = 0;
		this.reconnectTimer = this.reconnectInterval;

		this.secure =
			this.config.connection.secure ||
			(!this.config.connection.server && !this.config.connection.port);

		// Raw data and object for emote-sets..
		this.emotes = '';
		this.emotesets = {};

		this.channels = [];
		this.currentLatency = 0;
		this.globaluserstate = {};
		this.lastJoined = '';
		this.latency = new Date();
		this.moderators = {};
		this.pingLoop = 0;
		this.pingTimeout = 0;
		this.reason = '';
		this.username = '';
		this.userstate = {};
		this.wasCloseCalled = false;
		this.ws = null;

		// Create the logger..
		let level = LogLevel.error;
		if (this.config.options.debug) {
			level = LogLevel.info;
		}
		this.log = (this.config.logger || logger) as Console;

		try {
			logger.setLevel(level);
		} catch (err) {}

		// Format the channel names..
		this.config.channels.forEach(
			(part, index, theArray) => (theArray[index] = utils.channel(part)),
		);

		this.setMaxListeners(0);
	}

	getWS() {
		if (this.ws) {
			return this.ws;
		}
		return this._openConnection();
	}

	// Emit multiple events..
	emits(types: Array<string>, values: Array<any>) {
		for (let i = 0; i < types.length; i++) {
			const val = i < values.length ? values[i] : values[values.length - 1];
			this.emit(types[i], ...val);
		}
	}

	// Handle parsed chat server message..
	handleMessage(rawMessage: string) {
		const message = parse.msg(rawMessage);
		if (!message) {
			return;
		}

		if (this.listenerCount('raw_message')) {
			this.emit('raw_message', JSON.parse(JSON.stringify(message)), message);
		}

		const channel = utils.channel(message.params[0]);
		let msg: string | null = message.params[1] || null;
		const msgid: string | null = (message.tags['msg-id'] as string) || null;

		// Parse badges, badge-info and emotes..
		const tags = message.tags;

		// Transform IRCv3 tags..
		for (const key in tags) {
			if (key === 'emote-sets' || key === 'ban-duration' || key === 'bits') {
				continue;
			}
			let value = tags[key];
			if (typeof value === 'boolean') {
				// @ts-ignore
				value = null;
			} else if (value === '1') {
				// @ts-ignore
				value = true;
			} else if (value === '0') {
				// @ts-ignore
				value = false;
			} else if (typeof value === 'string') {
				value = utils.unescapeIRC(value);
			}
			tags[key] = value;
		}

		// Messages with no prefix..
		if (message.prefix === null) {
			switch (message.command) {
				// Received PING from server..
				case 'PING':
					this.emit('ping');
					if (this._isConnected()) {
						this.getWS().send('PONG');
					}
					break;

				// Received PONG from server, return current latency..
				case 'PONG': {
					const currDate = new Date();
					this.currentLatency = (currDate.getTime() - this.latency.getTime()) / 1000;
					this.emits(['pong', '_promisePing'], [[this.currentLatency]]);

					clearTimeout(this.pingTimeout);
					break;
				}

				default:
					this.log.warn(
						`Could not parse message with no prefix:\n${JSON.stringify(message, null, 4)}`,
					);
					break;
			}
		}

		// Messages with "tmi.twitch.tv" as a prefix..
		else if (message.prefix === TMI_DOMAIN) {
			switch (message.command) {
				case '002':
				case '003':
				case '004':
				case '372':
				case '375':
				case 'CAP':
					break;

				// Retrieve username from server..
				case '001':
					[this.username] = message.params;
					break;

				// Connected to server..
				case '376': {
					this.log.info('Connected to server.');
					this.userstate[this._globalDefaultChannel] = {};
					this.emits(['connected', '_promiseConnect'], [[this.server, this.port], [null]]);
					this.reconnections = 0;
					this.reconnectTimer = this.reconnectInterval;

					// Set an internal ping timeout check interval..
					this.pingLoop = setInterval(() => {
						// Make sure the connection is opened before sending the message..
						if (this._isConnected()) {
							this.getWS().send('PING');
						}
						this.latency = new Date();
						this.pingTimeout = setTimeout(() => {
							if (this.ws !== null) {
								this.wasCloseCalled = false;
								this.log.error('Ping timeout.');
								this.getWS().close();

								clearInterval(this.pingLoop);
								clearTimeout(this.pingTimeout);
							}
						}, this.config.connection?.timeout || 9999);
					}, 60000);

					// Join all the channels from the config with an interval..
					let joinInterval = this.config.options?.joinInterval || 2000;
					if (joinInterval < 300) {
						joinInterval = 300;
					}
					const joinQueue = new Queue(joinInterval);
					const joinChannels = this.config.channels
						? utils.union(this.config.channels, this.channels)
						: this.channels;
					this.channels = [];

					console.log('this.config.channels : ', this.config.channels);
					for (let i = 0; i < joinChannels.length; i++) {
						const channel = joinChannels[i];
						joinQueue.add(() => {
							if (this._isConnected()) {
								this.join(channel).catch((err: Error) => this.log.error(err));
							}
						});
					}

					joinQueue.next();
					break;
				}

				// https://github.com/justintv/Twitch-API/blob/master/chat/capabilities.md#notice
				case 'NOTICE': {
					const nullArr = [null];
					const noticeArr = [channel, msgid, msg];
					const msgidArr = [msgid];
					const channelTrueArr = [channel, true];
					const channelFalseArr = [channel, false];
					const noticeAndNull = [noticeArr, nullArr];
					const noticeAndMsgid = [noticeArr, msgidArr];
					const basicLog = `[${channel}] ${msg}`;
					switch (msgid) {
						// This room is now in subscribers-only mode.
						case 'subs_on':
							this.log.info(`[${channel}] This room is now in subscribers-only mode.`);
							this.emits(
								['subscriber', 'subscribers', '_promiseSubscribers'],
								[channelTrueArr, channelTrueArr, nullArr],
							);
							break;

						// This room is no longer in subscribers-only mode.
						case 'subs_off':
							this.log.info(`[${channel}] This room is no longer in subscribers-only mode.`);
							this.emits(
								['subscriber', 'subscribers', '_promiseSubscribersoff'],
								[channelFalseArr, channelFalseArr, nullArr],
							);
							break;

						// This room is now in emote-only mode.
						case 'emote_only_on':
							this.log.info(`[${channel}] This room is now in emote-only mode.`);
							this.emits(['emoteonly', '_promiseEmoteonly'], [channelTrueArr, nullArr]);
							break;

						// This room is no longer in emote-only mode.
						case 'emote_only_off':
							this.log.info(`[${channel}] This room is no longer in emote-only mode.`);
							this.emits(['emoteonly', '_promiseEmoteonlyoff'], [channelFalseArr, nullArr]);
							break;

						// Do not handle slow_on/off here, listen to the ROOMSTATE notice instead as it returns the delay.
						case 'slow_on':
						case 'slow_off':
							break;

						// Do not handle followers_on/off here, listen to the ROOMSTATE notice instead as it returns the delay.
						case 'followers_on_zero':
						case 'followers_on':
						case 'followers_off':
							break;

						// This room is now in r9k mode.
						case 'r9k_on':
							this.log.info(`[${channel}] This room is now in r9k mode.`);
							this.emits(
								['r9kmode', 'r9kbeta', '_promiseR9kbeta'],
								[channelTrueArr, channelTrueArr, nullArr],
							);
							break;

						// This room is no longer in r9k mode.
						case 'r9k_off':
							this.log.info(`[${channel}] This room is no longer in r9k mode.`);
							this.emits(
								['r9kmode', 'r9kbeta', '_promiseR9kbetaoff'],
								[channelFalseArr, channelFalseArr, nullArr],
							);
							break;

						// The moderators of this room are: [..., ...]
						case 'room_mods': {
							if (!msg) {
								logger.error('room_mods notice has no msg');
								break;
							}
							const mods = msg
								.split(': ')[1]
								.toLowerCase()
								.split(', ')
								.filter((n) => n);

							this.emits(
								['_promiseMods', 'mods'],
								[
									[null, mods],
									[channel, mods],
								],
							);
							break;
						}

						// There are no moderators for this room.
						case 'no_mods':
							this.emits(
								['_promiseMods', 'mods'],
								[
									[null, []],
									[channel, []],
								],
							);
							break;

						// The VIPs of this channel are: [..., ...]
						case 'vips_success': {
							if (!msg) {
								logger.error('vips_success notice has no msg');
								break;
							}
							if (msg.endsWith('.')) {
								msg = msg.slice(0, -1);
							}
							const vips = msg
								.split(': ')[1]
								.toLowerCase()
								.split(', ')
								.filter((n) => n);

							this.emits(
								['_promiseVips', 'vips'],
								[
									[null, vips],
									[channel, vips],
								],
							);
							break;
						}

						// There are no VIPs for this room.
						case 'no_vips':
							this.emits(
								['_promiseVips', 'vips'],
								[
									[null, []],
									[channel, []],
								],
							);
							break;

						// Ban command failed..
						case 'already_banned':
						case 'bad_ban_admin':
						case 'bad_ban_broadcaster':
						case 'bad_ban_global_mod':
						case 'bad_ban_self':
						case 'bad_ban_staff':
						case 'usage_ban':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseBan'], noticeAndMsgid);
							break;

						// Ban command success..
						case 'ban_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseBan'], noticeAndNull);
							break;

						// Clear command failed..
						case 'usage_clear':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseClear'], noticeAndMsgid);
							break;

						// Mods command failed..
						case 'usage_mods':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseMods'], [noticeArr, [msgid, []]]);
							break;

						// Mod command success..
						case 'mod_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseMod'], noticeAndNull);
							break;

						// VIPs command failed..
						case 'usage_vips':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseVips'], [noticeArr, [msgid, []]]);
							break;

						// VIP command failed..
						case 'usage_vip':
						case 'bad_vip_grantee_banned':
						case 'bad_vip_grantee_already_vip':
						case 'bad_vip_max_vips_reached':
						case 'bad_vip_achievement_incomplete':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseVip'], [noticeArr, [msgid, []]]);
							break;

						// VIP command success..
						case 'vip_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseVip'], noticeAndNull);
							break;

						// Mod command failed..
						case 'usage_mod':
						case 'bad_mod_banned':
						case 'bad_mod_mod':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseMod'], noticeAndMsgid);
							break;

						// Unmod command success..
						case 'unmod_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseUnmod'], noticeAndNull);
							break;

						// Unvip command success...
						case 'unvip_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseUnvip'], noticeAndNull);
							break;

						// Unmod command failed..
						case 'usage_unmod':
						case 'bad_unmod_mod':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseUnmod'], noticeAndMsgid);
							break;

						// Unvip command failed..
						case 'usage_unvip':
						case 'bad_unvip_grantee_not_vip':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseUnvip'], noticeAndMsgid);
							break;

						// Color command success..
						case 'color_changed':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseColor'], noticeAndNull);
							break;

						// Color command failed..
						case 'usage_color':
						case 'turbo_only_color':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseColor'], noticeAndMsgid);
							break;

						// Commercial command success..
						case 'commercial_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseCommercial'], noticeAndNull);
							break;

						// Commercial command failed..
						case 'usage_commercial':
						case 'bad_commercial_error':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseCommercial'], noticeAndMsgid);
							break;

						// Host command success..
						case 'hosts_remaining': {
							if (!msg) {
								logger.error('room_mods notice has no msg');
								break;
							}
							this.log.info(basicLog);
							const remainingHost = !isNaN(Number(msg[0])) ? Number(msg[0]) : 0;
							this.emits(['notice', '_promiseHost'], [noticeArr, [null, ~~remainingHost]]);
							break;
						}

						// Host command failed..
						case 'bad_host_hosting':
						case 'bad_host_rate_exceeded':
						case 'bad_host_error':
						case 'usage_host':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseHost'], [noticeArr, [msgid, null]]);
							break;

						// r9kbeta command failed..
						case 'already_r9k_on':
						case 'usage_r9k_on':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseR9kbeta'], noticeAndMsgid);
							break;

						// r9kbetaoff command failed..
						case 'already_r9k_off':
						case 'usage_r9k_off':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseR9kbetaoff'], noticeAndMsgid);
							break;

						// Timeout command success..
						case 'timeout_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseTimeout'], noticeAndNull);
							break;

						case 'delete_message_success':
							this.log.info(`[${channel} ${msg}]`);
							this.emits(['notice', '_promiseDeletemessage'], noticeAndNull);
							break;

						// Subscribersoff command failed..
						case 'already_subs_off':
						case 'usage_subs_off':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseSubscribersoff'], noticeAndMsgid);
							break;

						// Subscribers command failed..
						case 'already_subs_on':
						case 'usage_subs_on':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseSubscribers'], noticeAndMsgid);
							break;

						// Emoteonlyoff command failed..
						case 'already_emote_only_off':
						case 'usage_emote_only_off':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseEmoteonlyoff'], noticeAndMsgid);
							break;

						// Emoteonly command failed..
						case 'already_emote_only_on':
						case 'usage_emote_only_on':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseEmoteonly'], noticeAndMsgid);
							break;

						// Slow command failed..
						case 'usage_slow_on':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseSlow'], noticeAndMsgid);
							break;

						// Slowoff command failed..
						case 'usage_slow_off':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseSlowoff'], noticeAndMsgid);
							break;

						// Timeout command failed..
						case 'usage_timeout':
						case 'bad_timeout_admin':
						case 'bad_timeout_broadcaster':
						case 'bad_timeout_duration':
						case 'bad_timeout_global_mod':
						case 'bad_timeout_self':
						case 'bad_timeout_staff':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseTimeout'], noticeAndMsgid);
							break;

						// Unban command success..
						// Unban can also be used to cancel an active timeout.
						case 'untimeout_success':
						case 'unban_success':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseUnban'], noticeAndNull);
							break;

						// Unban command failed..
						case 'usage_unban':
						case 'bad_unban_no_ban':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseUnban'], noticeAndMsgid);
							break;

						// Delete command failed..
						case 'usage_delete':
						case 'bad_delete_message_error':
						case 'bad_delete_message_broadcaster':
						case 'bad_delete_message_mod':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseDeletemessage'], noticeAndMsgid);
							break;

						// Unhost command failed..
						case 'usage_unhost':
						case 'not_hosting':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseUnhost'], noticeAndMsgid);
							break;

						// Whisper command failed..
						case 'whisper_invalid_login':
						case 'whisper_invalid_self':
						case 'whisper_limit_per_min':
						case 'whisper_limit_per_sec':
						case 'whisper_restricted':
						case 'whisper_restricted_recipient':
							this.log.info(basicLog);
							this.emits(['notice', '_promiseWhisper'], noticeAndMsgid);
							break;

						// Permission error..
						case 'no_permission':
						case 'msg_banned':
						case 'msg_room_not_found':
						case 'msg_channel_suspended':
						case 'tos_ban':
						case 'invalid_user':
							this.log.info(basicLog);
							this.emits(
								[
									'notice',
									'_promiseBan',
									'_promiseClear',
									'_promiseUnban',
									'_promiseTimeout',
									'_promiseDeletemessage',
									'_promiseMods',
									'_promiseMod',
									'_promiseUnmod',
									'_promiseVips',
									'_promiseVip',
									'_promiseUnvip',
									'_promiseCommercial',
									'_promiseHost',
									'_promiseUnhost',
									'_promiseJoin',
									'_promisePart',
									'_promiseR9kbeta',
									'_promiseR9kbetaoff',
									'_promiseSlow',
									'_promiseSlowoff',
									'_promiseFollowers',
									'_promiseFollowersoff',
									'_promiseSubscribers',
									'_promiseSubscribersoff',
									'_promiseEmoteonly',
									'_promiseEmoteonlyoff',
									'_promiseWhisper',
								],
								[noticeArr, [msgid, channel]],
							);
							break;

						// Automod-related..
						case 'msg_rejected':
						case 'msg_rejected_mandatory':
							this.log.info(basicLog);
							this.emit('automod', channel, msgid, msg);
							break;

						// Unrecognized command..
						case 'unrecognized_cmd':
							this.log.info(basicLog);
							this.emit('notice', channel, msgid, msg);
							break;

						// Send the following msg-ids to the notice event listener..
						case 'cmds_available':
						case 'host_target_went_offline':
						case 'msg_censored_broadcaster':
						case 'msg_duplicate':
						case 'msg_emoteonly':
						case 'msg_verified_email':
						case 'msg_ratelimit':
						case 'msg_subsonly':
						case 'msg_timedout':
						case 'msg_bad_characters':
						case 'msg_channel_blocked':
						case 'msg_facebook':
						case 'msg_followersonly':
						case 'msg_followersonly_followed':
						case 'msg_followersonly_zero':
						case 'msg_slowmode':
						case 'msg_suspended':
						case 'no_help':
						case 'usage_disconnect':
						case 'usage_help':
						case 'usage_me':
						case 'unavailable_command':
							this.log.info(basicLog);
							this.emit('notice', channel, msgid, msg);
							break;

						// Ignore this because we are already listening to HOSTTARGET..
						case 'host_on':
						case 'host_off':
							break;

						default:
							if (!msg) {
								logger.error('default notice has no msg');
								break;
							}

							if (
								msg.includes('Login unsuccessful') ||
								msg.includes('Login authentication failed')
							) {
								this.wasCloseCalled = false;
								this.reconnect = false;
								this.reason = msg;
								this.log.error(this.reason);
								this.getWS().close();
							} else if (
								msg.includes('Error logging in') ||
								msg.includes('Improperly formatted auth')
							) {
								this.wasCloseCalled = false;
								this.reconnect = false;
								this.reason = msg;
								this.log.error(this.reason);
								this.getWS().close();
							} else if (msg.includes('Invalid NICK')) {
								this.wasCloseCalled = false;
								this.reconnect = false;
								this.reason = 'Invalid NICK.';
								this.log.error(this.reason);
								this.getWS().close();
							} else {
								this.log.warn(
									`Could not parse NOTICE from ${TMI_DOMAIN}:\n${JSON.stringify(
										message,
										null,
										4,
									)}`,
								);
								this.emit('notice', channel, msgid, msg);
							}
							break;
					}
					break;
				}

				// Handle subanniversary / resub..
				case 'USERNOTICE': {
					const username = tags['display-name'] || tags['login'];
					const plan = tags['msg-param-sub-plan'] || '';
					const planName = tags['msg-param-sub-plan-name']
						? utils.unescapeIRC(tags['msg-param-sub-plan-name'] as string)
						: null;
					const prime = plan.includes('Prime');
					const methods = { prime, plan, planName };
					const streakMonths = ~~(tags['msg-param-streak-months'] || 0);
					const recipient =
						tags['msg-param-recipient-display-name'] || tags['msg-param-recipient-user-name'];
					const giftSubCount = ~~tags['msg-param-mass-gift-count'];
					tags['message-type'] = msgid as string;

					switch (msgid) {
						// Handle resub
						case 'resub':
							this.emits(
								['resub', 'subanniversary'],
								[[channel, username, streakMonths, msg, tags, methods]],
							);
							break;

						// Handle sub
						case 'sub':
							this.emits(['subscription', 'sub'], [[channel, username, methods, msg, tags]]);
							break;

						// Handle gift sub
						case 'subgift':
							this.emit(
								'subgift',
								channel,
								username,
								streakMonths,
								recipient,
								methods,
								tags,
							);
							break;

						// Handle anonymous gift sub
						// Need proof that this event occur
						case 'anonsubgift':
							this.emit('anonsubgift', channel, streakMonths, recipient, methods, tags);
							break;

						// Handle random gift subs
						case 'submysterygift':
							this.emit('submysterygift', channel, username, giftSubCount, methods, tags);
							break;

						// Handle anonymous random gift subs
						// Need proof that this event occur
						case 'anonsubmysterygift':
							this.emit('anonsubmysterygift', channel, giftSubCount, methods, tags);
							break;

						// Handle user upgrading from Prime to a normal tier sub
						case 'primepaidupgrade':
							this.emit('primepaidupgrade', channel, username, methods, tags);
							break;

						// Handle user upgrading from a gifted sub
						case 'giftpaidupgrade': {
							const sender = tags['msg-param-sender-name'] || tags['msg-param-sender-login'];
							this.emit('giftpaidupgrade', channel, username, sender, tags);
							break;
						}

						// Handle user upgrading from an anonymous gifted sub
						case 'anongiftpaidupgrade':
							this.emit('anongiftpaidupgrade', channel, username, tags);
							break;

						// Handle raid
						case 'raid': {
							const username = tags['msg-param-displayName'] || tags['msg-param-login'];
							const viewers = +tags['msg-param-viewerCount'];
							this.emit('raided', channel, username, viewers, tags);
							break;
						}
						// Handle ritual
						case 'ritual': {
							const ritualName = tags['msg-param-ritual-name'];
							switch (ritualName) {
								// Handle new chatter ritual
								case 'new_chatter':
									this.emit('newchatter', channel, username, tags, msg);
									break;
								// All unknown rituals should be passed through
								default:
									this.emit('ritual', ritualName, channel, username, tags, msg);
									break;
							}
							break;
						}
						// All other msgid events should be emitted under a usernotice event
						// until it comes up and needs to be added..
						default:
							this.emit('usernotice', msgid, channel, tags, msg);
							break;
					}
					break;
				}

				// Channel is now hosting another channel or exited host mode..
				case 'HOSTTARGET': {
					if (!msg) {
						logger.error('HOSTTARGET command has no msg');
						break;
					}
					const msgSplit = msg.split(' ');
					const viewers = ~~msgSplit[1] || 0;
					// Stopped hosting..
					if (msgSplit[0] === '-') {
						this.log.info(`[${channel}] Exited host mode.`);
						this.emits(['unhost', '_promiseUnhost'], [[channel, viewers], [null]]);
					}

					// Now hosting..
					else {
						this.log.info(
							`[${channel}] Now hosting ${msgSplit[0]} for ${viewers} viewer(s).`,
						);
						this.emit('hosting', channel, msgSplit[0], viewers);
					}
					break;
				}

				// Someone has been timed out or chat has been cleared by a moderator..
				case 'CLEARCHAT':
					// User has been banned / timed out by a moderator..
					if (message.params.length > 1) {
						// Duration returns null if it's a ban, otherwise it's a timeout..
						const duration = message.tags['ban-duration'] || null;

						if (duration === null) {
							this.log.info(`[${channel}] ${msg} has been banned.`);
							this.emit('ban', channel, msg, null, message.tags);
						} else {
							this.log.info(
								`[${channel}] ${msg} has been timed out for ${duration} seconds.`,
							);
							this.emit('timeout', channel, msg, null, duration, message.tags);
						}
					}

					// Chat was cleared by a moderator..
					else {
						this.log.info(`[${channel}] Chat was cleared by a moderator.`);
						this.emits(['clearchat', '_promiseClear'], [[channel], [null]]);
					}
					break;

				// Someone's message has been deleted
				case 'CLEARMSG':
					if (message.params.length > 1) {
						const deletedMessage = msg;
						const username = tags['login'];
						tags['message-type'] = 'messagedeleted';

						this.log.info(`[${channel}] ${username}'s message has been deleted.`);
						this.emit('messagedeleted', channel, username, deletedMessage, tags);
					}
					break;

				// Received a reconnection request from the server..
				case 'RECONNECT':
					this.log.info('Received RECONNECT request from Twitch..');
					this.log.info(
						`Disconnecting and reconnecting in ${Math.round(
							this.reconnectTimer / 1000,
						)} seconds..`,
					);
					this.disconnect().catch((err) => this.log.error(err));
					setTimeout(
						() => this.connect().catch((err) => this.log.error(err)),
						this.reconnectTimer,
					);
					break;

				// Received when joining a channel and every time you send a PRIVMSG to a channel.
				case 'USERSTATE':
					message.tags.username = this.username;

					// Add the client to the moderators of this room..
					if (message.tags['user-type'] === 'mod') {
						if (!this.moderators[channel]) {
							this.moderators[channel] = [];
						}
						if (!this.moderators[channel].includes(this.username)) {
							this.moderators[channel].push(this.username);
						}
					}

					// Logged in and username doesn't start with justinfan..
					if (!utils.isJustinfan(this.getUsername()) && !this.userstate[channel]) {
						this.userstate[channel] = tags;
						this.lastJoined = channel;
						this.channels.push(channel);
						this.log.info(`Joined ${channel}`);
						this.emit('join', channel, utils.username(this.getUsername()), true);
					}

					// Emote-sets has changed, update it..
					if (message.tags['emote-sets'] !== this.emotes) {
						this._updateEmoteset(message.tags['emote-sets'] as string);
					}

					this.userstate[channel] = tags;
					break;

				// Describe non-channel-specific state informations..
				case 'GLOBALUSERSTATE':
					this.globaluserstate = tags;
					this.emit('globaluserstate', tags);

					// Received emote-sets..
					if (typeof message.tags['emote-sets'] !== 'undefined') {
						this._updateEmoteset(message.tags['emote-sets'] as string);
					}
					break;

				// Received when joining a channel and every time one of the chat room settings, like slow mode, change.
				// The message on join contains all room settings.
				case 'ROOMSTATE':
					// We use this notice to know if we successfully joined a channel..
					if (utils.channel(this.lastJoined) === channel) {
						this.emit('_promiseJoin', null, channel);
					}

					// Provide the channel name in the tags before emitting it..
					message.tags.channel = channel;
					this.emit('roomstate', channel, message.tags);

					if (!('subs-only' in message.tags)) {
						// Handle slow mode here instead of the slow_on/off notice..
						// This room is now in slow mode. You may send messages every slow_duration seconds.
						if ('slow' in message.tags) {
							if (typeof message.tags.slow === 'boolean' && !message.tags.slow) {
								const disabled = [channel, false, 0];
								this.log.info(`[${channel}] This room is no longer in slow mode.`);
								this.emits(
									['slow', 'slowmode', '_promiseSlowoff'],
									[disabled, disabled, [null]],
								);
							} else {
								const seconds = ~~message.tags.slow;
								const enabled = [channel, true, seconds];
								this.log.info(`[${channel}] This room is now in slow mode.`);
								this.emits(
									['slow', 'slowmode', '_promiseSlow'],
									[enabled, enabled, [null]],
								);
							}
						}

						// Handle followers only mode here instead of the followers_on/off notice..
						// This room is now in follower-only mode.
						// This room is now in <duration> followers-only mode.
						// This room is no longer in followers-only mode.
						// duration is in minutes (string)
						// -1 when /followersoff (string)
						// false when /followers with no duration (boolean)
						if ('followers-only' in message.tags) {
							if (message.tags['followers-only'] === '-1') {
								const disabled = [channel, false, 0];
								this.log.info(
									`[${channel}] This room is no longer in followers-only mode.`,
								);
								this.emits(
									['followersonly', 'followersmode', '_promiseFollowersoff'],
									[disabled, disabled, [null]],
								);
							} else {
								const minutes = ~~message.tags['followers-only'];
								const enabled = [channel, true, minutes];
								this.log.info(`[${channel}] This room is now in follower-only mode.`);
								this.emits(
									['followersonly', 'followersmode', '_promiseFollowers'],
									[enabled, enabled, [null]],
								);
							}
						}
					}
					break;

				// Wrong cluster..
				case 'SERVERCHANGE':
					break;

				default:
					this.log.warn(
						`Could not parse message from tmi.twitch.tv:\n${JSON.stringify(
							message,
							null,
							4,
						)}`,
					);
					break;
			}
		}

		// Messages from jtv..
		else if (message.prefix === 'jtv') {
			switch (message.command) {
				case 'MODE':
					if (msg === '+o') {
						// Add username to the moderators..
						if (!this.moderators[channel]) {
							this.moderators[channel] = [];
						}
						if (!this.moderators[channel].includes(message.params[2])) {
							this.moderators[channel].push(message.params[2]);
						}

						this.emit('mod', channel, message.params[2]);
					} else if (msg === '-o') {
						// Remove username from the moderators..
						if (!this.moderators[channel]) {
							this.moderators[channel] = [];
						}
						this.moderators[channel].filter((value: string) => value !== message.params[2]);

						this.emit('unmod', channel, message.params[2]);
					}
					break;

				default:
					this.log.warn(
						`Could not parse message from jtv:\n${JSON.stringify(message, null, 4)}`,
					);
					break;
			}
		}

		// Anything else..
		else {
			switch (message.command) {
				case '353':
					this.emit('names', message.params[2], message.params[3].split(' '));
					break;

				case '366':
					break;

				// Someone has joined the channel..
				case 'JOIN': {
					const [nick] = message.prefix.split('!');
					// Joined a channel as a justinfan (anonymous) user..
					if (utils.isJustinfan(this.getUsername()) && this.username === nick) {
						this.lastJoined = channel;
						this.channels.push(channel);
						this.log.info(`Joined ${channel}`);
						this.emit('join', channel, nick, true);
					}

					// Someone else joined the channel, just emit the join event..
					if (this.username !== nick) {
						this.emit('join', channel, nick, false);
					}
					break;
				}

				// Someone has left the channel..
				case 'PART': {
					let isSelf = false;
					const [nick] = message.prefix.split('!');
					// Client left a channel..
					if (this.username === nick) {
						isSelf = true;
						if (this.userstate[channel]) {
							delete this.userstate[channel];
						}

						let index = this.channels.indexOf(channel);
						if (index !== -1) {
							this.channels.splice(index, 1);
						}

						if (this.config.channels) {
							index = this.config.channels.indexOf(channel);
							if (index !== -1) {
								this.config.channels.splice(index, 1);
							}
						}

						this.log.info(`Left ${channel}`);
						this.emit('_promisePart', null);
					}

					// Client or someone else left the channel, emit the part event..
					this.emit('part', channel, nick, isSelf);
					break;
				}

				// Received a whisper..
				case 'WHISPER': {
					const [nick] = message.prefix.split('!');
					this.log.info(`[WHISPER] <${nick}>: ${msg}`);

					// Update the tags to provide the username..
					if (!('username' in message.tags)) {
						message.tags.username = nick;
					}
					message.tags['message-type'] = 'whisper';

					const from = utils.channel(message.tags.username as string);
					// Emit for both, whisper and message..
					this.emits(['whisper', 'message'], [[from, message.tags, msg, false]]);
					break;
				}

				case 'PRIVMSG':
					if (!msg) {
						logger.error('PRIVMSG command has no msg');
						break;
					}

					// Add username (lowercase) to the tags..
					[message.tags.username] = message.prefix.split('!');

					// Message from JTV..
					if (message.tags.username === 'jtv') {
						const name = utils.username(msg.split(' ')[0]);
						const autohost = msg.includes('auto');
						// Someone is hosting the channel and the message contains how many viewers..
						if (msg.includes('hosting you for')) {
							const count = utils.extractNumber(msg);

							this.emit('hosted', channel, name, count, autohost);
						}

						// Some is hosting the channel, but no viewer(s) count provided in the message..
						else if (msg.includes('hosting you')) {
							this.emit('hosted', channel, name, 0, autohost);
						}
					} else {
						const messagesLogLevel = this.config.options?.messagesLogLevel || LogLevel.info;

						// Message is an action (/me <message>)..
						const actionMessage = utils.actionMessage(msg);
						message.tags['message-type'] = actionMessage ? 'action' : 'chat';
						msg = actionMessage ? actionMessage[1] : msg;
						// Check for Bits prior to actions message
						if ('bits' in message.tags) {
							this.emit('cheer', channel, message.tags, msg);
						} else {
							//Handle Channel Point Redemptions (Require's Text Input)
							if ('msg-id' in message.tags) {
								if (message.tags['msg-id'] === 'highlighted-message') {
									const rewardtype = message.tags['msg-id'];
									this.emit(
										'redeem',
										channel,
										message.tags.username,
										rewardtype,
										message.tags,
										msg,
									);
								} else if (message.tags['msg-id'] === 'skip-subs-mode-message') {
									const rewardtype = message.tags['msg-id'];
									this.emit(
										'redeem',
										channel,
										message.tags.username,
										rewardtype,
										message.tags,
										msg,
									);
								}
							} else if ('custom-reward-id' in message.tags) {
								const rewardtype = message.tags['custom-reward-id'];
								this.emit(
									'redeem',
									channel,
									message.tags.username,
									rewardtype,
									message.tags,
									msg,
								);
							}
							if (actionMessage) {
								this.log.log(
									messagesLogLevel,
									`[${channel}] *<${message.tags.username}>: ${msg}`,
								);
								this.emits(['action', 'message'], [[channel, message.tags, msg, false]]);
							}

							// Message is a regular chat message..
							else {
								this.log.log(
									messagesLogLevel,
									`[${channel}] <${message.tags.username}>: ${msg}`,
								);
								this.emits(['chat', 'message'], [[channel, message.tags, msg, false]]);
							}
						}
					}
					break;

				default:
					this.log.warn(`unknown command ${message.command}`);
					break;
			}
		}
	}

	// Connect to server..
	connect() {
		return new Promise((resolve, reject) => {
			if (this.config.connection?.server) this.server = this.config.connection?.server;

			if (this.config.connection?.port) this.port = this.config.connection?.port;

			// Override port if using a secure connection..
			if (this.secure) {
				this.port = 443;
			}
			if (this.port === 443) {
				this.secure = true;
			}

			this.reconnectTimer = this.reconnectTimer * this.reconnectDecay;
			if (this.reconnectTimer >= this.maxReconnectInterval) {
				this.reconnectTimer = this.maxReconnectInterval;
			}

			// Connect to server from configuration..
			this._openConnection();
			this.once('_promiseConnect', (err: Error) => {
				if (!err) {
					resolve([this.server, ~~this.port]);
				} else {
					reject(err);
				}
			});
		});
	}

	// Open a connection..
	_openConnection(): WebSocket {
		this.ws = new WebSocket(
			`${this.secure ? 'wss' : 'ws'}://${this.server}:${this.port}/`,
			'irc',
		);

		this.getWS().onmessage = this._onMessage.bind(this);
		this.getWS().onerror = this._onError.bind(this);
		this.getWS().onclose = this._onClose.bind(this);
		this.getWS().onopen = this._onOpen.bind(this);

		return this.ws;
	}

	// Called when the WebSocket connection's readyState changes to OPEN.
	// Indicates that the connection is ready to send and receive data..
	_onOpen() {
		if (!this._isConnected()) {
			return;
		}

		// Emitting "connecting" event..
		this.log.info(`Connecting to ${this.server} on port ${this.port}..`);
		this.emit('connecting', this.server, ~~this.port);

		this.username = this.config.identity?.username || utils.justinfan();
		this._getToken()
			.then((token) => {
				const password = utils.password(token);

				// Emitting "logon" event..
				this.log.info('Sending authentication to server...');
				this.emit('logon');

				let caps = 'twitch.tv/tags twitch.tv/commands';
				if (!this._skipMembership) {
					caps += ' twitch.tv/membership';
				}
				this.getWS().send('CAP REQ :' + caps);

				// Authentication..
				if (password) {
					this.getWS().send(`PASS ${password}`);
				} else if (utils.isJustinfan(this.username)) {
					this.getWS().send('PASS SCHMOOPIIE');
				}
				this.getWS().send(`NICK ${this.username}`);
			})
			.catch((err) => {
				this.emits(['_promiseConnect', 'disconnected'], [[err], ['Could not get a token.']]);
			});
	}

	// Fetches a token from the option.
	_getToken() {
		const passwordOption = this.config.identity?.password;
		let password;
		if (typeof passwordOption === 'function') {
			password = passwordOption();
			if (password instanceof Promise) {
				return password;
			}
			return Promise.resolve(password);
		}
		return Promise.resolve(passwordOption);
	}

	// Called when a message is received from the server..
	_onMessage(event: MessageEvent) {
		const parts = event.data.trim().split('\r\n');

		parts.forEach((str: string) => {
			this.handleMessage(str);
		});
	}

	// Called when an error occurs..
	_onError() {
		this.moderators = {};
		this.userstate = {};
		this.globaluserstate = {};

		// Stop the internal ping timeout check interval..
		clearInterval(this.pingLoop);
		clearTimeout(this.pingTimeout);

		this.reason = this.ws === null ? 'Connection closed.' : 'Unable to connect.';

		this.emits(['_promiseConnect', 'disconnected'], [[this.reason]]);

		// Reconnect to server..
		if (this.reconnect && this.reconnections === this.maxReconnectAttempts) {
			this.emit('maxreconnect');
			this.log.error('Maximum reconnection attempts reached.');
		}
		if (
			this.reconnect &&
			!this.reconnecting &&
			this.reconnections <= this.maxReconnectAttempts - 1
		) {
			this.reconnecting = true;
			this.reconnections = this.reconnections + 1;
			this.log.error(`Reconnecting in ${Math.round(this.reconnectTimer / 1000)} seconds..`);
			this.emit('reconnect');
			setTimeout(() => {
				this.reconnecting = false;
				this.connect().catch((err) => this.log.error(err));
			}, this.reconnectTimer);
		}

		this.ws = null;
	}

	// Called when the WebSocket connection's readyState changes to CLOSED..
	_onClose() {
		this.moderators = {};
		this.userstate = {};
		this.globaluserstate = {};

		// Stop the internal ping timeout check interval..
		clearInterval(this.pingLoop);
		clearTimeout(this.pingTimeout);

		// User called .disconnect(), don't try to reconnect.
		if (this.wasCloseCalled) {
			this.wasCloseCalled = false;
			this.reason = 'Connection closed.';
			this.log.info(this.reason);
			this.emits(
				['_promiseConnect', '_promiseDisconnect', 'disconnected'],
				[[this.reason], [null], [this.reason]],
			);
		}

		// Got disconnected from server..
		else {
			this.emits(['_promiseConnect', 'disconnected'], [[this.reason]]);

			// Reconnect to server..
			if (this.reconnect && this.reconnections === this.maxReconnectAttempts) {
				this.emit('maxreconnect');
				this.log.error('Maximum reconnection attempts reached.');
			}
			if (
				this.reconnect &&
				!this.reconnecting &&
				this.reconnections <= this.maxReconnectAttempts - 1
			) {
				this.reconnecting = true;
				this.reconnections = this.reconnections + 1;
				this.log.error(
					`Could not connect to server. Reconnecting in ${Math.round(
						this.reconnectTimer / 1000,
					)} seconds..`,
				);
				this.emit('reconnect');
				setTimeout(() => {
					this.reconnecting = false;
					this.connect().catch((err) => this.log.error(err));
				}, this.reconnectTimer);
			}
		}

		this.ws = null;
	}

	// Minimum of 600ms for command promises, if current latency exceeds, add 100ms to it to make sure it doesn't get timed out..
	_getPromiseDelay() {
		if (this.currentLatency <= 600) {
			return 600;
		} else {
			return this.currentLatency + 100;
		}
	}

	// Send command to server or channel..
	_sendCommand(delay: number, channel: string | null, command: string, fn: Function) {
		// Race promise against delay..
		return new Promise<boolean>((resolve, reject) => {
			// Make sure the socket is opened..
			if (!this._isConnected()) {
				// Disconnected from server..
				return reject('Not connected to server.');
			} else if (typeof delay === 'number' && delay > 0) {
				utils.promiseDelay(delay).then(() => reject('No response from Twitch.'));
			}

			// Executing a command on a channel..
			if (channel) {
				const chan = utils.channel(channel);
				this.log.info(`[${chan}] Executing command: ${command}`);
				this.getWS().send(`PRIVMSG ${chan} :${command}`);
			}

			// Executing a raw command..
			else {
				this.log.info(`Executing command: ${command}`);
				this.getWS().send(command);
			}
			if (typeof fn === 'function') {
				fn(resolve, reject);
			} else {
				resolve(true);
			}
		});
	}

	// Send a message to channel..
	_sendMessage(delay: number, channel: string, message: string, fn: Function) {
		// Promise a result..
		return new Promise((resolve, reject) => {
			// Make sure the socket is opened and not logged in as a justinfan user..
			if (!this._isConnected()) {
				return reject('Not connected to server.');
			} else if (utils.isJustinfan(this.getUsername())) {
				return reject('Cannot send anonymous messages.');
			}
			const chan = utils.channel(channel);
			if (!this.userstate[chan]) {
				this.userstate[chan] = {};
			}

			// Split long lines otherwise they will be eaten by the server..
			if (message.length >= 500) {
				const msg = utils.splitLine(message, 500);
				[message] = msg;

				setTimeout(() => {
					this._sendMessage(delay, channel, msg[1], () => {});
				}, 350);
			}

			this.getWS().send(`PRIVMSG ${chan} :${message}`);

			const emotes = {};

			// Parse regex and string emotes..
			Object.keys(this.emotesets).forEach((id) =>
				this.emotesets[id].forEach((emote: Emote) => {
					const emoteFunc = utils.isRegex(emote.code) ? parse.emoteRegex : parse.emoteString;
					return emoteFunc(message, emote.code, emote.id, emotes);
				}),
			);

			// Merge userstate with parsed emotes..
			const userstate = Object.assign(
				this.userstate[chan],
				parse.emotes({ emotes: parse.transformEmotes(emotes) || '' }),
			);

			const messagesLogLevel = this.config.options?.messagesLogLevel || 'info';

			// Message is an action (/me <message>)..
			const actionMessage = utils.actionMessage(message);
			if (actionMessage) {
				userstate['message-type'] = 'action';
				this.log.log(
					messagesLogLevel,
					`[${chan}] *<${this.getUsername()}>: ${actionMessage[1]}`,
				);
				this.emits(['action', 'message'], [[chan, userstate, actionMessage[1], true]]);
			}

			// Message is a regular chat message..
			else {
				userstate['message-type'] = 'chat';
				this.log.log(messagesLogLevel, `[${chan}] <${this.getUsername()}>: ${message}`);
				this.emits(['chat', 'message'], [[chan, userstate, message, true]]);
			}
			if (typeof fn === 'function') {
				fn(resolve, reject);
			} else {
				resolve(true);
			}
		});
	}

	// Grab the emote-sets object from the API..
	async _updateEmoteset(sets?: string) {
		let setsChanges = sets !== undefined;
		if (setsChanges) {
			if (sets === this.emotes) {
				setsChanges = false;
			} else {
				this.emotes = sets || '';
			}
		}
		if (this._skipUpdatingEmotesets) {
			if (setsChanges) {
				this.emit('emotesets', sets, {});
			}
			return;
		}
		try {
			const token = await this._getToken();
			const url = `${API_BASE_URL}/chat/emoticon_images?emotesets=${sets}`;
			/** @type {import('node-fetch').Response} */
			const res = await fetch(url, {
				headers: new Headers({
					Accept: 'application/vnd.twitchtv.v5+json',
					Authorization: `OAuth ${utils.gettoken(token)}`,
					'Client-ID': String(this.clientId),
				}),
			});
			const data = await res.json();
			this.emotesets = data.emoticon_sets || {};
			this.emit('emotesets', sets, this.emotesets);
		} catch (err) {
			// TODO: Potentially send error to logger
		}
		if (this._updateEmotesetsTimerDelay > 0) {
			clearTimeout(this._updateEmotesetsTimer);
			this._updateEmotesetsTimer = setTimeout(
				() => this._updateEmoteset(),
				this._updateEmotesetsTimerDelay,
			);
		}
	}

	// Get current username..
	getUsername() {
		return this.username;
	}

	// Get current options..
	getOptions() {
		return this.config;
	}

	// Get current channels..
	getChannels() {
		return this.channels;
	}

	// Check if username is a moderator on a channel..
	isMod(channel: string, username: string) {
		const chan = utils.channel(channel);
		if (!this.moderators[chan]) {
			this.moderators[chan] = [];
		}
		return this.moderators[chan].includes(utils.username(username));
	}

	// Get readyState..
	readyState() {
		if (this.ws === null) {
			return 'CLOSED';
		}
		return ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.getWS().readyState];
	}

	// Determine if the client has a WebSocket and it's open..
	_isConnected() {
		return this.ws !== null && this.getWS().readyState === 1;
	}

	// Disconnect from server..
	disconnect() {
		return new Promise((resolve, reject) => {
			if (this.ws !== null && this.getWS().readyState !== 3) {
				this.wasCloseCalled = true;
				this.log.info('Disconnecting from server..');
				this.getWS().close();
				this.once('_promiseDisconnect', () => resolve([this.server, ~~this.port]));
			} else {
				this.log.error(
					'Cannot disconnect from server. Socket is not opened or connection is already closing.',
				);
				reject(
					'Cannot disconnect from server. Socket is not opened or connection is already closing.',
				);
			}
		});
	}

	join(channel: string): Promise<[string]> {
		throw new Error('Not implemented');
	}
}

export default BaseClient;

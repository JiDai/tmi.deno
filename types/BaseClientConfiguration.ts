import { LogLevel } from '../lib/logger.ts';

export type BaseClientConfiguration = {
	channels?: Array<string>;
	connection?: {
		server?: string;
		port?: number;
		reconnect?: boolean;
		maxReconnectAttempts?: number;
		maxReconnectInterval?: number;
		reconnectDecay?: number;
		reconnectInterval?: number;
		secure?: boolean;
		timeout?: number;
	};
	identity?: Record<any, any>;
	options?: {
		clientId?: number;
		debug?: boolean;
		globalDefaultChannel?: string;
		skipMembership?: boolean;
		skipUpdatingEmotesets?: boolean;
		updateEmotesetsTimer?: number;
		joinInterval?: number;
		messagesLogLevel?: LogLevel;
	};
	logger?: Console;
};

export type Message = {
	raw: string;
	tags: Record<string, string | Array<string>>;
	command: string | null;
	prefix: string | null;
	params: Array<string>;
};

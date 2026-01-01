declare module 'citation-js' {
	export default class Cite {
		constructor(data: unknown);
		format(
			type: string,
			options?: {
				format?: string;
				template?: string;
				lang?: string;
			}
		): string;
	}
}

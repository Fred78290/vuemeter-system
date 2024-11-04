export type Color = {
	red: number;
	green: number;
	blue: number;
	alpha: number;
};

export interface Dictionary<T> {
	[key: string]: T;
}

export class Constantes {
	static readonly RED = { red: 1, green: 0, blue: 0, alpha: 1 };
	static readonly GREEN = { red: 0, green: 1, blue: 0, alpha: 1 };
	static readonly BLUE = { red: 0, green: 0, blue: 1, alpha: 1 };
	static readonly BLACK: Color = { red: 0, green: 0, blue: 0, alpha: 1.0 };
	static readonly WHITE: Color = { red: 1, green: 1, blue: 1, alpha: 1.0 };

	static readonly DEFAULT_GRID_COLOR: Color = { red: 0.34, green: 0.34, blue: 0.34, alpha: 0.6 };
	static readonly DEFAULT_STATS_COLOR: Color = { red: 0, green: 0.74, blue: 0.94, alpha: 1.0 };

	static readonly INDICATOR_UPDATE_INTERVAL = 250;
	static readonly INDICATOR_NUM_GRID_LINES = 7;
	static readonly ITEM_LABEL_SHOW_TIME = 0.15;
	static readonly ITEM_LABEL_HIDE_TIME = 0.1;
	static readonly ITEM_HOVER_TIMEOUT = 300;
}

export const globalSettingsKeys = [
	'debug-mode',
	'show-max-lines',
	'mem-stack',
	'btis-per-second',
	'queued-pref-category',
	'current-profile',
	'profiles',

	//Deprecated keys
	'processor-menu-gpu',
	'processor-menu-gpu-color',
	'headers-height',
];

export type Color = { red: number; green: number; blue: number; alpha: number };

export interface Dictionary<T> {
	[key: string]: T;
}

declare global {
	interface Number {
		formatMetricPretty: (units?: string) => string;
	}
}

Number.prototype.formatMetricPretty = function (units?: string) {
	let value = this.valueOf();
	let metricPrefix = '';

	if (value > 1024 * 1024) {
		value /= 1024 * 1024;
		metricPrefix = 'Mi';
	} else if (value > 1024) {
		value /= 1024;
		metricPrefix = 'Ki';
	}

	return '%0.2f %s%s'.format(value, metricPrefix, units || '');
};

export class Constantes {
	static DEFAULT_CAIRO_COLOR: Color = { red: 0, green: 0, blue: 0, alpha: 255 };
	static DEFAULT_GRID_COLOR: Color = { red: 87, green: 87, blue: 87, alpha: 154 };
	static DEFAULT_STATS_COLOR: Color = { red: 0, green: 190, blue: 240, alpha: 255 };
	static INDICATOR_UPDATE_INTERVAL = 250;
	static INDICATOR_NUM_GRID_LINES = 3;
	static ITEM_LABEL_SHOW_TIME = 0.15;
	static ITEM_LABEL_HIDE_TIME = 0.1;
	static ITEM_HOVER_TIMEOUT = 300;
}

export const globalSettingsKeys = [
	'debug-mode',
	'queued-pref-category',
	'current-profile',
	'profiles',

	//Deprecated keys
	'processor-menu-gpu',
	'processor-menu-gpu-color',
	'headers-height',
];

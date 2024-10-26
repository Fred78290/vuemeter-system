import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Color, Constantes, Dictionary } from './types.js';
import Utils from './utils.js';

class GraphOverlay {
	label: St.Label = new St.Label({ style_class: 'label' });
	actor: St.Bin = new St.Bin({
		style_class: 'gsp-graph-overlay',
		reactive: true,
	});

	constructor() {
		this.actor.add_child(this.label);
		Main.layoutManager.addChrome(this.actor);
		this.actor.hide();
	}

	destroy() {
		this.actor.destroy();
	}
}

export type HorizontalGraphOptions = {
	updateInterval: number;
	offsetX: number;
	offsetY: number;
	units: string;
	gridColor: string;
	autoscale: boolean;
	fillAll: boolean;
	showMax: boolean;
	max: number;
};

export const DEFAULT_HORIZONTAL_GRAPH_OPTIONS = {
	updateInterval: Constantes.INDICATOR_UPDATE_INTERVAL,
	offsetX: 5,
	offsetY: 3,
	units: '',
	gridColor: 'grid-color',
	autoscale: true,
	showMax: true,
	fillAll: false,
	max: 0,
};

type HorizontalGraphStat = {
	color: string;
	cairo_color: Color;
	values: number[];
	scaled: number[];
	max: number;
};

export default GObject.registerClass(
	class HorizontalGraph extends St.Bin {
		private timeout = 0;
		private graphoverlay = new GraphOverlay();
		private gridColor = Constantes.DEFAULT_GRID_COLOR;
		private max = -1;
		private options = DEFAULT_HORIZONTAL_GRAPH_OPTIONS;
		private ready = true;
		private renderStats: string[] = [];
		private stats: Dictionary<HorizontalGraphStat> = {};
		private styleChanged = false;
		private drawing_area: St.DrawingArea = new St.DrawingArea({
			reactive: true,
			xExpand: true,
			yExpand: true,
			xAlign: Clutter.ActorAlign.FILL,
			yAlign: Clutter.ActorAlign.FILL,
		});

		constructor(name: string, options?: HorizontalGraphOptions | any) {
			super({
				style_class: 'gsp-color gsp-graph-area',
				reactive: true,
				trackHover: true,
				x_expand: true,
				y_expand: true,
				xAlign: Clutter.ActorAlign.START,
				yAlign: Clutter.ActorAlign.FILL,
			});

			this.name = name;

			if (options) {
				this.options = { ...this.options, ...options };
			}

			this.drawing_area.connect('repaint', this.repaint.bind(this));

			this.add_child(this.drawing_area);
			this.connect('style-changed', this.updateStyles.bind(this));

			this.timeout = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				this.options.updateInterval,
				() => {
					if (this.ready) {
						this.drawing_area.queue_repaint();
					}

					return true;
				}
			);

			if (!this.options.autoscale) {
				this.max = this.options.max;
				this.updateMaxLabel();
			}
		}

		public enable() {}

		public disable() {}

		public destroy() {
			Utils.debug(`HorizontalGraph::destroy ${this.name}`);

			this.ready = false;

			if (this.timeout !== 0) {
				GLib.source_remove(this.timeout);
				this.timeout = 0;
			}

			super.destroy();
		}

		public addDataSet(name: string, color: string) {
			this.renderStats.push(name);
			this.stats[name] = {
				color: color,
				cairo_color: this.lookupColor(color, Constantes.DEFAULT_STATS_COLOR),
				values: [],
				scaled: [],
				max: -1,
			};
		}

		public addDataPoint(name: string, value: number) {
			this.stats[name].values.push(value);
		}

		// Calculate maximum value within set of values.
		private updateDataSetMax(name: string) {
			this.stats[name].max = this.stats[name].values.reduce((prev: number, cur: number) => {
				return Math.max(prev, cur);
			}, 0);

			if (this.max < this.stats[name].max) {
				this.max = this.stats[name].max;
				this.updateMaxLabel();
			}
		}

		private updateMax() {
			let max = 0;

			this.renderStats.map(k => {
				max = this.stats[k].max;
				return k;
			});

			if (max < this.max) {
				this.max = max;
				this.updateMaxLabel();
			}
		}

		private updateMaxLabel() {
			if (this.options.showMax) {
				this.graphoverlay.label.set_text(this.max.formatMetricPretty(this.options.units));
			}
		}

		private lookupColor(name: string, defaultColor: Color): Color {
			return Utils.lookupColor(this, name, defaultColor);
		}

		private updateStyles() {
			if (this.is_mapped()) {
				// get and cache the grid color
				this.gridColor = this.lookupColor(this.options.gridColor, this.gridColor);

				this.renderStats.map(k => {
					const stat = this.stats[k];
					stat.cairo_color = this.lookupColor(stat.color, Constantes.DEFAULT_STATS_COLOR);

					return k;
				});
			}
		}

		// Used to draws major/minor division lines within the graph.
		private drawGridLines(
			cr: Cairo.Context,
			width: number,
			gridOffset: number,
			count: number,
			color: Color
		) {
			for (let i = 1; i <= count; ++i) {
				cr.moveTo(0, i * gridOffset + 0.5);
				cr.lineTo(width, i * gridOffset + 0.5);
			}

			cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
			cr.setLineWidth(1);
			cr.setDash([2, 1], 0);
			cr.stroke();
		}

		private repaint(area: St.DrawingArea) {
			const [width, height] = area.get_surface_size();
			const cr: Cairo.Context = area.get_context() as Cairo.Context;
			const gridOffset = Math.floor(height / (Constantes.INDICATOR_NUM_GRID_LINES + 1));

			if (
				!this.ready ||
				Main.overview.visibleTarget ||
				!this.get_stage() ||
				!this.visible ||
				!cr
			)
				return;

			if (!this.styleChanged) {
				this.updateStyles();
				this.styleChanged = true;
			}

			// draws major divisions
			this.drawGridLines(
				cr,
				width,
				gridOffset,
				Constantes.INDICATOR_NUM_GRID_LINES,
				this.gridColor
			);

			// draws minor divisions
			this.drawGridLines(
				cr,
				width,
				gridOffset / 2,
				Constantes.INDICATOR_NUM_GRID_LINES * 2 + 1,
				{
					red: this.gridColor.red,
					green: this.gridColor.green,
					blue: this.gridColor.blue,
					alpha: this.gridColor.alpha * 0.2,
				}
			);

			this.renderStats.map(k => {
				const stat = this.stats[k];
				const new_width = width + 1;

				// truncate data point values to width of graph
				if (stat.values.length > new_width) {
					stat.values = stat.values.slice(
						stat.values.length - new_width,
						stat.values.length
					);
				}

				if (this.options.autoscale) {
					// Calculate maximum value within set of stat.values
					this.updateDataSetMax(k);
				}

				return k;
			});

			if (this.options.autoscale) {
				// Fixes max over all data points.
				this.updateMax();
			}

			// Scale all data points over max
			this.renderStats.map(k => {
				this.stats[k].scaled = this.stats[k].values.map(cur => {
					return cur / this.max;
				});

				return k;
			});

			for (let index = this.renderStats.length - 1; index >= 0; index--) {
				const stat = this.stats[this.renderStats[index]];
				const outlineColor = this.lookupColor(stat.color, stat.cairo_color);

				/*Utils.debug(
					`HorizontalGraph::repaint->${this.name}, name:${stat.color} red: ${outlineColor.red}, blue: ${outlineColor.blue}, green: ${outlineColor.green}, alpha:${outlineColor.alpha}`
				);*/

				if (this.max <= 0.00001) {
					continue;
				}

				if (index === 0 || this.options.fillAll) {
					// Render the first dataset's fill
					this.plotDataSet(cr, height, stat.scaled);

					cr.lineTo(stat.scaled.length - 1, height);
					cr.lineTo(0, height);
					cr.closePath();

					cr.setSourceRGBA(
						outlineColor.red,
						outlineColor.green,
						outlineColor.blue,
						outlineColor.alpha * 0.2
					);

					cr.fill();
				}

				// Render the data points
				this.plotDataSet(cr, height, stat.scaled);

				cr.setSourceRGBA(
					outlineColor.red,
					outlineColor.green,
					outlineColor.blue,
					outlineColor.alpha
				);

				cr.setLineWidth(1.0);
				cr.setDash([], 0);
				cr.stroke();
			}
		}

		private plotDataSet(cr: Cairo.Context, height: number, values: number[]) {
			cr.moveTo(0, (1 - (values[0] || 0)) * height);

			for (let k = 1; k < values.length; ++k) {
				cr.lineTo(k, (1 - values[k]) * height);
			}
		}

		public setOverlayPosition(x: number, y: number) {
			this.graphoverlay.actor.set_position(
				x + 12 + this.options.offsetX,
				y + 12 + this.options.offsetY
			);
		}

		public show() {
			this.ready = true;
			this.graphoverlay.actor.show();
			this.graphoverlay.actor.opacity = 0;

			const easeActor: any = this.graphoverlay.actor;

			easeActor.ease({
				opacity: 255,
				time: Constantes.ITEM_LABEL_SHOW_TIME,
				transition: Clutter.AnimationMode.EASE_OUT_QUAD,
			});

			super.show();
		}

		public hide() {
			this.ready = false;
			this.graphoverlay.actor.hide();

			super.hide();
		}
	}
);

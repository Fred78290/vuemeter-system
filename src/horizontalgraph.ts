import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Color, Constantes, Dictionary } from './types.js';

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
	showMax: boolean;
	max: number;
};

export const DEFAULT_HORIZONTAL_GRAPH_OPTIONS = {
	updateInterval: Constantes.INDICATOR_UPDATE_INTERVAL,
	offsetX: 2,
	offsetY: -1,
	units: '',
	gridColor: 'grid-color',
	autoscale: true,
	showMax: true,
	max: 0,
};

class HorizontalGraphStat {
	color = '';
	cairo_color = Constantes.DEFAULT_CAIRO_COLOR;
	values: number[] = [];
	scaled: number[] = [];
	max = -1;

	constructor(color: string) {
		this.color = color;
	}
}

export default GObject.registerClass(
	class HorizontalGraph extends St.Bin {
		timeout = 0;
		graphoverlay = new GraphOverlay();
		gridColor = Constantes.DEFAULT_GRID_COLOR;
		max = -1;
		options = DEFAULT_HORIZONTAL_GRAPH_OPTIONS;
		ready = true;
		renderStats: string[] = [];
		stats: Dictionary<HorizontalGraphStat> = {};
		styleChanged = false;
		graph: St.DrawingArea = new St.DrawingArea({
			reactive: true,
		});

		constructor(options?: HorizontalGraphOptions | any) {
			super({
				style_class: 'gsp-graph-area',
				reactive: true,
				trackHover: true,
				x_expand: true,
				y_expand: true,
				xAlign: Clutter.ActorAlign.START,
				yAlign: Clutter.ActorAlign.FILL,
			});

			if (options) {
				this.options = { ...this.options, ...options };
			}

			this.graph.connect('repaint', this.draw.bind(this));

			this.add_child(this.graph);
			this.connect('style-changed', this.updateStyles.bind(this));

			this.timeout = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				this.options.updateInterval,
				() => {
					if (this.graph.visible) {
						this.graph.queue_repaint();
					}

					return true;
				}
			);

			if (!this.options.autoscale) {
				this.max = this.options.max;
				this.updateMaxLabel();
			}
		}

		public enable() {
			this.ready = true;
		}

		public disable() {
			this.ready = false;
		}

		public destroy() {
			this.ready = false;

			if (this.timeout !== 0) {
				GLib.source_remove(this.timeout);
				this.timeout = 0;
			}

			super.destroy();
		}

		public addDataSet(name: string, color: string) {
			this.renderStats.push(name);
			this.stats[name] = new HorizontalGraphStat(color);
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

		private updateStyles() {
			if (false === this.is_mapped()) return;

			// get and cache the grid color
			const themeNode = this.get_theme_node();
			const [hasGridColor, gridColor] = themeNode.lookup_color(this.options.gridColor, false);

			if (hasGridColor) {
				this.gridColor = {
					red: gridColor.red,
					blue: gridColor.blue,
					green: gridColor.green,
					alpha: gridColor.alpha,
				};
			}

			this.renderStats.map(k => {
				const stat = this.stats[k];
				const [hasStatColor, statColor] = themeNode.lookup_color(stat.color, false);

				if (hasStatColor) {
					stat.cairo_color = {
						red: statColor.red,
						blue: statColor.blue,
						green: statColor.green,
						alpha: statColor.alpha,
					};
				} else {
					stat.cairo_color = {
						red: 0,
						green: 190,
						blue: 240,
						alpha: 255,
					};
				}

				return k;
			});
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

		private draw() {
			if (
				this.ready === false ||
				Main.overview.visibleTarget ||
				!this.get_stage() ||
				!this.visible
			)
				return;

			const area = this.graph;
			const [width, height] = area.get_surface_size();
			const context: any = area.get_context();
			const cr: Cairo.Context = context;

			if (!this.styleChanged) {
				this.updateStyles();
				this.styleChanged = true;
			}

			if (!cr) return;

			//draw the background grid
			const gridOffset = Math.floor(height / (Constantes.INDICATOR_NUM_GRID_LINES + 1));

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

			let first = false;

			for (const key of this.renderStats) {
				const stat = this.stats[key];
				const outlineColor = stat.cairo_color;

				if (this.max <= 0.00001) {
					continue;
				}

				if (!first) {
					// Render the first dataset's fill
					first = true;

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

		setOverlayPosition(x: number, y: number) {
			this.graphoverlay.actor.set_position(
				x + this.options.offsetX,
				y + this.options.offsetY
			);
		}

		show() {
			this.ready = true;
			this.graphoverlay.actor.show();
			this.graphoverlay.actor.opacity = 0;

			const easeActor: any = this.graphoverlay.actor;

			easeActor.ease({
				opacity: 255,
				time: Constantes.ITEM_LABEL_SHOW_TIME,
				transition: Clutter.AnimationMode.EASE_OUT_QUAD,
			});
		}

		hide() {
			this.ready = false;
			this.graphoverlay.actor.hide();
		}
	}
);

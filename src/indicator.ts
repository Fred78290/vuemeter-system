import Cairo from 'cairo';
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import HorizontalGraph from './horizontalgraph.js';
import { Color, Constantes, Dictionary } from './types.js';

export type IndicatorOptions = {
	updateInterval: number;
	barPadding: number;
	barWidth: number;
	gridColor: string;
	decay: number;
};

export const DEFAULT_OPTIONS: IndicatorOptions = {
	updateInterval: Constantes.INDICATOR_UPDATE_INTERVAL,
	barPadding: 1,
	barWidth: 6,
	gridColor: 'grid-color',
	decay: 0.2,
};

export type IndicatorStat = {
	color: string;
	cairo_color: Color;
	values: number[];
	scaled: number[];
	max: number;
};

export default GObject.registerClass(
	class Indicator extends St.Widget {
		private barPadding = 0;
		private barWidth = 0;
		private box: St.BoxLayout;
		private drawing_area: St.DrawingArea;
		private dropdown: St.Widget;
		private gridColor = Constantes.DEFAULT_GRID_COLOR;
		private renderStats: string[] = [];
		private resized = false;
		private scale_factor = 0;
		private styleCached = false;
		private timeout = 0;

		protected dropdownLayout: Clutter.GridLayout;
		protected graph?: InstanceType<typeof HorizontalGraph>;
		protected options = DEFAULT_OPTIONS;
		protected stats: Dictionary<IndicatorStat> = {};

		constructor(name: string, options?: IndicatorOptions | any) {
			super({
				reactive: true,
				canFocus: true,
				trackHover: true,
				styleClass: 'panel-button gsp-header',
				accessibleName: name,
				accessibleRole: Atk.Role.MENU,
				layoutManager: new Clutter.BinLayout(),
				xExpand: true,
				yExpand: true,
				xAlign: Clutter.ActorAlign.START,
				yAlign: Clutter.ActorAlign.FILL,
			});

			this.name = name;

			this.box = new St.BoxLayout({
				xExpand: true,
				yExpand: true,
				xAlign: Clutter.ActorAlign.START,
				yAlign: Clutter.ActorAlign.FILL,
				style_class: 'gsp-indicator',
				reactive: true,
				track_hover: true,
			});

			this.drawing_area = new St.DrawingArea({
				reactive: true,
				xExpand: true,
				yExpand: true,
				xAlign: Clutter.ActorAlign.FILL,
				yAlign: Clutter.ActorAlign.FILL,
			});

			// process optionals
			if (options) {
				this.options = { ...this.options, ...options };
			}

			this.scale_factor = St.ThemeContext.get_for_stage(
				Shell.Global.get().get_stage()
			).scale_factor;
			this.barPadding = this.options.barPadding * this.scale_factor;
			this.barWidth = this.options.barWidth * this.scale_factor;

			// create UI elements
			this.drawing_area.connect('repaint', this.repaint.bind(this));
			this.drawing_area.connect('button-press-event', this.showSystemMonitor.bind(this));

			this.box.add_child(this.drawing_area);
			this.box.connect('notify::visible', this.onVisibilityChanged.bind(this));
			this.box.connect('style-changed', this._updateStyles.bind(this));

			this.dropdownLayout = new Clutter.GridLayout();
			this.dropdown = new St.Widget({
				layout_manager: this.dropdownLayout,
				reactive: true,
				style_class: 'gsp-dropdown',
			});

			Main.layoutManager.addChrome(this.dropdown);
			this.dropdown.hide();

			this.add_child(this.box);
			this.remove_style_class_name('panel-button');
		}

		protected addDataSet(name: string, color: string) {
			this.renderStats.push(name);
			this.stats[name] = {
				color: color,
				cairo_color: Constantes.DEFAULT_STATS_COLOR,
				values: [],
				scaled: [],
				max: -1,
			};
		}

		protected addDataPoint(name: string, value: number) {
			this.stats[name].values.push(value);
		}

		private onVisibilityChanged() {
			if (!this.box.visible) {
				this.dropdown.hide();
			}
		}

		public enable() {
			this.graph?.enable();

			this._updateValues();

			this.box.set_width(
				this.renderStats.length * (this.barWidth + this.barPadding) +
					this.barPadding * 2.0 -
					1
			);

			this.resized = true;

			this.timeout = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				this.options.updateInterval,
				this._updateValues.bind(this)
			);
		}

		public disable() {
			this.graph?.disable();

			if (this.timeout) {
				GLib.source_remove(this.timeout);
				this.timeout = 0;
			}
		}

		public show() {
			this.enable();
		}

		public hide() {
			this.disable();
		}

		public showPopup() {
			if (this.graph) {
				this.graph.enable();

				this.dropdown.opacity = 0;
				this.dropdown.show();

				const monitorIndex = Main.layoutManager.primaryIndex;
				const monitor = Main.layoutManager.monitors[monitorIndex];

				const [stageX, stageY] = this.box.get_transformed_position();

				const itemWidth = this.box.allocation.x2 - this.box.allocation.x1;
				const itemHeight = this.box.allocation.y2 - this.box.allocation.y1;
				const labelWidth = this.dropdown.width;
				const xOffset = Math.floor((itemWidth - labelWidth) / 2);
				const node = this.dropdown.get_theme_node();
				const yOffset = node.get_length('-y-offset');
				const easeActor: any = this.dropdown;

				const y = stageY + itemHeight + yOffset;
				const x = Math.min(
					stageX + xOffset,
					monitor.x + monitor.width - 4 - Math.max(itemWidth, labelWidth)
				);

				this.dropdown.set_position(x, y);

				easeActor.ease({
					opacity: 255,
					time: Constantes.ITEM_LABEL_SHOW_TIME,
					transition: Clutter.AnimationMode.EASE_OUT_QUAD,
					onComplete: () => {
						if (this.graph) {
							const [x1, y1] = this.graph.get_position();
							this.graph.setOverlayPosition(x + x1, y + y1);
							this.graph.show();
						}
					},
				});
			}
		}

		private _updateValues(): boolean {
			this.updateValues();
			this.drawing_area.queue_repaint();

			return true;
		}

		private _updateStyles() {
			this.updateStyles();
		}

		private showSystemMonitor(): boolean {
			let app = Shell.AppSystem.get_default().lookup_app('gnome-system-monitor.desktop');

			if (app === undefined || app === null) {
				app = Shell.AppSystem.get_default().lookup_app(
					'gnome-system-monitor_gnome-system-monitor.desktop'
				);
			}

			app.open_new_window(-1);

			return Clutter.EVENT_PROPAGATE;
		}

		public hidePopup() {
			if (this.graph) {
				this.graph.disable();

				const easeActor: any = this.dropdown;

				easeActor.ease({
					opacity: 0,
					time: Constantes.ITEM_LABEL_HIDE_TIME,
					transition: Clutter.AnimationMode.EASE_OUT_QUAD,
					onComplete: () => {
						this.graph?.hide();
						this.dropdown.hide();
					},
				});
			}
		}

		public destroy() {
			if (this.timeout !== 0) {
				GLib.source_remove(this.timeout);
				this.timeout = 0;
			}

			this.box.destroy();
			this.graph?.destroy();

			super.destroy();
		}

		protected updateValues() {}

		protected updateStyles() {
			if (!this.box.is_mapped()) return;

			/*           let [width, height] = this.drawing_area.get_size();

					   this.drawing_area.set_width(width * this.scale_factor);
					   this.drawing_area.set_height(height * this.scale_factor);*/

			// get and cache the grid color
			const themeNode = this.box.get_theme_node();
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
				}

				return k;
			});
		}

		private repaint() {
			if (Main.overview.visibleTarget) {
				return;
			}

			if (!this.box.get_stage()) {
				return;
			}

			if (!this.box.visible) {
				return;
			}

			const context: any = this.drawing_area.get_context();
			const cr: Cairo.Context = context;

			if (!cr) {
				return;
			}

			if (!this.styleCached) {
				this._updateStyles();
				this.styleCached = true;
			}

			//resize container based on number of bars to chart
			if (!this.resized) {
				this.box.set_width(
					this.renderStats.length * (this.barWidth + this.barPadding) +
						this.barPadding * 2.0 -
						1
				);
				this.resized = true;
			}

			//repaint the background grid
			const [width, height] = this.drawing_area.get_surface_size();
			const gridOffset = Math.floor(height / (Constantes.INDICATOR_NUM_GRID_LINES + 2));

			for (let i = 0; i <= Constantes.INDICATOR_NUM_GRID_LINES + 2; ++i) {
				//cr.moveTo(0, i * gridOffset + .5);
				//cr.lineTo(width, i * gridOffset + .5);
				cr.moveTo(0, i * gridOffset);
				cr.lineTo(width, i * gridOffset);
			}

			cr.setSourceRGBA(
				this.gridColor.red,
				this.gridColor.green,
				this.gridColor.blue,
				this.gridColor.alpha
			);
			cr.setLineWidth(1);
			cr.setDash([2, 1], 0);
			cr.stroke();

			// Make sure we don't have more sample points than pixels
			this.renderStats.map(k => {
				const stat = this.stats[k];
				const keepNumStats = 3;

				if (stat.values.length > keepNumStats) {
					stat.values = stat.values.slice(
						stat.values.length - keepNumStats,
						stat.values.length
					);
				}

				return k;
			});

			for (let i = 0; i < this.renderStats.length; ++i) {
				const stat = this.stats[this.renderStats[i]];

				// We outline at full opacity and fill with 40% opacity
				const color = {
					red: stat.cairo_color.red,
					green: stat.cairo_color.green,
					blue: stat.cairo_color.blue,
					alpha: stat.cairo_color.alpha * 0.8,
				};

				// Render the bar graph's fill
				this.plotDataSet(cr, height, i, stat.values, false);

				cr.lineTo((i + 1) * (this.barWidth + this.barPadding), height);
				cr.lineTo(i * (this.barWidth + this.barPadding) + this.barPadding, height);
				cr.closePath();

				cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
				cr.fill();

				// Render the bar graph's height line
				this.plotDataSet(cr, height, i, stat.values, false, 0.5);

				cr.setSourceRGBA(
					stat.cairo_color.red,
					stat.cairo_color.green,
					stat.cairo_color.blue,
					stat.cairo_color.alpha
				);
				cr.setLineWidth(1.0);
				cr.setDash([], 0);
				cr.stroke();
			}
		}

		private plotDataSet(
			cr: Cairo.Context,
			height: number,
			position: number,
			values: number[],
			_reverse: boolean,
			nudge = 0
		) {
			const barOuterWidth = this.barWidth + this.barPadding;
			const barHeight = 1 - (values[0] || 0);

			cr.moveTo(position * barOuterWidth + this.barPadding, barHeight * height + nudge);
			cr.lineTo((position + 1) * barOuterWidth, barHeight * height + nudge);
		}
	}
);

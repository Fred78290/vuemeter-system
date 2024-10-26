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
import Utils from './utils.js';

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
	barWidth: 8,
	gridColor: 'grid-color',
	decay: 0.2,
};

export type IndicatorStatValue = {
	visible: boolean;
	value: number;
	color: string;
	cairo_color: Color;
};

export type IndicatorStatValues = {
	values: IndicatorStatValue[];
};

export type IndicatorStatCombined = number | IndicatorStatValues;

export type IndicatorStat = {
	color: string;
	cairo_color: Color;
	values: IndicatorStatCombined[];
	max: number;
};

export type PopupDataset = {
	name: string;
	label: string;
	color: Color;
	header: boolean;
	vue_meter: boolean;
	registre: string;
};

type RenderingStatElement = {
	color: Color;
	cairo_color: Color;
	value: number;
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
				styleClass: 'panel-button gsp-color gsp-header',
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

			this.box.add_child(this.drawing_area);
			this.box.connect('notify::visible', this.onVisibilityChanged.bind(this));
			this.box.connect('style-changed', this.updateStyles.bind(this));
			this.box.connect('button-press-event', this.showSystemMonitor.bind(this));

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
				cairo_color: this.lookupColor(color, Constantes.DEFAULT_STATS_COLOR),
				values: [],
				max: -1,
			};
		}

		protected addDataPointWithColor(
			name: string,
			value: number | IndicatorStatCombined,
			color: string
		) {
			this.stats[name].color = color;
			this.stats[name].cairo_color = this.lookupColor(color, this.stats[name].cairo_color);
			this.stats[name].values.push(value);
		}

		protected addDataPoint(name: string, value: number | IndicatorStatCombined) {
			this.stats[name].values.push(value);
		}

		private onVisibilityChanged() {
			if (!this.box.visible) {
				this.dropdown.hide();
			}
		}

		private resize() {
			this.box.set_width(
				this.renderStats.length * (this.barWidth + this.barPadding) + 1 /*+
					this.barPadding * 2.0 -
					1*/
			);

			this.resized = true;
		}

		public enable() {
			this.graph?.enable();

			this._updateValues();
			this.resize();

			if (this.timeout === 0) {
				this.timeout = GLib.timeout_add(
					GLib.PRIORITY_DEFAULT,
					this.options.updateInterval,
					this._updateValues.bind(this)
				);
			}
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

				this.graph?.set_width(this.dropdown.width - 24);
				this.dropdown.set_position(x, y);

				easeActor.ease({
					opacity: 255,
					time: Constantes.ITEM_LABEL_SHOW_TIME,
					transition: Clutter.AnimationMode.EASE_OUT_QUAD,
					onComplete: () => {
						if (this.graph) {
							this.graph.setOverlayPosition(x, y);
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

		private showSystemMonitor(): boolean {
			const appSys = Shell.AppSystem.get_default();
			const systemMonitorSignature = [
				'org.gnome.SystemMonitor.desktop',
				'gnome-system-monitor.desktop',
				'gnome-system-monitor_gnome-system-monitor.desktop',
			];

			for (const signature of systemMonitorSignature) {
				const app = appSys.lookup_app(signature);

				if (app) {
					app.activate();
					break;
				}
			}

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
			Utils.debug(`Indicator::destroy ${this.name}`);

			if (this.timeout !== 0) {
				Utils.debug(`Indicator::destroy ${this.name}, clear timeout`);
				GLib.source_remove(this.timeout);
				this.timeout = 0;
			}

			this.box.destroy();
			this.graph?.destroy();

			super.destroy();
		}

		protected lookupColor(name: string, defaultColor: Color): Color {
			return Utils.lookupColor(this, name, defaultColor);
		}

		protected updateValues() {}

		protected updateStyles() {
			if (this.box.is_mapped()) {
				// get and cache the grid color
				this.gridColor = this.lookupColor(this.options.gridColor, this.gridColor);

				this.renderStats.map(k => {
					const stat = this.stats[k];

					stat.cairo_color = this.lookupColor(stat.color, stat.cairo_color);

					for (const value of stat.values) {
						if (typeof value !== 'number') {
							const indicatorStatValues = value as IndicatorStatValues;

							for (const indicatorStatValue of indicatorStatValues.values) {
								indicatorStatValue.cairo_color = this.lookupColor(
									indicatorStatValue.color,
									indicatorStatValue.cairo_color
								);
							}
						}
					}

					return k;
				});
			}
		}

		private repaint(area: St.DrawingArea) {
			const cr: Cairo.Context = area.get_context() as Cairo.Context;

			if (Main.overview.visibleTarget || !this.box.get_stage() || !this.box.visible || !cr) {
				return;
			}

			if (!this.styleCached) {
				this.updateStyles();
				this.styleCached = true;
			}

			//resize container based on number of bars to chart
			if (!this.resized) {
				this.resize();
			}

			//repaint the background grid
			const [width, height] = area.get_surface_size();
			const gridOffset = Math.floor(height / Constantes.INDICATOR_NUM_GRID_LINES + 2);

			for (let i = 1; i <= Constantes.INDICATOR_NUM_GRID_LINES + 2; i++) {
				const y = i * gridOffset;

				cr.moveTo(0, y);
				cr.lineTo(width + 2, y);
			}

			cr.setSourceRGBA(
				this.gridColor.red,
				this.gridColor.green,
				this.gridColor.blue,
				this.gridColor.alpha
			);

			cr.setAntialias(Cairo.Antialias.NONE);
			cr.setLineWidth(1);

			if (this.renderStats.length > 1) {
				cr.setDash([this.barWidth, this.barPadding], 0);
			} else {
				cr.setDash([], 0);
			}
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

			for (let index = 0; index < this.renderStats.length; index++) {
				const currentStat = this.stats[this.renderStats[index]];
				const renderingStats: RenderingStatElement[] = [];
				const currentStatValue =
					currentStat.values.length === 0 ? 0 : currentStat.values[0];

				if (typeof currentStatValue === 'number') {
					const cairo_color = this.lookupColor(
						currentStat.color,
						currentStat.cairo_color
					);

					renderingStats.push({
						value: currentStatValue as number,
						cairo_color: cairo_color,
						color: {
							red: cairo_color.red,
							green: cairo_color.green,
							blue: cairo_color.blue,
							alpha: cairo_color.alpha * 0.8,
						},
					});
				} else {
					const combined: IndicatorStatValues = currentStatValue as IndicatorStatValues;

					for (const value of combined.values) {
						if (value.visible) {
							const cairo_color = this.lookupColor(value.color, value.cairo_color);

							renderingStats.push({
								value: value.value,
								cairo_color: cairo_color,
								color: {
									red: cairo_color.red,
									green: cairo_color.green,
									blue: cairo_color.blue,
									alpha: cairo_color.alpha * 0.8,
								},
							});
						}
					}
				}

				for (const renderedStat of renderingStats) {
					// We outline at full opacity and fill with 40% opacity
					const color = renderedStat.color;
					const barHeight = height * renderedStat.value;
					const offsetX = index * (this.barWidth + this.barPadding);
					const offsetY = height - barHeight;

					// Render the bar graph's fill
					cr.setAntialias(Cairo.Antialias.NONE);
					cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
					cr.rectangle(offsetX, offsetY, this.barWidth, barHeight);
					cr.fill();
					cr.stroke();
				}
			}
		}

		protected currentLabels: Dictionary<St.Label> = {};
		protected currentValues: Dictionary<St.Label> = {};
		protected currentColors: Dictionary<St.Bin> = {};
		protected datasetNames: PopupDataset[] = [];

		protected buildPopup(
			datasetNames: PopupDataset[],
			graph: InstanceType<typeof HorizontalGraph>,
			prefix: string
		) {
			let offsetY = 0;

			this.dropdownLayout.attach(graph, 0, offsetY, 3, 1);

			for (const dataset of datasetNames) {
				if (dataset.header) {
					const label = new St.Label({ style_class: 'title_label' });

					label.set_text(dataset.label);

					offsetY++;
					this.dropdownLayout.attach(label, 0, offsetY, 3, 1);
				} else {
					const keyName = `${prefix}-${dataset.name}-used`;
					const colorName = `${prefix}-${dataset.name}-color`;

					if (dataset.vue_meter) {
						this.addDataSet(keyName, colorName);
					}

					graph.addDataSet(keyName, colorName);

					const label = new St.Label({
						style_class: 'description_label',
					});

					const value = new St.Label({
						style_class: 'value_label',
					});

					const box = new St.Bin({
						style_class: `color_label bg-${prefix}-${dataset.name}-color`,
						xExpand: false,
						yExpand: false,
						reactive: false,
						xAlign: Clutter.ActorAlign.CENTER,
						yAlign: Clutter.ActorAlign.CENTER,
					});

					this.currentColors[dataset.name] = box;
					this.currentLabels[dataset.name] = label;
					this.currentValues[dataset.name] = value;

					label.set_text(dataset.label);

					offsetY++;
					this.dropdownLayout.attach(box, 0, offsetY, 1, 1);
					this.dropdownLayout.attach(label, 1, offsetY, 1, 1);
					this.dropdownLayout.attach(value, 2, offsetY, 1, 1);
				}
			}
		}
	}
);

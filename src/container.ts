import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import Indicator from './indicator.js';
import { Constantes } from './types.js';

import CpuIndicator from './indicators/cpu.js';
import MemoryIndicator from './indicators/memory.js';
import NetworkIndicator from './indicators/network.js';
import SwapIndicator from './indicators/swap.js';

const INDICATORS = [CpuIndicator, MemoryIndicator, SwapIndicator, NetworkIndicator];

export default GObject.registerClass(
	class GnomeStatsProContainer extends PanelMenu.Button {
		private resetHoverTimeoutId = 0;
		private showPopupTimeoutId = 0;
		private popupShowing: boolean = false;
		private box?: St.BoxLayout;
		private indicators: InstanceType<typeof Indicator>[] = [];
		public uuid = '';

		constructor() {
			super(0, 'VueMeterMonitor.Container');

			this.box = new St.BoxLayout({
				style_class: 'gsp-container',
				vertical: false,
				xExpand: true,
				yExpand: true,
				x_align: Clutter.ActorAlign.START,
				y_align: Clutter.ActorAlign.FILL,
			});

			this.add_child(this.box);
			this.remove_style_class_name('panel-button');

			for (const IndicatorBuilder of INDICATORS) {
				const indicator = new IndicatorBuilder();

				indicator.connect('notify::hover', () => {
					this._onHover(indicator);
				});

				this.box.add_child(indicator);
				this.indicators.push(indicator);
				indicator.enable();
			}
		}

		destroy(): void {
			this.indicators.forEach(i => {
				i.destroy();
			});

			if (this.box) this.remove_child(this.box);

			this.box?.destroy();

			super.destroy();
		}

		_onHover(item: InstanceType<typeof Indicator>) {
			if (item.get_hover()) {
				if (!this.showPopupTimeoutId) {
					const timeout = this.popupShowing ? 0 : Constantes.ITEM_HOVER_TIMEOUT;

					if (this.showPopupTimeoutId === 0) {
						this.showPopupTimeoutId = GLib.timeout_add(
							GLib.PRIORITY_DEFAULT,
							timeout,
							() => {
								this.popupShowing = true;
								item.showPopup();
								this.showPopupTimeoutId = 0;

								return false;
							}
						);
					}

					if (this.resetHoverTimeoutId) {
						GLib.source_remove(this.resetHoverTimeoutId);
						this.resetHoverTimeoutId = 0;
					}
				}
			} else {
				if (this.showPopupTimeoutId !== 0) {
					GLib.source_remove(this.showPopupTimeoutId);
					this.showPopupTimeoutId = 0;
				}

				item.hidePopup();

				if (this.popupShowing && this.resetHoverTimeoutId === 0) {
					this.resetHoverTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 0, () => {
						this.popupShowing = false;
						this.resetHoverTimeoutId = 0;
						return false;
					});
				}
			}
		}

		place(uuid: string) {
			this.uuid = uuid;
			Main.panel.addToStatusArea(this.uuid, this, 0, 'right');
		}
	}
);

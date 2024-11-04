import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GTop from 'gi://GTop';
import NM from 'gi://NM';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator from '../indicator.js';
import { Constantes, Dictionary } from '../types.js';
import Utils from '../utils.js';

const ACCUM_PROPERTIES = ['bytes_in', 'bytes_out', 'errors_in', 'errors_out'];

export default GObject.registerClass(
	class NetworkIndicator extends Indicator {
		private devices: string[] = [];

		private _last: Dictionary<number> = {
			bytes_in: 0,
			bytes_out: 0,
			errors_in: 0,
			errors_out: 0,
			collisions: 0,
		};

		private _usage: Dictionary<number> = {
			bytes_in: 0,
			bytes_out: 0,
			errors_in: 0,
			errors_out: 0,
			collisions: 0,
		};

		private _previous: Dictionary<number> = {
			bytes_in: -1,
			bytes_out: -1,
			errors_in: -1,
			errors_out: -1,
			collisions: -1,
		};

		private _nmclient = new NM.Client();
		private _gtop = new GTop.glibtop_netload();
		private _last_time = 0;
		private units = Utils.bitsPerSecond ? 'b/s' : 'B/s';
		private unit_factor = Utils.bitsPerSecond ? 8 : 1;

		constructor() {
			super('VueMeterMonitor.NetworkIndicator');

			this.datasetNames = [
				{
					name: 'current',
					label: _('Current:'),
					vue_meter: false,
					header: true,
					registre: '',
					color: Constantes.WHITE,
				},
				{
					name: 'in',
					label: _('Inbound'),
					vue_meter: true,
					header: false,
					registre: 'bytes_in',
					color: Utils.fromStyles({
						red: 10,
						green: 216,
						blue: 68,
						alpha: 255,
					}),
				},
				{
					name: 'out',
					label: _('Outbound'),
					vue_meter: true,
					header: false,
					registre: 'bytes_out',
					color: Utils.fromStyles({
						red: 255,
						green: 20,
						blue: 20,
						alpha: 255,
					}),
				},
				{
					name: 'maximum',
					label: _('Maximum (decay over 2 hours):'),
					vue_meter: false,
					header: true,
					registre: '',
					color: Constantes.WHITE,
				},
				{
					name: 'max-in',
					label: _('Inbound'),
					vue_meter: false,
					header: false,
					registre: 'bytes_in',
					color: Utils.fromStyles({
						red: 216,
						green: 202,
						blue: 10,
						alpha: 255,
					}),
				},
				{
					name: 'max-out',
					label: _('Outbound'),
					vue_meter: false,
					header: false,
					registre: 'bytes_out',
					color: Utils.fromStyles({
						red: 4,
						green: 0,
						blue: 240,
						alpha: 255,
					}),
				},
			];

			this.graph = new HorizontalGraph('NetworkIndicatorGraph', {
				units: Utils.bitsPerSecond ? 'b/s' : 'B/s',
			});

			this.buildPopup(this.datasetNames, this.graph, 'network');

			Utils.settings?.connect(
				'changed::bits-per-second',
				(sender: Gio.Settings, key: string) => {
					Utils.bitsPerSecond = sender.get_boolean(key);
					this.units = Utils.bitsPerSecond ? 'b/s' : 'B/s';
					this.unit_factor = Utils.bitsPerSecond ? 8 : 1;
					this.graph?.updateMaxLabel();
				}
			);

			this._nmclient?.connect('device-added', this._update_iface_list.bind(this));
			this._nmclient?.connect('device-removed', this._update_iface_list.bind(this));

			this._update_iface_list();
			this.enable();
		}

		_update_iface_list() {
			try {
				const buf = new GTop.glibtop_netlist();
				this.devices = GTop.glibtop_get_netlist(buf);
			} catch (e) {
				Utils.error('Please install Network Manager GObject Introspection Bindings:' + e);
			}
		}

		updateValues() {
			const accum: Dictionary<number> = {
				bytes_in: 0,
				bytes_out: 0,
				errors_in: 0,
				errors_out: 0,
				collisions: 0,
			};

			for (const infName of this.devices) {
				GTop.glibtop_get_netload(this._gtop, infName);

				accum.bytes_in += this._gtop.bytes_in;
				accum.bytes_out += this._gtop.bytes_out;
				accum.errors_in += this._gtop.errors_in;
				accum.errors_out += this._gtop.errors_out;
				accum.collisions += this._gtop.collisions;
			}

			const time = GLib.get_monotonic_time() * 0.000001024; // seconds
			const delta = time - this._last_time;
			const lambda = 0.9999;

			let value: number;

			if (delta > 0) {
				for (const propName of ACCUM_PROPERTIES) {
					this._usage[propName] = (accum[propName] - this._last[propName]) / delta;
					this._last[propName] = accum[propName];
				}

				/* exponential decay over around 2 hours at 250 interval */
				let firstRun = true;

				for (const propName of ACCUM_PROPERTIES) {
					value = this._previous[propName];

					if (value !== -1) {
						value = Math.max(this._usage[propName], lambda * value);
						firstRun = false;
					} else {
						value = this._usage[propName];
					}

					this._previous[propName] = value;
				}

				if (firstRun) {
					this._previous.bytes_in = 1024;
					this._previous.bytes_out = 1024;
				} else {
					for (const dataset of this.datasetNames) {
						if (dataset.header === false) {
							const propName = dataset.registre;
							const keyName = `network-${dataset.name}-used`;
							const errorKey = `errors_${dataset.name}`;

							value = this._usage[propName];

							if (dataset.vue_meter) {
								let colorName = `network-${dataset.name}-color`;

								if (this._previous[errorKey] > 0 || this._previous.collisions > 0) {
									colorName = 'network-bad-color';
								}

								this.graph?.addDataPoint(keyName, value);
								this.addDataPointWithColor(
									keyName,
									value / this._previous[propName],
									colorName
								);
							} else {
								value = this._previous[propName];

								this.graph?.addDataPoint(keyName, value);
							}

							const strValue = Utils.formatMetricPretty(
								value * this.unit_factor,
								this.units
							);

							this.currentValues[dataset.name].set_text(strValue);
						}
					}
				}

				this._last_time = time;
			}
		}
	}
);

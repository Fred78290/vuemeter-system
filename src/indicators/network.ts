import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GTop from 'gi://GTop';
import NM from 'gi://NM';
import St from 'gi://St';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator from '../indicator.js';
import Utils from '../utils.js';

class DeviceInfo {
	device: NM.Device;
	signal: number = 0;

	constructor(nm: NM.Device, update_iface_list: () => void) {
		this.device = nm;
		this.signal = nm.connect(
			'state-changed',
			(_source: this, _new_state: number, _old_state: number, _reason: number) => {
				update_iface_list();
			}
		);
	}

	get name(): string {
		return this.device.get_ip_iface() || this.device.get_iface();
	}

	get speed(): number {
		return this.device instanceof NM.DeviceEthernet ? this.device.get_speed() : 0;
	}

	get activated(): boolean {
		return this.device?.state === NM.DeviceState.ACTIVATED;
	}

	disconnect() {
		const a: any = this.device;
		a.disconnect(this.signal);
	}
}

export default GObject.registerClass(
	class NetworkIndicator extends Indicator {
		current_label: St.Label;
		current_in_label: St.Label;
		current_in_value: St.Label;
		current_out_label: St.Label;
		current_out_value: St.Label;
		maximum_label: St.Label;
		maximum_in_label: St.Label;
		maximum_in_value: St.Label;
		maximum_out_label: St.Label;
		maximum_out_value: St.Label;

		devices: DeviceInfo[] = [];
		_last: number[] = [0, 0, 0, 0, 0];
		_usage: number[] = [0, 0, 0, 0, 0];
		_usedp: number = 0;
		_previous: number[] = [-1, -1, -1, -1, -1];
		_nmclient = new NM.Client();
		_gtop = new GTop.glibtop_netload();
		_last_time = 0;
		_total = 0;

		constructor() {
			super('GnomeStatsPro2.NetworkIndicator');

			this.current_label = new St.Label({ style_class: 'title_label' });
			this.current_label.set_text(_('Current:'));

			this.current_in_label = new St.Label({ style_class: 'description_label' });
			this.current_in_label.set_text(_('Inbound'));
			this.current_in_value = new St.Label({ style_class: 'value_label' });

			this.current_out_label = new St.Label({ style_class: 'description_label' });
			this.current_out_label.set_text(_('Outbound'));
			this.current_out_value = new St.Label({ style_class: 'value_label' });

			this.maximum_label = new St.Label({ style_class: 'title_label' });
			this.maximum_label.set_text(_('Maximum (over 2 hours):'));

			this.maximum_in_label = new St.Label({ style_class: 'description_label' });
			this.maximum_in_label.set_text(_('Inbound'));
			this.maximum_in_value = new St.Label({ style_class: 'value_label' });

			this.maximum_out_label = new St.Label({ style_class: 'description_label' });
			this.maximum_out_label.set_text(_('Outbound'));
			this.maximum_out_value = new St.Label({ style_class: 'value_label' });

			this.graph = new HorizontalGraph({ units: 'b/s' });
			this.graph.addDataSet('network-in-used', 'network-in-color');
			this.graph.addDataSet('network-out-used', 'network-out-color');

			this.dropdownLayout.attach(this.graph, 0, 0, 2, 1);

			const x = 0,
				y = 1;
			this.dropdownLayout.attach(this.current_label, x + 0, y + 0, 2, 1);
			this.dropdownLayout.attach(this.current_in_label, x + 0, y + 1, 1, 1);
			this.dropdownLayout.attach(this.current_in_value, x + 1, y + 1, 1, 1);
			this.dropdownLayout.attach(this.current_out_label, x + 0, y + 2, 1, 1);
			this.dropdownLayout.attach(this.current_out_value, x + 1, y + 2, 1, 1);

			this.dropdownLayout.attach(this.maximum_label, x + 0, y + 3, 2, 1);
			this.dropdownLayout.attach(this.maximum_in_label, x + 0, y + 4, 1, 1);
			this.dropdownLayout.attach(this.maximum_in_value, x + 1, y + 4, 1, 1);
			this.dropdownLayout.attach(this.maximum_out_label, x + 0, y + 5, 1, 1);
			this.dropdownLayout.attach(this.maximum_out_value, x + 1, y + 5, 1, 1);

			this._update_iface_list();

			this._nmclient?.connect('device-added', () => {
				this._update_iface_list();
			});

			this._nmclient?.connect('device-removed', () => {
				this._update_iface_list();
			});

			this.addDataSet('network-in-used', 'network-ok-color');
			this.addDataSet('network-out-used', 'network-ok-color');
			this.enable();
		}

		_update_iface_list() {
			try {
				for (const device of this.devices) {
					device.disconnect();
				}

				this.devices = [];

				for (const nm of this._nmclient.get_devices()) {
					const device: DeviceInfo = new DeviceInfo(nm, this._update_iface_list);

					this.devices.push(device);
				}
			} catch (e) {
				Utils.error('Please install Network Manager GObject Introspection Bindings:' + e);
			}
		}

		updateValues() {
			const accum = [0, 0, 0, 0, 0, 0];

			for (const device of this.devices) {
				if (device.activated) {
					GTop.glibtop_get_netload(this._gtop, device.name);

					accum[0] += this._gtop.bytes_in;
					accum[1] += this._gtop.errors_in;
					accum[2] += this._gtop.bytes_out;
					accum[3] += this._gtop.errors_out;
					accum[4] += this._gtop.collisions;
					accum[5] += device.speed;
				}
			}

			const time = GLib.get_monotonic_time() * 0.000001024; // seconds
			const delta = time - this._last_time;

			if (delta > 0) {
				for (let i = 0; i < 5; i++) {
					this._usage[i] = (accum[i] - this._last[i]) / delta;
					this._last[i] = accum[i];
				}

				/* Convert traffic to bits per second */
				// TODO: Create option for bits/bytes shown in graph.
				this._usage[0] *= 8;
				this._usage[2] *= 8;

				/* exponential decay over around 2 hours at 250 interval */
				let firstRun = true;

				for (let i = 0; i < 5; i++) {
					if (this._previous[i] !== -1) {
						const lambda = 0.9999;
						this._previous[i] = Math.max(this._usage[i], lambda * this._previous[i]);
						firstRun = false;
					} else {
						this._previous[i] = this._usage[i];
					}
				}

				if (firstRun) {
					this._previous[0] = 56 * 1024;
					this._previous[2] = 56 * 1024;
				} else {
					/* Store current traffic values */
					this.addDataPoint('network-in-used', this._usage[0] / this._previous[0]);
					this.addDataPoint('network-out-used', this._usage[2] / this._previous[2]);

					this.graph?.addDataPoint('network-in-used', this._usage[0]);
					this.graph?.addDataPoint('network-out-used', this._usage[2]);

					const in_value = '%sb/s'.format(this._usage[0].formatMetricPretty());
					this.current_in_value.set_text(in_value);

					const out_value = '%sb/s'.format(this._usage[2].formatMetricPretty());
					this.current_out_value.set_text(out_value);

					const max_in_value = '%sb/s'.format(this._previous[0].formatMetricPretty());
					this.maximum_in_value.set_text(max_in_value);

					const max_out_value = '%sb/s'.format(this._previous[2].formatMetricPretty());
					this.maximum_out_value.set_text(max_out_value);
				}

				/* Report errors for incoming traffic */
				if (this._previous[1] > 0 || this._previous[4] > 0) {
					this.stats['network-in-used'].color = 'network-bad-color';
				} else {
					this.stats['network-in-used'].color = 'network-ok-color';
				}

				/* Report errors for outgoing traffic */
				if (this._previous[3] > 0 || this._previous[4] > 0) {
					this.stats['network-out-used'].color = 'network-bad-color';
				} else {
					this.stats['network-out-used'].color = 'network-ok-color';
				}
			}

			this._last_time = time;
		}
	}
);

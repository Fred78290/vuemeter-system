import GObject from 'gi://GObject';
import GTop from 'gi://GTop';
import St from 'gi://St';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator from '../indicator.js';
import Utils from '../utils.js';

export default GObject.registerClass(
	class CpuIndicator extends Indicator {
		current_label: St.Label;
		current_cpu_label: St.Label;
		current_cpu_value: St.Label;
		ncpu = 1;
		previousCpuInfos = new GTop.glibtop_cpu();
		percentUseCpu: number[] = [];

		constructor() {
			super('GnomeStatsPro2.CpuIndicator');

			GTop.glibtop_get_cpu(this.previousCpuInfos);

			try {
				this.ncpu = GTop.glibtop_get_sysinfo().ncpu;
			} catch (e) {
				Utils.error(e);
			}

			// populate statistics variables
			for (let cpu = 0; cpu < this.ncpu; cpu++) {
				const key = 'cpu_' + cpu;

				this.addDataSet(key, 'cpu-color');
				this.percentUseCpu[cpu] = 0;
			}

			this.current_label = new St.Label({ style_class: 'title_label' });
			this.current_label.set_text(_('Current:'));

			this.current_cpu_label = new St.Label({ style_class: 'description_label' });
			this.current_cpu_label.set_text(_('Total CPU usage'));
			this.current_cpu_value = new St.Label({ style_class: 'value_label' });

			this.graph = new HorizontalGraph({
				autoscale: false,
				max: 100,
				units: '%',
				showMax: false,
			});

			this.graph.addDataSet('cpu-usage', 'cpu-color');

			this.dropdownLayout.attach(this.graph, 0, 0, 2, 1);
			this.dropdownLayout.attach(this.current_label, 0, 1, 2, 1);
			this.dropdownLayout.attach(this.current_cpu_label, 0, 2, 1, 1);
			this.dropdownLayout.attach(this.current_cpu_value, 1, 2, 1, 1);

			this.enable();
		}

		updateValues() {
			// Query current iteration CPU statistics
			const cpu = new GTop.glibtop_cpu();
			let cpu_ttl_usage = 0;

			GTop.glibtop_get_cpu(cpu);

			// Collect per-CPU statistics
			for (let i = 0; i < this.ncpu; ++i) {
				const total = Math.max(cpu.xcpu_total[i] - this.previousCpuInfos.xcpu_total[i], 0);
				const idle = Math.max(cpu.xcpu_idle[i] - this.previousCpuInfos.xcpu_idle[i], 0);
				const key = 'cpu_' + i;
				let reading = 0;

				if (total > 0) {
					reading = 1.0 - idle / total;
				}

				cpu_ttl_usage += reading;

				const decayed_value = Math.min(
					this.percentUseCpu[i] * this.options.decay,
					0.999999999
				);
				const value = Math.max(reading, decayed_value);

				this.addDataPoint(key, value);

				this.percentUseCpu[i] = value;
			}

			cpu_ttl_usage /= this.ncpu;
			cpu_ttl_usage *= 100;

			this.graph?.addDataPoint('cpu-usage', cpu_ttl_usage);

			const cpu_ttl_text = '%s%%'.format(cpu_ttl_usage.formatMetricPretty(''));

			this.current_cpu_value.set_text(cpu_ttl_text);

			// Store this iteration for next calculation run
			this.previousCpuInfos = cpu;
		}
	}
);

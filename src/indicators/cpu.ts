import GObject from 'gi://GObject';
import GTop from 'gi://GTop';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator, { IndicatorStatValue, IndicatorStatValues } from '../indicator.js';
import { Constantes, Dictionary } from '../types.js';
import Utils from '../utils.js';

type CpuUsage = Dictionary<number>;

export default GObject.registerClass(
	class CpuIndicator extends Indicator {
		ncpu = 1;
		previousCpuInfos = new GTop.glibtop_cpu();
		percentUseCpu: CpuUsage[] = [];

		constructor() {
			super('VueMeterMonitor.CpuIndicator');

			this.datasetNames = [
				{
					name: 'none',
					label: _('Current:'),
					vue_meter: false,
					header: true,
					registre: '',
					color: Constantes.WHITE,
				},
				{
					name: 'user',
					label: _('User CPU usage'),
					vue_meter: false,
					header: false,
					registre: 'xcpu_user',
					color: Utils.fromStyles({
						red: 10,
						blue: 10,
						green: 216,
						alpha: 1,
					}),
				},
				{
					name: 'sys',
					label: _('System CPU usage'),
					vue_meter: true,
					header: false,
					registre: 'xcpu_sys',
					color: Utils.fromStyles({
						red: 255,
						blue: 20,
						green: 20,
						alpha: 1,
					}),
				},
				{
					name: 'total',
					label: _('Total CPU usage'),
					vue_meter: true,
					header: false,
					registre: 'xcpu_total',
					color: Utils.fromStyles({
						red: 0,
						blue: 154,
						green: 62,
						alpha: 1,
					}),
				},
			];

			GTop.glibtop_get_cpu(this.previousCpuInfos);

			try {
				this.ncpu = GTop.glibtop_get_sysinfo().ncpu;
			} catch (e) {
				Utils.error(e);
			}

			// populate statistics variables
			for (let cpu = 0; cpu < this.ncpu; cpu++) {
				this.addDataSet('cpu_' + cpu, `cpu-color`);

				this.percentUseCpu[cpu] = {
					xcpu_total: 0,
					xcpu_user: 0,
					xcpu_sys: 0,
				};
			}

			this.graph = new HorizontalGraph('CpuIndicatorGraph', {
				autoscale: false,
				max: 100,
				units: '%',
				showMax: false,
			});

			this.buildPopup(this.datasetNames, this.graph, 'cpu');
			this.enable();
		}

		updateValues() {
			// Query current iteration CPU statistics
			const cpu = new GTop.glibtop_cpu();
			const cpu_ttl_usage: Dictionary<number> = {
				xcpu_total: 0,
				xcpu_user: 0,
				xcpu_sys: 0,
			};

			GTop.glibtop_get_cpu(cpu);

			/*Utils.debug(
				JSON.stringify({
					flags: cpu.flags,
					total: cpu.total,
					user: cpu.user,
					nice: cpu.nice,
					sys: cpu.sys,
					idle: cpu.idle,
					iowait: cpu.iowait,
					irq: cpu.irq,
					softirq: cpu.softirq,
					frequency: cpu.frequency,
				})
			);*/

			// Collect per-CPU statistics
			for (let index = 0; index < this.ncpu; ++index) {
				const previous: Dictionary<number> = {
					xcpu_total: this.previousCpuInfos.xcpu_total[index],
					xcpu_user: this.previousCpuInfos.xcpu_user[index],
					xcpu_sys: this.previousCpuInfos.xcpu_sys[index],
					xcpu_idle: this.previousCpuInfos.xcpu_idle[index],
				};

				const current: Dictionary<number> = {
					xcpu_total: cpu.xcpu_total[index],
					xcpu_user: cpu.xcpu_user[index],
					xcpu_sys: cpu.xcpu_sys[index],
					xcpu_idle: cpu.xcpu_idle[index],
				};

				/*Utils.debug(
					JSON.stringify({
						xcpu_total: cpu.xcpu_total[i],
						xcpu_user: cpu.xcpu_user[i],
						xcpu_nice: cpu.xcpu_nice[i],
						xcpu_sys: cpu.xcpu_sys[i],
						xcpu_idle: cpu.xcpu_idle[i],
						xcpu_iowait: cpu.xcpu_iowait[i],
						xcpu_irq: cpu.xcpu_irq[i],
						xcpu_softirq: cpu.xcpu_softirq[i],
					})
				);*/

				const statValues: IndicatorStatValues = {
					values: [],
				};

				for (const dataset of this.datasetNames) {
					if (dataset.header === false) {
						const registre = dataset.registre;
						const currentDelta = Math.max(current[registre] - previous[registre], 0);
						let reading = 0;

						if (dataset.name === 'total') {
							const idle = Math.max(current.xcpu_idle - previous.xcpu_idle, 0);
							if (currentDelta > 0) {
								reading = 1.0 - idle / currentDelta;
							}
						} else {
							const totalDelta = Math.max(
								current.xcpu_total - previous.xcpu_total,
								0
							);

							if (totalDelta > 0) {
								reading = currentDelta / totalDelta;
							}
						}

						cpu_ttl_usage[registre] += reading;

						const decayed_value = Math.min(
							this.percentUseCpu[index][registre] * this.options.decay,
							0.999999999
						);

						const statValue: IndicatorStatValue = {
							visible: dataset.vue_meter,
							//value: Math.min(1, (index + 1) * 0.25),
							value: Math.max(reading, decayed_value),
							color: `cpu-${dataset.name}-color`,
							cairo_color: dataset.color,
						};

						if (dataset.vue_meter) {
							statValues.values.push(statValue);
						}

						this.percentUseCpu[index][registre] = statValue.value;
					}
				}

				this.addDataPoint('cpu_' + index, statValues);
			}

			for (const dataset of this.datasetNames) {
				if (dataset.header === false) {
					const registre = dataset.registre;
					const keyName = `cpu-${dataset.name}-used`;
					const value = (cpu_ttl_usage[registre] * 100) / this.ncpu;
					const cpu_ttl_text = '%s%%'.format(Utils.formatMetricPretty(value));

					cpu_ttl_usage[registre] = value;

					this.graph?.addDataPoint(keyName, value);

					this.currentValues[dataset.name].set_text(cpu_ttl_text);
				}
			}

			// Store this iteration for next calculation run
			this.previousCpuInfos = cpu;
		}
	}
);

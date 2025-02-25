import GObject from 'gi://GObject';
import GTop from 'gi://GTop';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator from '../indicator.js';
import { Constantes, Dictionary } from '../types.js';
import Utils from '../utils.js';

export default GObject.registerClass(
	class MemoryIndicator extends Indicator {
		constructor() {
			const memoryInfos = new GTop.glibtop_mem();

			super('VueMeterMonitor.MemoryIndicator', {
				updateInterval: 1000,
			});

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
					name: 'used',
					label: _('Total memory usage'),
					vue_meter: true,
					header: false,
					registre: 'used',
					color: Utils.fromStyles({
						red: 10,
						green: 216,
						blue: 68,
						alpha: 255,
					}),
				},
				{
					name: 'buffer',
					label: _('Total buffer usage'),
					vue_meter: false,
					header: false,
					registre: 'buffer',
					color: Utils.fromStyles({
						red: 240,
						green: 85,
						blue: 0,
						alpha: 255,
					}),
				},
				{
					name: 'shared',
					label: _('Total shared usage'),
					vue_meter: false,
					header: false,
					registre: 'shared',
					color: Utils.fromStyles({
						red: 220,
						green: 0,
						blue: 240,
						alpha: 255,
					}),
				},
				{
					name: 'cached',
					label: _('Total cache usage'),
					vue_meter: false,
					header: false,
					registre: 'cached',
					color: Utils.fromStyles({
						red: 90,
						green: 90,
						blue: 40,
						alpha: 255,
					}),
				},
				{
					name: 'user',
					label: _('Total user usage'),
					vue_meter: false,
					header: false,
					registre: 'user',
					color: Utils.fromStyles({
						red: 10,
						green: 216,
						blue: 68,
						alpha: 255,
					}),
				},
				{
					name: 'locked',
					label: _('Total locked usage'),
					vue_meter: false,
					header: false,
					registre: 'locked',
					color: Utils.fromStyles({
						red: 255,
						green: 20,
						blue: 20,
						alpha: 255,
					}),
				},
				{
					name: 'free',
					label: _('Total free usage'),
					vue_meter: false,
					header: false,
					registre: 'free',
					color: Utils.fromStyles({
						red: 240,
						green: 190,
						blue: 0,
						alpha: 255,
					}),
				},
				{
					name: 'total',
					label: _('Total RAM present'),
					vue_meter: false,
					header: false,
					registre: '',
					color: Constantes.DEFAULT_STATS_COLOR,
				},
			];

			GTop.glibtop_get_mem(memoryInfos);

			this.graph = new HorizontalGraph('MemoryIndicatorGraph', {
				autoscale: false,
				units: 'B',
				fillAll: true,
				max: memoryInfos.total,
			});

			this.buildPopup(this.datasetNames, this.graph, 'mem');
			this.enable();
		}

		protected updateStyles() {
			super.updateStyles();

			//if (this.is_mapped()) {
			//	for (const dataset of this.datasetNames) {
			//		const bgColor = this.lookupColor(`mem-${dataset.name}-color`, dataset.color);
			//
			//					this.currentMemColors[dataset.name].style =
			//						`background-color: rgba(${bgColor.red}, ${bgColor.green}, ${bgColor.blue}, ${bgColor.alpha})`;

			/*const [hasColor, color] = Cogl.Color.from_string(
						`rgba(${bgColor.red}, ${bgColor.green}, ${bgColor.blue}, ${bgColor.alpha})`
					);

					if (hasColor) {
						this.currentMemColors[dataset.name].backgroundColor = color;
					}*/
			//				}
			//			}
		}

		updateValues() {
			const memoryInfos = new GTop.glibtop_mem();

			GTop.glibtop_get_mem(memoryInfos);

			const memInfos: Dictionary<number> = {
				total: memoryInfos.total,
				used: memoryInfos.used - memoryInfos.cached,
				free: memoryInfos.free,
				shared: memoryInfos.shared,
				buffer: memoryInfos.buffer,
				cached: memoryInfos.cached,
				user: memoryInfos.user,
				locked: memoryInfos.locked,
			};

			for (const dataset of this.datasetNames) {
				if (dataset.header === false) {
					const keyName = `mem-${dataset.registre}-used`;
					const value = memInfos[dataset.name];

					if (dataset.vue_meter) {
						this.addDataPoint(keyName, value / memInfos.total);
					}

					if (dataset.registre.length > 0) {
						this.graph?.addDataPoint(keyName, value);
					}

					const mem_ttl_text = '%s'.format(Utils.formatMetricPretty(value, 'B'));
					this.currentValues[dataset.name].set_text(mem_ttl_text);
				}
			}
		}
	}
);

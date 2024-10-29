import GObject from 'gi://GObject';
import GTop from 'gi://GTop';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator from '../indicator.js';
import { Constantes, Dictionary } from '../types.js';
import Utils from '../utils.js';

export default GObject.registerClass(
	class SwapIndicator extends Indicator {
		swapInfos = new GTop.glibtop_swap();

		private _previous: Dictionary<number> = {
			total: 0,
			used: 0,
			free: 0,
			pagein: 0,
			pageout: 0,
		};

		constructor() {
			super('VueMeterMonitor.SwapIndicator', {
				updateInterval: 2000,
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
					label: _('Total swap usage'),
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
					name: 'pagein',
					label: _('Pagein swap usage'),
					vue_meter: false,
					header: false,
					registre: 'pagein',
					color: Utils.fromStyles({
						red: 10,
						green: 216,
						blue: 68,
						alpha: 255,
					}),
				},
				{
					name: 'pageout',
					label: _('Pageout swap usage'),
					vue_meter: false,
					header: false,
					registre: 'pageout',
					color: Utils.fromStyles({
						red: 10,
						green: 216,
						blue: 68,
						alpha: 255,
					}),
				},
			];

			this.graph = new HorizontalGraph('SwapIndicatorGraph', {
				autoscale: false,
				max: this.swapInfos.total,
				units: 'B',
			});

			this.buildPopup(this.datasetNames, this.graph, 'swap');
			this.enable();
		}

		updateValues() {
			GTop.glibtop_get_swap(this.swapInfos);

			const current: Dictionary<number> = {
				total: this.swapInfos.total,
				used: this.swapInfos.used,
				free: this.swapInfos.free,
				pagein: this.swapInfos.pagein,
				pageout: this.swapInfos.pageout,
			};

			for (const dataset of this.datasetNames) {
				if (dataset.header === false) {
					const keyName = `swap-${dataset.name}-used`;

					let value = current[dataset.registre];

					if (dataset.vue_meter) {
						let delta = 0;
						let color = `swap-${dataset.name}-color`;

						if (current.total > 0) {
							delta = value / this.swapInfos.total;
						}

						if (delta > 0.5) {
							color = 'swap-used-bad-color';
						} else if (delta > 0.25) {
							color = 'swap-used-warn-color';
						}

						this.addDataPointWithColor(keyName, delta, color);

						const swap_ttl_text = '%s'.format(value.formatMetricPretty('B'));

						this.currentValues[dataset.name].set_text(swap_ttl_text);
					} else {
						const previous = this._previous[dataset.registre];

						this.currentValues[dataset.name].set_text(`${value} pages`);

						if (previous > 0) {
							value = value / previous;
						} else {
							value = 0;
						}
					}

					this.graph?.addDataPoint(keyName, value);
				}
			}

			this._previous = current;
		}
	}
);

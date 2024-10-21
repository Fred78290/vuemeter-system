import GObject from 'gi://GObject';
import GTop from 'gi://GTop';
import St from 'gi://St';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator from '../indicator.js';

export default GObject.registerClass(
	class SwapIndicator extends Indicator {
		current_label: St.Label;
		current_swap_label: St.Label;
		current_swap_value: St.Label;
		swapInfos = new GTop.glibtop_swap();

		constructor() {
			super('GnomeStatsPro2.SwapIndicator', {
				updateInterval: 2000,
			});

			this.addDataSet('swap-used', 'swap-used-color');

			this.current_label = new St.Label({ style_class: 'title_label' });
			this.current_label.set_text(_('Current:'));

			this.current_swap_label = new St.Label({ style_class: 'description_label' });
			this.current_swap_label.set_text(_('Total swap usage'));
			this.current_swap_value = new St.Label({ style_class: 'value_label' });

			GTop.glibtop_get_swap(this.swapInfos);

			this.graph = new HorizontalGraph({
				autoscale: false,
				max: this.swapInfos.total,
				units: 'B',
			});
			this.graph.addDataSet('swap-used', 'swap-used-color');

			this.dropdownLayout.attach(this.graph, 0, 0, 2, 1);

			const x = 0,
				y = 1;
			this.dropdownLayout.attach(this.current_label, x + 0, y + 0, 2, 1);
			this.dropdownLayout.attach(this.current_swap_label, x + 0, y + 1, 1, 1);
			this.dropdownLayout.attach(this.current_swap_value, x + 1, y + 1, 1, 1);

			this.enable();
		}

		updateValues() {
			GTop.glibtop_get_swap(this.swapInfos);

			const t = this.swapInfos.used / this.swapInfos.total;
			this.addDataPoint('swap-used', t);

			this.graph?.addDataPoint('swap-used', this.swapInfos.used);

			const swap_ttl_text = '%s'.format(this.swapInfos.used.formatMetricPretty('B'));
			this.current_swap_value.set_text(swap_ttl_text);

			if (t > 0.5) {
				this.stats['swap-used'].color = 'swap-used-bad-color';
			} else if (t > 0.25) {
				this.stats['swap-used'].color = 'swap-used-warn-color';
			} else {
				this.stats['swap-used'].color = 'swap-used-color';
			}
		}
	}
);

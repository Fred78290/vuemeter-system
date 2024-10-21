import GObject from 'gi://GObject';
import GTop from 'gi://GTop';
import St from 'gi://St';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import HorizontalGraph from '../horizontalgraph.js';
import Indicator from '../indicator.js';

export default GObject.registerClass(
	class MemoryIndicator extends Indicator {
		current_label: St.Label;
		current_mem_used_label: St.Label;
		current_mem_used_value: St.Label;
		current_mem_buffer_label: St.Label;
		current_mem_buffer_value: St.Label;
		current_mem_shared_label: St.Label;
		current_mem_shared_value: St.Label;
		current_mem_cached_label: St.Label;
		current_mem_cached_value: St.Label;
		current_mem_user_label: St.Label;
		current_mem_user_value: St.Label;
		current_mem_locked_label: St.Label;
		current_mem_locked_value: St.Label;
		current_mem_free_label: St.Label;
		current_mem_free_value: St.Label;
		current_mem_total_label: St.Label;
		current_mem_total_value: St.Label;
		memoryInfos = new GTop.glibtop_mem();

		constructor() {
			let offsetY = 1;

			super('GnomeStatsPro2.MemoryIndicator', {
				updateInterval: 1000,
			});

			this.addDataSet('mem-used', 'mem-used-color');

			this.current_label = new St.Label({ style_class: 'title_label' });
			this.current_label.set_text(_('Current:'));

			// used, buffer, shared, cached, slab, locked, free, total
			this.current_mem_used_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_used_label.set_text(_('Total memory usage'));
			this.current_mem_used_value = new St.Label({ style_class: 'value_label' });

			this.current_mem_buffer_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_buffer_label.set_text(_('Total buffer usage'));
			this.current_mem_buffer_value = new St.Label({ style_class: 'value_label' });

			this.current_mem_shared_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_shared_label.set_text(_('Total shared usage'));
			this.current_mem_shared_value = new St.Label({ style_class: 'value_label' });

			this.current_mem_cached_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_cached_label.set_text(_('Total cache usage'));
			this.current_mem_cached_value = new St.Label({ style_class: 'value_label' });

			this.current_mem_user_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_user_label.set_text(_('Total user usage'));
			this.current_mem_user_value = new St.Label({ style_class: 'value_label' });

			this.current_mem_locked_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_locked_label.set_text(_('Total locked usage'));
			this.current_mem_locked_value = new St.Label({ style_class: 'value_label' });

			this.current_mem_free_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_free_label.set_text(_('Total free usage'));
			this.current_mem_free_value = new St.Label({ style_class: 'value_label' });

			this.current_mem_total_label = new St.Label({ style_class: 'description_label' });
			this.current_mem_total_label.set_text(_('Total RAM present'));
			this.current_mem_total_value = new St.Label({ style_class: 'value_label' });

			GTop.glibtop_get_mem(this.memoryInfos);

			this.graph = new HorizontalGraph({
				autoscale: false,
				units: 'B',
				max: this.memoryInfos.total,
			});
			this.graph.addDataSet('mem-used', 'mem-used-color');

			this.dropdownLayout.attach(this.graph, 0, 0, 2, 1);
			this.dropdownLayout.attach(this.current_label, 0, offsetY + 0, 2, 1);

			// used, buffer, shared, cached, slab, locked, free, total
			this.dropdownLayout.attach(this.current_mem_used_label, 0, offsetY + 1, 1, 1);
			this.dropdownLayout.attach(this.current_mem_used_value, 1, offsetY + 1, 1, 1);
			this.dropdownLayout.attach(this.current_mem_buffer_label, 0, offsetY + 2, 1, 1);

			this.dropdownLayout.attach(this.current_mem_buffer_value, 1, offsetY + 2, 1, 1);

			this.dropdownLayout.attach(this.current_mem_shared_label, 0, offsetY + 3, 1, 1);

			this.dropdownLayout.attach(this.current_mem_shared_value, 1, offsetY + 3, 1, 1);

			this.dropdownLayout.attach(this.current_mem_cached_label, 0, offsetY + 4, 1, 1);

			this.dropdownLayout.attach(this.current_mem_cached_value, 1, offsetY + 4, 1, 1);

			offsetY += 5;

			this.dropdownLayout.attach(this.current_mem_user_label, 0, offsetY, 1, 1);
			this.dropdownLayout.attach(this.current_mem_user_value, 1, offsetY, 1, 1);
			++offsetY;

			this.dropdownLayout.attach(this.current_mem_locked_label, 0, offsetY, 1, 1);
			this.dropdownLayout.attach(this.current_mem_locked_value, 1, offsetY, 1, 1);
			++offsetY;

			this.dropdownLayout.attach(this.current_mem_free_label, 0, offsetY, 1, 1);
			this.dropdownLayout.attach(this.current_mem_free_value, 1, offsetY, 1, 1);
			++offsetY;

			this.dropdownLayout.attach(this.current_mem_total_label, 0, offsetY, 1, 1);
			this.dropdownLayout.attach(this.current_mem_total_value, 1, offsetY, 1, 1);

			++offsetY;

			this.enable();
		}

		updateValues() {
			GTop.glibtop_get_mem(this.memoryInfos);

			const mem_used = this.memoryInfos.used;
			const t = mem_used / this.memoryInfos.total;

			this.addDataPoint('mem-used', t);

			this.graph?.addDataPoint('mem-used', mem_used);

			let mem_ttl_text = '%s'.format(mem_used.formatMetricPretty('B'));
			this.current_mem_used_value.set_text(mem_ttl_text);

			mem_ttl_text = '%s'.format(this.memoryInfos.buffer.formatMetricPretty('B'));
			this.current_mem_buffer_value.set_text(mem_ttl_text);

			mem_ttl_text = '%s'.format(this.memoryInfos.shared.formatMetricPretty('B'));
			this.current_mem_shared_value.set_text(mem_ttl_text);

			mem_ttl_text = '%s'.format(this.memoryInfos.cached.formatMetricPretty('B'));
			this.current_mem_cached_value.set_text(mem_ttl_text);

			mem_ttl_text = '%s'.format(this.memoryInfos.user.formatMetricPretty('B'));
			this.current_mem_user_value.set_text(mem_ttl_text);

			mem_ttl_text = '%s'.format(this.memoryInfos.locked.formatMetricPretty('B'));
			this.current_mem_locked_value.set_text(mem_ttl_text);

			mem_ttl_text = '%s'.format(this.memoryInfos.free.formatMetricPretty('B'));
			this.current_mem_free_value.set_text(mem_ttl_text);

			mem_ttl_text = '%s'.format(this.memoryInfos.total.formatMetricPretty('B'));
			this.current_mem_total_value.set_text(mem_ttl_text);
		}
	}
);

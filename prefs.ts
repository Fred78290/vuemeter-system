import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Utils from './src/utils.js';

const GeneralPrefsPage = GObject.registerClass(
    class GeneralPrefsPage extends Adw.PreferencesPage {
        constructor(settings: Gio.Settings) {
            super({ title: _('General preferences') });

            const group = new Adw.PreferencesGroup({
                title: _('General'),
            });

            const debugButton = new Adw.SwitchRow({
                title: _('Configure the debug mode of the extension'),
                active: Utils.debugMode,
            });

            const maxButton = new Adw.SwitchRow({
                title: _('Show maximum lines in network graphic'),
                active: Utils.showMaxLines,
            });

            const memStackButton = new Adw.SwitchRow({
                title: _('Show memory graphic in stack format'),
                active: Utils.memStack,
            });

            const bitsPerSecondButton = new Adw.SwitchRow({
                title: _('Show bits/second (off = bytes/second)'),
                active: Utils.bitsPerSecond,
            });

            settings.bind('debug-mode', debugButton, 'active', Gio.SettingsBindFlags.DEFAULT);
            settings.bind('show-max-lines', maxButton, 'active', Gio.SettingsBindFlags.DEFAULT);
            settings.bind('mem-stack', memStackButton, 'active', Gio.SettingsBindFlags.DEFAULT);
            settings.bind(
                'bits-per-second',
                bitsPerSecondButton,
                'active',
                Gio.SettingsBindFlags.DEFAULT
            );

            group.add(debugButton);
            group.add(maxButton);
            group.add(memStackButton);
            group.add(bitsPerSecondButton);
            this.add(group);
        }
    }
);

export default class VueMeterMonitorPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window: Adw.PreferencesWindow) {
        Utils.init('prefs', this, this.metadata, this.getSettings());
        window.add(new GeneralPrefsPage(this.getSettings()));

        window.connect('close-request', () => {
            Utils.release();
        });
    }
}

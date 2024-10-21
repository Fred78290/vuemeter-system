import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension, ExtensionMetadata } from 'resource:///org/gnome/shell/extensions/extension.js';
import Config from './config.js';

export default class Utils {
	static HEADER = 'gnome-stats-pro2';

	static debugMode = false;
	static extension: Extension;
	static metadata: ExtensionMetadata;
	static settings: Gio.Settings;

	static init(extension: Extension, metadata: ExtensionMetadata, settings: Gio.Settings) {
		Utils.extension = extension;
		Utils.metadata = metadata;
		Utils.settings = settings;
		Config.settings = settings;

		Utils.debugMode = Config.get_boolean('debug-mode');
	}

	static getLogFile(): Gio.File | null {
		try {
			const dataDir = GLib.get_user_cache_dir();
			const destination = GLib.build_filenamev([dataDir, 'gnome-stats-pro2', 'debug.log']);
			const destinationFile = Gio.File.new_for_path(destination);

			if (
				destinationFile &&
				GLib.mkdir_with_parents(destinationFile.get_parent()!.get_path()!, 0o755) === 0
			)
				return destinationFile;
		} catch (e: any) {
			console.error(e);
		}

		return null;
	}

	static logToFile(header: string, message: string) {
		if (this.debugMode) {
			const log = Utils.getLogFile();

			if (log) {
				try {
					const date = new Date();
					const time = date.toISOString().split('T')[1].slice(0, -1);

					const outputStream = log.append_to(Gio.FileCreateFlags.NONE, null);
					const buffer: Uint8Array = new TextEncoder().encode(
						`${time}: ${header} - ${message}\n`
					);

					outputStream.write_all(buffer, null);
				} catch (e: any) {
					console.error(Utils.HEADER, e);
				}
			}
		}
	}

	private static concat(...data: any[]): string {
		let message = '';

		for (const str of data) {
			if (message.length === 0) message += str;
			else message += ' ' + str;
		}

		return message;
	}

	static log(...data: any[]) {
		const message = Utils.concat(...data);

		console.log(Utils.HEADER, message);
		Utils.logToFile('INFO', message);
	}

	static debug(...data: any[]) {
		const message = Utils.concat(...data);

		console.log(Utils.HEADER, message);
		Utils.logToFile('DEBUG', message);
	}

	static error(...data: any[]) {
		const message = Utils.concat(...data);

		console.log(Utils.HEADER, message);
		Utils.logToFile('ERROR', message);
	}

	static roundFloatingPointNumber(num: number): number {
		const numStr = num.toString();
		const decimalIndex = numStr.indexOf('.');

		if (decimalIndex === -1) return num;

		const fractionLength = numStr.length - decimalIndex - 1;
		let precision = Math.min(10, fractionLength);
		if (fractionLength > 10) precision = fractionLength - 10;

		return Number(num.toFixed(precision));
	}
}

import { PACKAGE_VERSION } from 'resource:///org/gnome/shell/misc/config.js';

function adjustStyleClass(style: string): string {
	const [major, _minor] = PACKAGE_VERSION.split('.').map(s => Number(s));
	const minVersion = 46;
	const shellVersion = major;

	for (let i = minVersion; i <= shellVersion; i++) {
		style += ` gnomeVersion${i}`;
	}

	return style;
}

export { adjustStyleClass };

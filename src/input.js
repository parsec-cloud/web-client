// Util modules
import * as Enum from './enum.js';
import * as Msg from './msg.js';
import * as Util from './util.js';

// Class modules
import {GamepadManager} from './gamepad.js';

function clientToServerX(clientX, m) {
	let serverX = Math.round((clientX - m.mouseOffsetX) * m.mouseMultiX);

	if (serverX === m.frameW - 1) serverX = m.frameW;
	if (serverX > m.frameW) serverX = m.frameW;
	if (serverX < 0) serverX = 0;

	return serverX;
}

function clientToServerY(clientY, m) {
	let serverY = Math.round((clientY - m.mouseOffsetY) * m.mouseMultiY);

	if (serverY === m.frameH - 1) serverY = m.frameH;
	if (serverY > m.frameH) serverY = m.frameH;
	if (serverY < 0) serverY = 0;

	return serverY;
}

function getAxisValue(value) {
	return value > 0 ? value * 32767 : value * 32768;
}

export class Input {
	constructor(element, send) {
		this.send = send;
		this.element = element;
		this.m = null;
		this.gamepad = null;
		this.cursorClass = null;
		this.mouseRelative = false;
		this.blockNextEsc = false;
		this.listeners = [];
		this.cache = {};
		this.styles = [];
		this.cursorId = 0;
	}

	_mouseMovement(event) {
		if (!this.m) return;

		let data0 = 0;
		let x = 0;
		let y = 0;

		if (document.pointerLockElement) {
			data0 = 1;
			x = event.movementX;
			y = event.movementY;

		} else {
			x = clientToServerX(event.clientX, this.m);
			y = clientToServerY(event.clientY, this.m);
		}

		this.send(Msg.motion(data0, x, y));
	}

	_mouseButton(event) {
		const down = event.type === 'mousedown';
		let button = 0;

		if (!document.pointerLockElement) {
			if (this.mouseRelative)
				event.target.requestPointerLock();
		}

		if (down && event.button === 0 && event.ctrlKey && event.shiftKey) {
			event.target.requestPointerLock();
			return;
		}

		switch (event.button) {
			case 0: button = 1; break;
			case 1: button = 2; break;
			case 2: button = 3; break;
			case 3: button = 4; break;
			case 4: button = 5; break;
		}

		this.send(Msg.mouse(button, down ? 1 : 0));
	}

	async _key(event) {
		event.preventDefault();

		if (event.code === 'KeyV' && event.ctrlKey) {
			try {
				const text = await navigator.clipboard.readText();
				this.send(Msg.clipboard(text));
			} catch (e) {}
		}

		// disable problematic browser shortcuts
		if (event.code === 'F5' && event.ctrlKey ||
			event.code === 'KeyI' && event.ctrlKey && event.shiftKey ||
			event.code === 'F11') return;

		const code = Enum.Scancodes[event.code];

		if (code) {
			let mod = 0;

			if (event.getModifierState('NumLock')) {
				mod |= 0x00001000;
			}

			if (event.getModifierState('CapsLock')) {
				mod |= 0x00002000;
			}

			this.send(Msg.kb(code, mod, event.type === 'keydown' ? 1 : 0));
		}
	}

	_mouseWheel(event) {
		event.preventDefault();

		this.send(Msg.mouseWheel(-1 * event.deltaX / 100, -1 * event.deltaY / 100));
	}

	_contextMenu(event) {
		event.preventDefault();
	}

	_button(index, button, value) {
		if (button === 6 || button === 7) { //triggers
			this.send(Msg.axis(button - 2, getAxisValue(value), index));

		} else { //other buttons
			const mapped = Enum.Mapping[button];

			if (mapped !== undefined) //eslint-disable-line no-undefined
				this.send(Msg.button(mapped, value, index));
		}
	}

	_axis(index, axis, value) {
		this.send(Msg.axis(axis, getAxisValue(value), index));
	}

	_unplug(index) {
		this.send(Msg.unplug(index));
	}

	_pointerLock() {
		if (!document.pointerLockElement && !this.blockNextEsc) {
			this.send(Msg.kb(41, 0, 1));
			this.send(Msg.kb(41, 0, 0));
		}

		this.blockNextEsc = false;
	}

	_exitPointerLock() {
		if (document.pointerLockElement) {
			this.blockNextEsc = true;
			document.exitPointerLock();
		}
	}

	_windowMath() {
		const windowW = this.element.offsetWidth;
		const windowH = this.element.offsetHeight;
		const frameW = this.element.videoWidth;
		const frameH = this.element.videoHeight;

		const multi = Math.min(windowW / frameW, windowH / frameH);
		const vpWidth = frameW * multi;
		const vpHeight = frameH * multi;

		this.m = {
			mouseMultiX: frameW / vpWidth,
			mouseMultiY: frameH / vpHeight,
			mouseOffsetX: Math.max((windowW - vpWidth) / 2.0, 0),
			mouseOffsetY: Math.max((windowH - vpHeight) / 2.0, 0),
			frameW,
			frameH,
		};
	}

	_setCursorVisibility(show) {
		this.element.style.cursor = show ? '' : 'none';
	}

	_clearCursors() {
		const head = document.querySelector('head');

		for (const style of this.styles)
			head.removeChild(style);

		if (this.cursorClass)
			this.element.classList.remove(this.cursorClass);
	}

	setMouseMode(relative, hidden) {
		this._setCursorVisibility(!hidden);
		this.mouseRelative = relative;

		if (this.mouseRelative) {
			this.element.requestPointerLock();

		} else {
			this._exitPointerLock();
		}
	}

	setCursor(data, hotX, hotY) {
		if (!this.cache[data]) {
			this.cache[data] = `cursor-x-${this.cursorId}`;

			const style = document.createElement('style');
			style.type = 'text/css';
			style.innerHTML = `.cursor-x-${this.cursorId++} ` +
				`{cursor: url(data:image/png;base64,${data}) ${hotX} ${hotY}, auto;}`;
			document.querySelector('head').appendChild(style);

			this.styles.push(style);
		}

		if (this.cursorClass) {
			this.element.classList.replace(this.cursorClass, this.cache[data]);

		} else {
			this.element.classList.add(this.cache[data]);
		}

		this.cursorClass = this.cache[data];
	}

	attach() {
		this.gamepad = new GamepadManager(this._button.bind(this), this._axis.bind(this), this._unplug.bind(this));

		this.listeners.push(Util.addListener(this.element, 'resize', this._windowMath, this));
		this.listeners.push(Util.addListener(this.element, 'mousemove', this._mouseMovement, this));
		this.listeners.push(Util.addListener(this.element, 'mousedown', this._mouseButton, this));
		this.listeners.push(Util.addListener(this.element, 'mouseup', this._mouseButton, this));
		this.listeners.push(Util.addListener(this.element, 'mousewheel', this._mouseWheel, this));
		this.listeners.push(Util.addListener(this.element, 'contextmenu', this._contextMenu, this));
		this.listeners.push(Util.addListener(document, 'pointerlockchange', this._pointerLock, this));
		this.listeners.push(Util.addListener(window, 'keydown', this._key, this));
		this.listeners.push(Util.addListener(window, 'keyup', this._key, this));
		this.listeners.push(Util.addListener(window, 'resize', this._windowMath, this));
	}

	detach() {
		Util.removeListeners(this.listeners);

		this._setCursorVisibility(true);
		this._exitPointerLock();
		this._clearCursors();

		if (this.gamepad)
			this.gamepad.destroy();
	}
}

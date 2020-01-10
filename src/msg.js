// Util modules
import * as Enum from './enum.js';


/*** PACKING ***/

const CONTROL_SIZE = 13;

function packControl(buf, type, data0, data1, data2) {
	const dest = new DataView(buf);
	dest.setInt8(0, type);
	dest.setInt32(1, data0);
	dest.setInt32(5, data1);
	dest.setInt32(9, data2);
}

function packString(buf, offset, str) {
	const enc = new TextEncoder();
	const strBuf = enc.encode(str);

	const dest = new Int8Array(buf, offset);

	for (let x = 0; x < str.length; x++)
		dest[x] = strBuf[x];
}

function control(type, data0, data1, data2) {
	const buf = new ArrayBuffer(CONTROL_SIZE);
	packControl(buf, type, data0, data1, data2);

	return buf;
}

function strMsg(type, str) {
	const buf = new ArrayBuffer(CONTROL_SIZE + str.length + 1);

	packControl(buf, type, str.length + 1, 0, 0);
	packString(buf, CONTROL_SIZE, str);

	return buf;
}

export function motion(relative, x, y) {
	return control(Enum.Msg.Motion, relative, x, y);
}

export function mouse(btn, down) {
	return control(Enum.Msg.Mouse, btn, down, 0);
}

export function kb(code, mod, down) {
	return control(Enum.Msg.Kb, code, mod, down);
}

export function mouseWheel(deltaX, deltaY) {
	return control(Enum.Msg.MouseWheel, deltaX, deltaY, 0);
}

export function button(btn, pressed, index) {
	return control(Enum.Msg.Button, btn, pressed, index);
}

export function axis(axs, value, index) {
	return control(Enum.Msg.Axis, axs, value, index);
}

export function unplug(index) {
	return control(Enum.Msg.Unplug, 0, 0, index);
}

export function init() {
	return control(Enum.Msg.Init, 0, 0, 0);
}

export function block() {
	return control(Enum.Msg.Block, 0, 0, 0);
}

export function reinit() {
	return control(Enum.Msg.Reinit, 0, 0, 0);
}

export function abort(reason) {
	return control(Enum.Msg.Abort, reason, 0, 0);
}

function serializeConfig(cfg) {
	const pairs = [];

	for (const item of Object.entries(cfg))
		pairs.push(`${item[0]}=${item[1]}`);

	return pairs.join(':');
}

export function config(cfg) {
	return strMsg(Enum.Msg.Config, serializeConfig(cfg));
}

export function clipboard(text) {
	return strMsg(Enum.Msg.Clipboard, text);
}

/*** UNPACKING ***/

function unpackControl(view) {
	return {
		type: view.getInt8(0),
		data0: view.getInt32(1),
		data1: view.getInt32(5),
		data2: view.getInt32(9),
	};
}

function unpackCursor(view) {
	const dataLen = view.getInt32(13);
	const flags = view.getInt16(29);

	return {
		w: view.getInt16(17),
		h: view.getInt16(19),
		x: view.getInt16(21),
		y: view.getInt16(23),
		hotX: view.getInt16(25),
		hotY: view.getInt16(27),
		relative: !!(flags & Enum.CursorFlags.IsRelative),
		hidden: !!(flags & Enum.CursorFlags.IsHidden),
		data: flags & Enum.CursorFlags.UpdateImage ?
			btoa(String.fromCharCode(...new Uint8Array(view.buffer, 31, dataLen - 1))) : null,
	};
}

function unpackString(buf, offset, len) {
	const dec = new TextDecoder();
	const strBuf = new Int8Array(buf, offset, len);

	return dec.decode(strBuf);
}

export function unpack(buf) {
	const view = new DataView(buf);
	const msg = unpackControl(view);

	switch (msg.type) {
		case Enum.Msg.Cursor:
			return {...msg, ...unpackCursor(view)};

		case Enum.Msg.Status:
		case Enum.Msg.Chat:
		case Enum.Msg.Clipboard:
			return {...msg, str: unpackString(buf, CONTROL_SIZE, msg.data0 - 1)};
	}

	return msg;
}

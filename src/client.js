// Util modules
import * as API from './api.js';
import * as Enum from './enum.js';
import * as Msg from './msg.js';
import * as Util from './util.js';

// Class modules
import {AudioPlayer} from './audio.js';
import {Input} from './input.js';
import {RTC} from './rtc.js';
import {Signal} from './signal.js';
import {VideoPlayer} from './video.js';

function cfgDefaults(cfg) {
	if (!cfg) cfg = {};

	//required for MSE
	cfg.network_video_container = 2;

	if (!cfg.app_ss_endpoint)
		cfg.app_ss_endpoint = 'signal-load.parsec.tv';

	if (!cfg.app_ss_port)
		cfg.app_ss_port = 443;

	if (!cfg.server_resolution_x && !cfg.server_resolution_y) {
		const w = window.screen.width;
		const h = window.screen.height;

		cfg.server_resolution_x = 1920;
		cfg.server_resolution_y = 1080;

		if (w >= 800 && h >= 600 && w <= 1920 && h <= 1080) {
			cfg.server_resolution_x = w;
			cfg.server_resolution_y = h;
		}
	}

	return cfg;
}

export class Client {
	constructor(element, onEvent) {
		this.onEvent = onEvent;
		this.audioPlayer = new AudioPlayer();
		this.connected = false;
		this.rtc = null;
		this.listeners = [];
		this.logInterval = null;

		this.videoPlayer = new VideoPlayer(element, () => {
			this.rtc.send(Msg.reinit(), 0);
		});

		this.signal = new Signal((code) => {
			this.destroy(code === 4001 ? Enum.Warning.PeerGone : code);
		});

		this.input = new Input(element, (buf) => {
			if (this.connected)
				this.rtc.send(buf, 0);
		});

		this.listeners.push(Util.addListener(window, 'beforeunload', () => {
			this.destroy(0);
			return null;
		}));
	}

	_dispatchEvent(buf) {
		const msg = Msg.unpack(buf);

		switch (msg.type) {
			case Enum.Msg.Cursor:
				this.input.setMouseMode(msg.relative, msg.hidden);

				if (msg.data)
					this.input.setCursor(msg.data, msg.hotX, msg.hotY);

				break;

			case Enum.Msg.Abort:
				this.destroy(msg.data0);
				break;

			case Enum.Msg.Shutter:
				this.onEvent({type: 'shutter', enabled: !!msg.data0});
				break;

			case Enum.Msg.Status:
				this.onEvent({type: 'status', msg});
				break;

			case Enum.Msg.Chat:
				this.onEvent({type: 'chat', msg});
				break;
		}
	}

	async connect(sessionId, serverId, cfg) {
		cfg = cfgDefaults(cfg);

		const onRTCCandidate = (candidate) => {
			this.signal.send(JSON.stringify(candidate));
		};

		const onControlOpen = () => {
			this.signal.close(1000);
			this.connected = true;

			//XXX required to prevent Parsec managed cloud machines from shutting down
			this.logInterval = setInterval(() => {
				API.connectionUpdate({
					attempt_id: this.signal.getAttemptId(),
					state_str: 'LSC_EVENTLOOP',
				});
			}, 60000);

			this.listeners.push(Util.addListener(document, 'visibilitychange', () => {
				if (document.hidden) {
					this.videoPlayer.destroy();
					this.rtc.send(Msg.block(), 0);

				} else {
					this.rtc.send(Msg.reinit(), 0);
				}
			}));

			this.rtc.send(Msg.config(cfg), 0);
			this.rtc.send(Msg.init(), 0);

			this.input.attach();
			this.onEvent({type: 'connect'});
		};

		this.rtc = new RTC(serverId, this.signal.getAttemptId(), onRTCCandidate);

		this.rtc.addChannel('control', 0, onControlOpen, (event) => {
			this._dispatchEvent(event.data);
		});

		this.rtc.addChannel('video', 1, null, (event) => {
			this.videoPlayer.push(event.data);
		});

		this.rtc.addChannel('audio', 2, null, (event) => {
			this.audioPlayer.queueData(event.data);
		});

		const myCreds = await this.rtc.createOffer();

		this.signal.connect(cfg.app_ss_endpoint, cfg.app_ss_port, sessionId, serverId, myCreds, (candidate, theirCreds) => {
			this.rtc.setCandidate(candidate, theirCreds);
		});
	}

	destroy(code) {
		Util.removeListeners(this.listeners);

		this.signal.close(code >= 3000 && code < 5000 ? code : 1000);
		this.videoPlayer.destroy();
		this.audioPlayer.destroy();
		this.input.detach();

		if (this.connected) {
			clearInterval(this.logInterval);
			this.rtc.send(Msg.abort(code), 0);
		}

		API.connectionUpdate({
			state_str: 'LSC_EXIT',
			attempt_id: this.signal.getAttemptId(),
			exit_code: code,
		});

		this.rtc.close();
		this.connected = false;
		this.onEvent({type: 'exit', code});
	}
}

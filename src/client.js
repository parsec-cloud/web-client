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
		this.conns = [];
		this.listeners = [];
		this.logInterval = null;

		this.videoPlayer = new VideoPlayer(element, () => {
			const control = this.conns[0];
			control.send(Msg.reinit());
		});

		this.signal = new Signal((code) => {
			this.destroy(code === 4001 ? Enum.Warning.PeerGone : code);
		});

		this.input = new Input(element, (buf) => {
			const control = this.conns[0];

			if (control && this.connected)
				control.send(buf);
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
			const control = this.conns[0];

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
					control.send(Msg.block());

				} else {
					control.send(Msg.reinit());
				}
			}));

			control.send(Msg.config(cfg));
			control.send(Msg.init());

			this.input.attach();
			this.onEvent({type: 'connect'});
		};

		this.conns[0] = new RTC(serverId, this.signal.getAttemptId(), 0, onControlOpen, (event) => {
			this._dispatchEvent(event.data);
		}, onRTCCandidate);

		this.conns[1] = new RTC(serverId, this.signal.getAttemptId(), 1, null, (event) => {
			this.videoPlayer.push(event.data);
		}, onRTCCandidate);

		this.conns[2] = new RTC(serverId, this.signal.getAttemptId(), 2, null, (event) => {
			this.audioPlayer.queueData(event.data);
		}, onRTCCandidate);

		const myCreds = [];
		for (let i = 0; i < 3; i++)
			myCreds.push(await this.conns[i].createOffer());

		this.signal.connect(cfg.app_ss_endpoint, cfg.app_ss_port, sessionId, serverId, myCreds, (candidate, theirCreds) => {
			this.conns[candidate.slot].setCandidate(candidate, theirCreds);
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
			this.conns[0].send(Msg.abort(code));
		}

		API.connectionUpdate({
			state_str: 'LSC_EXIT',
			attempt_id: this.signal.getAttemptId(),
			exit_code: code,
		});

		for (const conn of this.conns)
			conn.close();

		this.connected = false;
		this.onEvent({type: 'exit', code});
	}
}

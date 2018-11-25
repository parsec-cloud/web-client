// Util modules
import * as Enum from './enum.js';

function createAttemptId() {
	const chunks = [];
	const random = new Uint8Array(4);

	for (let x = 0; x < 6; x++) {
		crypto.getRandomValues(random);
		//yay for stack overflow https://stackoverflow.com/a/50767210
		chunks.push(Array.from(random).map((b) => b.toString(16).padStart(2, '0')).join(''));
	}

	return chunks.join('-');
}

export class Signal {
	constructor(onFatal) {
		this.onFatal = onFatal;
		this.attemptId = createAttemptId();
		this.theirCreds = null;
		this.ws = null;
	}

	connect(host, port, sessionId, serverId, creds, onCandidate) {
		this.ws = new WebSocket(`wss://${host}:${port}/?session=${sessionId}`);

		this.ws.onclose = (event) => {
			if (event.code !== 1000)
				this.onFatal(event.code);
		};

		this.ws.onopen = () => {
			this.ws.send(JSON.stringify({
				action: 'connection_init',
				subject: 'server',
				to: serverId,
				attempt_id: this.attemptId,
				timeout_ms: 30000,
				mode: 2,
				creds,
			}));
		};

		this.ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);

			switch (msg.action) {
				case 'connection_init_response':
					if (!msg.approved)
						this.onFatal(Enum.Warning.Reject);

					this.theirCreds = msg.creds;
					break;

				case 'candidate_exchange':
					onCandidate(msg, this.theirCreds);
					break;
			}
		};
	}

	getAttemptId() {
		return this.attemptId;
	}

	send(str) {
		this.ws.send(str);
	}

	close(code) {
		if (this.ws) {
			this.ws.close(code);
			this.ws = null;
		}
	}
}

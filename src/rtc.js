function sdpToObj(sdp) {
	const sdpArray = sdp.sdp.split('\n');
	const obj = {};

	for (let x = 0; x < sdpArray.length; x++) {
		const pair = sdpArray[x].split('=');
		const key = pair[0];
		const val = pair[1];

		if (key) {
			if (key === 'a') {
				if (!obj.a) {
					obj.a = {};
				}

				const valPair = val.split(/:(.+)/);
				obj.a[valPair[0]] = valPair[1];
			} else {
				obj[key] = val;
			}
		}
	}

	return obj;
}

function randomSessionId() {
	const random = new Uint8Array(16);
	crypto.getRandomValues(random);

	return random.map((n) => n % 10).join('');
}

function credsToSDPStr(creds, mid) {
	const remoteDesc =
		`v=0\r\n` +
		`o=- ${randomSessionId()} 2 IN IP4 127.0.0.1\r\n` +
		`s=-\r\n` +
		`t=0 0\r\n` +
		`a=group:BUNDLE ${mid}\r\n` +
		`a=msid-semantic: WMS *\r\n` +
		`m=application 9 DTLS/SCTP 5000\r\n` +
		`c=IN IP4 0.0.0.0\r\n` +
		`b=AS:30\r\n` +
		`a=ice-ufrag:${creds.ice_ufrag}\r\n` +
		`a=ice-pwd:${creds.ice_pwd}\r\n` +
		`a=ice-options:trickle\r\n` +
		`a=fingerprint:${creds.fingerprint}\r\n` +
		`a=setup:active\r\n` +
		`a=mid:${mid}\r\n` +
		`a=sendrecv\r\n` +
		`a=sctpmap:5000 webrtc-datachannel 256\r\n` +
		`a=max-message-size:1073741823\r\n`;

	return remoteDesc;
}

function candidateToCandidateStr(candidate, theirCreds) {
	const foundation = 2395300328;
	const priority = 2113937151;

	return `candidate:${foundation} 1 udp ${priority} ${candidate.candidate_ip} ` +
		`${candidate.candidate_port} typ host generation 0 ufrag ${theirCreds.ice_ufrag} network-cost 50`;
}

export class RTC {
	constructor(serverId, attemptId, slot, onOpen, onMessage, onCandidate) {
		this.firstSend = 1;
		this.sdp = null;
		this.rtc = null;
		this.channel = null;
		this.offer = null;
		this.theirCreds = null;

		this.rtc = new RTCPeerConnection({
			iceServers: [
				{urls: 'stun:stun.l.google.com:19302'},
				{urls: 'stun:stun1.l.google.com:19302'},
				{urls: 'stun:stun2.l.google.com:19302'},
				{urls: 'stun:stun3.l.google.com:19302'},
			],
		});

		this.rtc.onicecandidate = (event) => {
			if (event.candidate) {
				const carray = event.candidate.candidate.replace('candidate:', '').split(' ');

				if (carray[2].toLowerCase() === 'udp') {
					onCandidate({
						action: 'candidate_exchange',
						to: serverId,
						from: attemptId,
						slot,
						candidate_ip: carray[4],
						candidate_port: parseInt(carray[5]),
						sync: 0,
						from_stun: 0,
						lan: 0,
						first: this.firstSend,
					});

					this.firstSend = 0;
				}
			}
		};

		this.channel = this.rtc.createDataChannel('channel');
		this.channel.binaryType = 'arraybuffer';
		this.channel.onopen = onOpen;
		this.channel.onmessage = onMessage;
	}

	close() {
		this.channel.close();
		this.rtc.close();
	}

	async createOffer() {
		this.offer = await this.rtc.createOffer();
		this.sdp = sdpToObj(this.offer);

		//this matches the creds structure from the signal service
		return {
			ice_ufrag: this.sdp.a['ice-ufrag'],
			ice_pwd: this.sdp.a['ice-pwd'],
			fingerprint: this.sdp.a.fingerprint,
		};
	}

	send(buf) {
		this.channel.send(buf);
	}

	async start(theirCreds) {
		//this will begin STUN
		this.theirCreds = theirCreds;
		await this.rtc.setLocalDescription(this.offer);

		const sdpStr = credsToSDPStr(this.theirCreds, this.sdp.a.mid);
		await this.rtc.setRemoteDescription({type: 'answer', sdp: sdpStr});
	}

	async setCandidate(candidate) {
		const candidateStr = candidateToCandidateStr(candidate, this.theirCreds);

		await this.rtc.addIceCandidate({
			candidate: candidateStr,
			sdpMid: this.sdp.a.mid,
			sdpMLineIndex: 0,
		});
	}
}

const HOST = 'parsecgaming.com';

export async function connectionUpdate(msg) {
	const res = await fetch(`https://${HOST}/v1/state/`, {
		method: 'put',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify({
			...msg,
			platform: 'web',
		}),
	});

	return await res.json();
}

export async function auth(email, password) {
	const res = await fetch(`https://${HOST}/v1/auth`, {
		method: 'post',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify({
			email,
			password,
		}),
	});

	return await res.json();
}

export async function serverList(sessionId) {
	const res = await fetch(`https://${HOST}/v1/server-list?include_managed=true`, {
		method: 'get',
		headers: {
			'X-Parsec-Session-Id': sessionId,
		},
	});

	return await res.json();
}

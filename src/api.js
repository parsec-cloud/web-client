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

export async function auth(email, password, tfa) {
	const res = await fetch(`https://${HOST}/v1/auth`, {
		method: 'post',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify({
			email,
			password,
			tfa
		}),
	});

	const json = await res.json();

	if (!res.ok)
		throw new Error(json.error);

	return await json;
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

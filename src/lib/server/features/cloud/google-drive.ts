import { env } from '$env/dynamic/private';

// Solo la carpeta oculta de la app (appDataFolder): JobFilter no ve ni toca el resto de tu Drive.
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export const isConfigured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

function credentials() {
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
		throw new Error('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env. Ver docs/nube.md.');
	}
	return { client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET };
}

async function check(res: Response, action: string): Promise<Response> {
	if (!res.ok) throw new Error(`Google respondió ${res.status} al ${action}: ${await res.text()}`);
	return res;
}

export function authUrl(redirectUri: string, state: string, challenge: string): string {
	const params = new URLSearchParams({
		client_id: credentials().client_id,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: SCOPES,
		// offline + consent: Google solo entrega el refresh token así
		access_type: 'offline',
		prompt: 'consent',
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256'
	});
	return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string, verifier: string, redirectUri: string) {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		body: new URLSearchParams({
			...credentials(),
			code,
			code_verifier: verifier,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});
	const body = await (await check(res, 'conectar la cuenta')).json();
	if (!body.refresh_token) throw new Error('Google no entregó un refresh token. Vuelve a conectar.');
	// El id_token llega directo de Google por HTTPS; solo se lee el correo para mostrarlo.
	const claims = body.id_token
		? JSON.parse(Buffer.from(body.id_token.split('.')[1], 'base64url').toString('utf8'))
		: {};
	return { refreshToken: body.refresh_token as string, email: (claims.email as string) ?? null };
}

async function accessToken(refreshToken: string): Promise<string> {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		body: new URLSearchParams({
			...credentials(),
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		})
	});
	return (await (await check(res, 'renovar el acceso')).json()).access_token;
}

async function findFile(token: string, name: string): Promise<string | undefined> {
	const params = new URLSearchParams({
		spaces: 'appDataFolder',
		q: `name = '${name}' and trashed = false`,
		fields: 'files(id)'
	});
	const res = await fetch(`${FILES_URL}?${params}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	return (await (await check(res, `buscar ${name}`)).json()).files[0]?.id;
}

/** Crea el archivo en la carpeta de la app o lo reemplaza si ya existe. */
export async function putFile(refreshToken: string, name: string, data: Uint8Array<ArrayBuffer>) {
	const token = await accessToken(refreshToken);
	const headers = { Authorization: `Bearer ${token}` };
	const id = await findFile(token, name);

	if (id) {
		const res = await fetch(`${UPLOAD_URL}/${id}?uploadType=media`, {
			method: 'PATCH',
			headers,
			body: data
		});
		await check(res, `subir ${name}`);
		return;
	}

	const form = new FormData();
	form.append(
		'metadata',
		new Blob([JSON.stringify({ name, parents: ['appDataFolder'] })], { type: 'application/json' })
	);
	form.append('file', new Blob([data]));
	const res = await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
		method: 'POST',
		headers,
		body: form
	});
	await check(res, `subir ${name}`);
}

export async function hasFile(refreshToken: string, name: string): Promise<boolean> {
	return (await findFile(await accessToken(refreshToken), name)) !== undefined;
}

export async function getFile(refreshToken: string, name: string): Promise<Uint8Array<ArrayBuffer> | null> {
	const token = await accessToken(refreshToken);
	const id = await findFile(token, name);
	if (!id) return null;
	const res = await fetch(`${FILES_URL}/${id}?alt=media`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	return new Uint8Array(await (await check(res, `descargar ${name}`)).arrayBuffer());
}

export async function revoke(refreshToken: string) {
	// Si el token ya no sirve, igual se desconecta en local.
	await fetch(REVOKE_URL, { method: 'POST', body: new URLSearchParams({ token: refreshToken }) });
}

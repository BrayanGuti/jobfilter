const HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
	'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5'
};

/** La plataforma nos frenó (429/403/999/captcha): hay que dejarla en pausa. */
export class BlockedError extends Error {}

class HttpError extends Error {}

export type HttpClient = {
	text(url: string, init?: RequestInit): Promise<string>;
	json<T>(url: string, init?: RequestInit): Promise<T>;
	/** Peticiones hechas con este cliente (para el cupo por corrida). */
	requests(): number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Un desafío de captcha es una página corta; un sitio normal puede traer un formulario con
// reCAPTCHA en una página grande (elempleo) sin que eso sea un bloqueo.
const CHALLENGE_PAGE_MAX = 20_000;

/** ¿La respuesta es una página de desafío en vez del contenido? */
export function isChallengePage(body: string): boolean {
	if (/cf-chl|challenge-platform/i.test(body)) return true;
	return body.length < CHALLENGE_PAGE_MAX && /g-recaptcha|hcaptcha/i.test(body);
}

/**
 * Cliente por plataforma: una petición a la vez, con una pausa aleatoria entre
 * peticiones, y reintentos solo para errores de red o 5xx. Guarda las cookies de la sesión
 * anónima que mande el sitio y las devuelve en las peticiones siguientes de la misma corrida.
 */
export function createClient(delay: { min: number; max: number }): HttpClient {
	let last = 0;
	let count = 0;
	const cookies = new Map<string, string>();

	async function request(url: string, init: RequestInit = {}): Promise<Response> {
		const wait = last + delay.min + Math.random() * (delay.max - delay.min) - Date.now();
		if (last && wait > 0) await sleep(wait);

		for (let attempt = 1; ; attempt++) {
			last = Date.now();
			count++;
			try {
				const cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
				const res = await fetch(url, {
					...init,
					headers: { ...HEADERS, ...(cookie ? { Cookie: cookie } : {}), ...init.headers },
					signal: AbortSignal.timeout(30_000)
				});
				for (const header of res.headers.getSetCookie()) {
					const [pair] = header.split(';');
					const eq = pair.indexOf('=');
					if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
				}
				// 999 es la respuesta propia de LinkedIn cuando bloquea ("Request denied")
				if (res.status === 429 || res.status === 403 || res.status === 999) {
					throw new BlockedError(`HTTP ${res.status} en ${url}`);
				}
				if (res.status >= 500 && attempt < 3) {
					await sleep(attempt * 5_000);
					continue;
				}
				if (!res.ok) throw new HttpError(`HTTP ${res.status} en ${url}`);
				return res;
			} catch (err) {
				// solo se reintentan errores de red y timeouts
				if (err instanceof BlockedError || err instanceof HttpError || attempt >= 3) throw err;
				await sleep(attempt * 5_000);
			}
		}
	}

	return {
		async text(url, init) {
			const body = await (await request(url, init)).text();
			if (isChallengePage(body)) throw new BlockedError(`Captcha en ${url}`);
			return body;
		},
		async json(url, init) {
			return (await request(url, init)).json();
		},
		requests: () => count
	};
}

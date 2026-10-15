const HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
	'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5'
};

/** La plataforma nos frenó (429/403/captcha): hay que dejarla en pausa. */
export class BlockedError extends Error {}

class HttpError extends Error {}

export type HttpClient = {
	text(url: string, init?: RequestInit): Promise<string>;
	json<T>(url: string, init?: RequestInit): Promise<T>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cliente por plataforma: una petición a la vez, con una pausa aleatoria entre
 * peticiones, y reintentos solo para errores de red o 5xx.
 */
export function createClient(delay: { min: number; max: number }): HttpClient {
	let last = 0;

	async function request(url: string, init: RequestInit = {}): Promise<Response> {
		const wait = last + delay.min + Math.random() * (delay.max - delay.min) - Date.now();
		if (last && wait > 0) await sleep(wait);

		for (let attempt = 1; ; attempt++) {
			last = Date.now();
			try {
				const res = await fetch(url, {
					...init,
					headers: { ...HEADERS, ...init.headers },
					signal: AbortSignal.timeout(30_000)
				});
				if (res.status === 429 || res.status === 403) {
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
			if (/cf-chl|challenge-platform|g-recaptcha|hcaptcha/i.test(body)) {
				throw new BlockedError(`Captcha en ${url}`);
			}
			return body;
		},
		async json(url, init) {
			return (await request(url, init)).json();
		}
	};
}

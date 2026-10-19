import type { PlatformProgress, SearchProgress } from '$lib/progress';
import { recalculateBlacklist } from '$lib/server/features/companies/commands/recalculate-blacklist';
import { listKeywords, type Keyword } from '$lib/server/features/keywords/queries/list-keywords';
import { savePosting } from '$lib/server/features/postings/commands/save-posting';
import { postingExists } from '$lib/server/features/postings/queries/posting-exists';
import { BlockedError, createClient } from '$lib/server/shared/http';
import { detectLanguage } from '$lib/server/shared/language';
import { mentionsTerm } from '$lib/server/shared/normalize';
import { loadLocation, type Location } from '$lib/server/shared/profile';
import { adapters } from '../adapters';
import type { PlatformAdapter, RawPosting, SearchContext } from '../adapters/types';
import {
	clearPlatformFailures,
	finishRun,
	keywordCursorsFor,
	lastFinishedRun,
	pausePlatform,
	pausedUntil,
	setKeywordCursor,
	startRun
} from '../run-log';
import { cacheDetail, cachedDetail } from '../detail-cache';
import { search } from '../state';

const WINDOW_MS = 90 * 24 * 3_600_000; // 3 meses
const OVERLAP_MS = 2 * 24 * 3_600_000; // margen sobre la última búsqueda

/** Arranca la búsqueda en segundo plano. Devuelve false si ya hay una corriendo. */
export function startSearch(): boolean {
	if (search.progress.running) return false;
	const keywords = listKeywords();
	const location = loadLocation();
	const progress: SearchProgress = {
		running: true,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		platforms: adapters.map((a) => ({
			id: a.id,
			name: a.name,
			state: 'pendiente',
			term: null,
			done: 0,
			total: keywords.length,
			found: 0,
			created: 0,
			detail: null
		}))
	};
	search.progress = progress;
	Promise.all(adapters.map((a, i) => runPlatform(a, progress.platforms[i], keywords, location))).finally(() => {
		recalculateBlacklist();
		progress.running = false;
		progress.finishedAt = new Date().toISOString();
	});
	return true;
}

/**
 * Desde cuándo buscar con una palabra: 3 meses la primera vez, y después solo desde la
 * última vez que se buscó completa (con un margen). Sin cursor propio, vale la última corrida
 * completa de la plataforma (bases creadas antes de los cursores).
 */
function sinceFor(keyword: Keyword, cursor: string | undefined, legacyRun: string | null): Date {
	const windowStart = Date.now() - WINDOW_MS;
	const from = cursor ?? (legacyRun && keyword.createdAt <= legacyRun ? legacyRun : null);
	if (!from) return new Date(windowStart);
	return new Date(Math.max(windowStart, Date.parse(from) - OVERLAP_MS));
}

/**
 * Si el detalle de una vacante falla (404, oferta retirada), se guarda sin descripción y la
 * búsqueda sigue. Un bloqueo sí detiene la plataforma.
 */
async function fetchDetailOrSkip(
	adapter: PlatformAdapter,
	posting: RawPosting,
	ctx: SearchContext
): Promise<Partial<RawPosting>> {
	try {
		return await adapter.fetchDetail!(posting, ctx);
	} catch (err) {
		if (err instanceof BlockedError) throw err;
		return {};
	}
}

function shuffle<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

async function runPlatform(adapter: PlatformAdapter, p: PlatformProgress, keywords: Keyword[], location: Location) {
	const paused = pausedUntil(adapter.id);
	if (paused) {
		p.state = 'pausada';
		p.detail = paused;
		return;
	}

	p.state = 'buscando';
	const legacyRun = lastFinishedRun(adapter.id);
	const cursors = keywordCursorsFor(adapter.id);
	const runId = startRun(adapter.id);
	const client = createClient(adapter.delay);
	const maxRequests = adapter.maxRequestsPerRun ?? Infinity;
	const seen = new Set<string>();
	// primero las que nunca se buscaron y después las que llevan más tiempo sin buscarse
	const ordered = shuffle(keywords).sort((a, b) =>
		(cursors.get(a.term) ?? '').localeCompare(cursors.get(b.term) ?? '')
	);

	try {
		let left = 0;
		for (const [i, keyword] of ordered.entries()) {
			const startedAt = new Date().toISOString();
			p.term = keyword.term;
			const ctx = { client, location, since: sinceFor(keyword, cursors.get(keyword.term), legacyRun) };
			const complete = await searchKeyword(adapter, keyword, ctx, p, seen, maxRequests);
			if (!complete || client.requests() >= maxRequests) {
				// cupo de peticiones: esta palabra (si quedó a medias) y las demás siguen la próxima vez
				left = ordered.length - i - (complete ? 1 : 0);
				if (complete) setKeywordCursor(adapter.id, keyword.term, startedAt);
				p.done += complete ? 1 : 0;
				break;
			}
			setKeywordCursor(adapter.id, keyword.term, startedAt);
			p.done++;
		}
		p.state = 'ok';
		p.term = null;
		if (left) p.detail = `${left} ${left === 1 ? 'palabra queda' : 'palabras quedan'} para la próxima búsqueda`;
		clearPlatformFailures(adapter.id);
		finishRun(runId, p.found, p.created);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (err instanceof BlockedError) {
			p.state = 'pausada';
			p.detail = pausePlatform(adapter.id, adapter.pauseHours);
		} else {
			p.state = 'error';
			p.detail = message;
		}
		finishRun(runId, p.found, p.created, message);
	}
}

/** Busca una palabra y guarda lo que sirva. Devuelve false si se cortó por el cupo de peticiones. */
async function searchKeyword(
	adapter: PlatformAdapter,
	keyword: Keyword,
	ctx: SearchContext,
	p: PlatformProgress,
	seen: Set<string>,
	maxRequests: number
): Promise<boolean> {
	for await (const posting of adapter.search(keyword.term, ctx)) {
		if (seen.has(posting.externalId)) continue;
		// el detalle cuesta una petición más: solo para las que no están en la base, y una sola
		// vez por vacante (queda en caché aunque después se descarte)
		let detail: Partial<RawPosting> = {};
		if (adapter.fetchDetail && !postingExists(adapter.id, posting.externalId)) {
			const cached = cachedDetail(adapter.id, posting.externalId);
			if (cached) {
				detail = cached;
			} else {
				if (ctx.client.requests() >= maxRequests) return false;
				detail = await fetchDetailOrSkip(adapter, posting, ctx);
				cacheDetail(adapter.id, posting.externalId, detail);
			}
		}
		const full = { ...posting, ...detail };
		if (adapter.looseSearch && !mentionsTerm(`${full.title}\n${full.description ?? ''}`, keyword.term)) continue;
		// idioma: muchas plataformas no lo filtran; se detecta por la descripción
		const language = full.description ? detectLanguage(full.description) : null;
		if (language && !ctx.location.languages.includes(language)) continue;

		seen.add(posting.externalId);
		p.found++;
		if (savePosting(adapter.id, full)) p.created++;
	}
	return true;
}

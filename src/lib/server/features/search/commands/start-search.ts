import type { PlatformProgress, SearchProgress } from '$lib/progress';
import { recalculateBlacklist } from '$lib/server/features/companies/commands/recalculate-blacklist';
import { listKeywords, type Keyword } from '$lib/server/features/keywords/queries/list-keywords';
import { savePosting } from '$lib/server/features/postings/commands/save-posting';
import { postingExists } from '$lib/server/features/postings/queries/posting-exists';
import { BlockedError, createClient } from '$lib/server/shared/http';
import { mentionsTerm } from '$lib/server/shared/normalize';
import { loadLocation, type Location } from '$lib/server/shared/profile';
import { adapters } from '../adapters';
import type { PlatformAdapter, RawPosting, SearchContext } from '../adapters/types';
import { clearPlatformFailures, finishRun, lastFinishedRun, pausePlatform, pausedUntil, startRun } from '../run-log';
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
 * Desde cuándo buscar con una palabra: 3 meses la primera vez (o si la palabra es nueva),
 * y después solo desde la última búsqueda exitosa de esa plataforma.
 */
function sinceFor(keyword: Keyword, lastRun: string | null): Date {
	const windowStart = Date.now() - WINDOW_MS;
	if (!lastRun || keyword.createdAt > lastRun) return new Date(windowStart);
	return new Date(Math.max(windowStart, Date.parse(lastRun) - OVERLAP_MS));
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
	const lastRun = lastFinishedRun(adapter.id);
	const runId = startRun(adapter.id);
	const client = createClient(adapter.delay);
	const seen = new Set<string>();
	// detalles ya pedidos en esta corrida: una vacante descartada para una palabra puede servir para otra
	const details = new Map<string, Partial<RawPosting>>();

	try {
		for (const keyword of shuffle(keywords)) {
			p.term = keyword.term;
			const ctx = { client, location, since: sinceFor(keyword, lastRun) };
			for await (const posting of adapter.search(keyword.term, ctx)) {
				if (seen.has(posting.externalId)) continue;
				// el detalle cuesta una petición más: solo para las que no están en la base
				let detail = details.get(posting.externalId) ?? {};
				if (adapter.fetchDetail && !details.has(posting.externalId) && !postingExists(adapter.id, posting.externalId)) {
					detail = await fetchDetailOrSkip(adapter, posting, ctx);
					details.set(posting.externalId, detail);
				}
				const full = { ...posting, ...detail };
				if (adapter.looseSearch && !mentionsTerm(`${full.title}\n${full.description ?? ''}`, keyword.term)) continue;

				seen.add(posting.externalId);
				p.found++;
				if (savePosting(adapter.id, full)) p.created++;
			}
			p.done++;
		}
		p.state = 'ok';
		p.term = null;
		clearPlatformFailures(adapter.id);
		finishRun(runId, p.found, p.created);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (err instanceof BlockedError) {
			p.state = 'pausada';
			p.detail = pausePlatform(adapter.id);
		} else {
			p.state = 'error';
			p.detail = message;
		}
		finishRun(runId, p.found, p.created, message);
	}
}

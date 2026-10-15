import type { PlatformProgress, SearchProgress } from '$lib/progress';
import { recalculateBlacklist } from '$lib/server/features/companies/commands/recalculate-blacklist';
import { listKeywords, type Keyword } from '$lib/server/features/keywords/queries/list-keywords';
import { savePosting } from '$lib/server/features/postings/commands/save-posting';
import { BlockedError, createClient } from '$lib/server/shared/http';
import { loadLocation, type Location } from '$lib/server/shared/profile';
import { adapters } from '../adapters';
import type { PlatformAdapter } from '../adapters/types';
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

	try {
		for (const keyword of shuffle(keywords)) {
			p.term = keyword.term;
			for await (const posting of adapter.search(keyword.term, { client, location, since: sinceFor(keyword, lastRun) })) {
				if (seen.has(posting.externalId)) continue;
				seen.add(posting.externalId);
				p.found++;
				if (savePosting(adapter.id, posting)) p.created++;
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

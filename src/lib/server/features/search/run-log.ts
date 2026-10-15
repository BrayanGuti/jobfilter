// Bitácora de corridas y pausas por plataforma. Uso interno del slice de búsqueda.
import { and, eq, isNotNull, isNull, max, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { platforms, runs } from '$lib/server/db/schema';

const now = () => new Date().toISOString();

export function lastFinishedRun(platform: string): string | null {
	return (
		db
			.select({ startedAt: max(runs.startedAt) })
			.from(runs)
			.where(and(eq(runs.platform, platform), isNotNull(runs.finishedAt), isNull(runs.error)))
			.get()?.startedAt ?? null
	);
}

export function startRun(platform: string): number {
	return db.insert(runs).values({ platform, startedAt: now() }).returning({ id: runs.id }).get()!.id;
}

export function finishRun(id: number, found: number, created: number, error?: string) {
	db.update(runs)
		.set({ finishedAt: now(), found, new: created, error: error ?? null })
		.where(eq(runs.id, id))
		.run();
}

export function pausedUntil(platform: string): string | null {
	const row = db.select({ pausedUntil: platforms.pausedUntil }).from(platforms).where(eq(platforms.id, platform)).get();
	return row?.pausedUntil && row.pausedUntil > now() ? row.pausedUntil : null;
}

/** Pausa 24 h la primera vez y duplica en cada bloqueo seguido (máx. 7 días). */
export function pausePlatform(platform: string): string {
	const { failures } = db
		.insert(platforms)
		.values({ id: platform, failures: 1 })
		.onConflictDoUpdate({ target: platforms.id, set: { failures: sql`${platforms.failures} + 1` } })
		.returning({ failures: platforms.failures })
		.get()!;
	const hours = Math.min(24 * 2 ** (failures - 1), 24 * 7);
	const until = new Date(Date.now() + hours * 3_600_000).toISOString();
	db.update(platforms).set({ pausedUntil: until }).where(eq(platforms.id, platform)).run();
	return until;
}

export function clearPlatformFailures(platform: string) {
	db.insert(platforms)
		.values({ id: platform, failures: 0 })
		.onConflictDoUpdate({ target: platforms.id, set: { failures: 0, pausedUntil: null } })
		.run();
}

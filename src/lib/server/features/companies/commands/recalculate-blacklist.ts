import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { companies, postings as postingsTable, publications } from '$lib/server/db/schema';
import { normalizeText } from '$lib/server/shared/normalize';
import type { Reason } from '../reasons';

const DAY = 86_400_000;
const WINDOW = 90 * DAY; // ventana de 3 meses
const MIN_GAP = 7 * DAY; // más cerca es la misma publicación (o la misma en dos plataformas)
// Una republicación puede ser real (el contratado no funcionó); 3 en 3 meses ya es un patrón
// de recolectar CVs (como publicar la misma vacante cada mes).
const BLACKLIST_AT = 3;
// Medido con vacantes reales: distintas de una misma empresa ≤ 0,21 (comparten la
// presentación de la empresa); la misma con el texto retocado ≈ 0,7; copia exacta = 1.
const AUTO_SIMILARITY = 0.9; // el script solo, sin tu opinión: casi idénticas
const DISCARD_SIMILARITY = 0.6; // con tu descarte basta con que sea muy parecida

type Posting = {
	id: number;
	companyId: number;
	title: string;
	normalizedTitle: string;
	description: string | null;
	status: string;
	dates: number[]; // publicaciones, ordenadas
};

/** Una misma vacante: sus publicaciones y si tu descarte ayudó a reconocerla. */
type Vacancy = { postings: Posting[]; dates: number[]; discards: Posting[] };

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Recalcula todo:
 * - marca cada vacante con cuántas veces se publicó (el aviso "⟲ 2ª publicación" de la lista);
 * - manda a lista negra las empresas con una vacante publicada 3+ veces en 3 meses;
 * - saca de la lista negra automática las que ya no tienen motivo (por ejemplo, al retomar).
 * No toca la lista blanca ni los bloqueos a mano. Devuelve cuántas empresas quedan en la
 * lista negra automática.
 */
export function recalculateBlacklist(): number {
	const rows = db
		.select({
			id: postingsTable.id,
			companyId: postingsTable.companyId,
			title: postingsTable.title,
			normalizedTitle: postingsTable.normalizedTitle,
			description: postingsTable.description,
			status: postingsTable.status,
			dates: sql<string>`group_concat(${publications.publishedAt})`,
			list: companies.list,
			listSource: companies.listSource
		})
		.from(postingsTable)
		.innerJoin(publications, eq(publications.postingId, postingsTable.id))
		.innerJoin(companies, eq(companies.id, postingsTable.companyId))
		.groupBy(postingsTable.id)
		.all();

	const autoListed = new Set(rows.filter((r) => r.list === 'negra' && r.listSource === 'auto').map((r) => r.companyId));
	// las que decidiste tú (lista blanca o bloqueo a mano) no las toca la regla automática
	const manual = new Set(rows.filter((r) => r.list && r.listSource === 'manual').map((r) => r.companyId));
	const byCompany = Map.groupBy(
		rows.map((r) => ({
			...r,
			companyId: r.companyId!,
			dates: r.dates
				.split(',')
				.map(Date.parse)
				.sort((a, b) => a - b)
		})),
		(p) => p.companyId
	);

	let count = 0;
	db.transaction((tx) => {
		tx.update(postingsTable).set({ repeatTimes: 1, repeatFirst: null }).run();
		for (const [companyId, postings] of byCompany) {
			const vacancies = sameVacancies(postings);
			for (const v of vacancies) {
				if (v.dates.length < 2) continue;
				for (const p of v.postings) {
					tx.update(postingsTable)
						.set({ repeatTimes: v.dates.length, repeatFirst: new Date(v.dates[0]).toISOString() })
						.where(eq(postingsTable.id, p.id))
						.run();
				}
			}

			if (manual.has(companyId)) continue;
			const reasons = vacancies.flatMap(reason);
			const company = eq(companies.id, companyId);
			if (reasons.length) {
				const listReason = JSON.stringify(reasons);
				if (autoListed.has(companyId)) {
					tx.update(companies).set({ listReason }).where(company).run();
				} else {
					tx.update(companies)
						.set({ list: 'negra', listSource: 'auto', listReason, listedAt: new Date().toISOString() })
						.where(company)
						.run();
				}
				count++;
			} else if (autoListed.has(companyId)) {
				tx.update(companies)
					.set({ list: null, listSource: null, listReason: null, listedAt: null })
					.where(company)
					.run();
			}
		}
	});
	return count;
}

/**
 * Agrupa las vacantes de una empresa que son la misma: mismo título normalizado, descripción
 * casi idéntica, o —si descartaste una de las dos— descripción muy parecida.
 */
function sameVacancies(postings: Posting[]): Vacancy[] {
	const shingles = postings.map((p) => (p.description ? shingleSet(p.description) : null));
	const parent = postings.map((_, i) => i);
	const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const linkedByDiscard = new Set<number>();

	for (let i = 0; i < postings.length; i++) {
		for (let j = i + 1; j < postings.length; j++) {
			const a = postings[i];
			const b = postings[j];
			const sim = shingles[i] && shingles[j] ? jaccard(shingles[i]!, shingles[j]!) : 0;
			const discarded = [a, b].filter((p) => p.status === 'descartada');
			if (a.normalizedTitle === b.normalizedTitle || sim >= AUTO_SIMILARITY) {
				parent[find(i)] = find(j);
			} else if (discarded.length && sim >= DISCARD_SIMILARITY) {
				parent[find(i)] = find(j);
				discarded.forEach((p) => linkedByDiscard.add(p.id));
			}
		}
	}

	return [...Map.groupBy(postings, (_, i) => find(i)).values()].map((group) => {
		// publicaciones distintas: separadas por más de 7 días de la anterior contada
		const dates: number[] = [];
		for (const t of group.flatMap((p) => p.dates).sort((a, b) => a - b)) {
			if (!dates.length || t - dates.at(-1)! > MIN_GAP) dates.push(t);
		}
		return { postings: group, dates, discards: group.filter((p) => linkedByDiscard.has(p.id)) };
	});
}

/** Motivo de lista negra si hay 3+ publicaciones dentro de alguna ventana de 3 meses. */
function reason(v: Vacancy): Reason[] {
	let start = -1;
	let end = -1;
	for (let i = 0, j = 0; i < v.dates.length; i++) {
		while (j < v.dates.length && v.dates[j] - v.dates[i] <= WINDOW) j++;
		if (j - i >= BLACKLIST_AT && j - i > end - start) [start, end] = [i, j];
	}
	if (start < 0) return [];

	const inWindow = v.dates.slice(start, end);
	const titles = [...new Set(v.postings.map((p) => p.title))].map((t) => `"${t}"`);
	const what = titles.length === 1 ? titles[0] : `la misma vacante (${titles.join(', ')})`;
	const discards = v.discards.map((p) => `"${p.title}"`).join(', ');
	return [
		{
			kind: v.discards.length ? 'descarte' : 'repetida',
			text:
				`Publicó ${what} ${inWindow.length} veces entre ${day(inWindow[0])} y ${day(inWindow.at(-1)!)}` +
				(discards ? `, contando tu descarte de ${discards}` : ''),
			ids: v.postings.map((p) => p.id)
		}
	];
}

/** Grupos de 3 palabras seguidas: comparar estos conjuntos mide cuánto texto comparten. */
function shingleSet(text: string): Set<string> {
	const words = normalizeText(text).split(' ');
	const set = new Set<string>();
	for (let i = 0; i + 3 <= words.length; i++) set.add(words.slice(i, i + 3).join(' '));
	return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
	let shared = 0;
	for (const s of a) if (b.has(s)) shared++;
	const union = a.size + b.size - shared;
	return union ? shared / union : 0;
}

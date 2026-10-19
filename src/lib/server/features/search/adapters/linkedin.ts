import { decodeEntities, htmlToText, normalizeText, samePlace } from '$lib/server/shared/normalize';
import type { Location } from '$lib/server/shared/profile';
import type { Modality, PlatformAdapter, RawPosting } from './types';

// Endpoint público de invitados (sin login, sin cookies), el mismo que usa la página de
// empleos cuando no hay sesión. Devuelve fragmentos HTML de 10 tarjetas.
// LinkedIn es la plataforma que más limita: pausas largas y pocas páginas por búsqueda.
const SEARCH = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const DETAIL = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';
const PER_PAGE = 10;
const MAX_PAGES = 2; // ordena por relevancia: las primeras 20 son las que importan
// f_WT (tipo de lugar de trabajo): 2 = remoto
const REMOTE = '2';

const clean = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function parseSearchPage(html: string, modality?: Modality): RawPosting[] {
	const postings: RawPosting[] = [];
	for (const card of html.match(/<li>[\s\S]*?<\/li>/g) ?? []) {
		const id = card.match(/urn:li:jobPosting:(\d+)/)?.[1];
		const title = card.match(/base-search-card__title">([\s\S]*?)<\/h3>/)?.[1];
		const date = card.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"[^>]*>([\s\S]*?)<\/time>/);
		if (!id || !title || !date) continue;

		const company = card.match(/base-search-card__subtitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1];
		const location = card.match(/job-search-card__location">([\s\S]*?)<\/span>/)?.[1];

		postings.push({
			externalId: id,
			url: `https://www.linkedin.com/jobs/view/${id}/`,
			title: clean(title),
			company: company ? clean(company) : null,
			location: location ? clean(location) : undefined,
			modality,
			publishedAt: new Date(`${date[1]}T12:00:00Z`),
			publishedRaw: clean(date[2])
		});
	}
	return postings;
}

/** Descripción completa más los criterios (nivel, tipo de empleo, sector). */
export function parseDetail(html: string): Partial<RawPosting> {
	const markup = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/)?.[1];
	if (!markup) return {};
	const criteria = [
		...html.matchAll(/description__job-criteria-subheader">([\s\S]*?)<\/h3>\s*<span[^>]*>([\s\S]*?)<\/span>/g)
	].map((m) => `${clean(m[1])}: ${clean(m[2])}`);
	return { description: [htmlToText(markup), ...criteria].join('\n') };
}

/** La búsqueda por ciudad trae también ciudades cercanas: se queda con la del perfil o todo el país. */
function wanted(p: RawPosting, where: Location): boolean {
	if (p.modality === 'remoto') return true;
	const place = p.location ?? '';
	return samePlace(place, where.city) || normalizeText(place) === normalizeText(where.country);
}

export const linkedin: PlatformAdapter = {
	id: 'linkedin',
	name: 'LinkedIn',
	// medido: tolera unas 30 peticiones por ventana de 10–15 minutos (más o menos rápido) y
	// después responde 429; el límite se resetea solo. Cupo por búsqueda por debajo de eso
	// (cada búsqueda avanza unas palabras clave) y pausa corta ante un bloqueo.
	delay: { min: 15_000, max: 25_000 },
	maxRequestsPerRun: 25,
	pauseHours: 2,
	// busca por relevancia: "desarrollador fullstack" trae también vacantes solo parecidas
	looseSearch: true,

	async *search(term, { client, since, location }) {
		// el sitio filtra por antigüedad (f_TPR, en segundos), así que todo lo que devuelve es reciente
		const seconds = Math.max(86_400, Math.ceil((Date.now() - since.getTime()) / 1000));
		const searches: { place: string; remote: boolean }[] = [
			{ place: location.country, remote: true },
			{ place: `${location.city}, ${location.country}`, remote: false }
		];

		for (const { place, remote } of searches) {
			for (let page = 0; page < MAX_PAGES; page++) {
				const params = new URLSearchParams({
					keywords: term,
					location: place,
					f_TPR: `r${seconds}`,
					start: String(page * PER_PAGE)
				});
				if (remote) params.set('f_WT', REMOTE);

				const postings = parseSearchPage(await client.text(`${SEARCH}?${params}`), remote ? 'remoto' : undefined);
				for (const p of postings) {
					if (p.publishedAt >= since && wanted(p, location)) yield p;
				}
				if (postings.length < PER_PAGE) break;
			}
		}
	},

	async fetchDetail(posting, { client }) {
		return parseDetail(await client.text(`${DETAIL}/${posting.externalId}`));
	}
};

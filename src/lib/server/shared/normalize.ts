import { createHash } from 'node:crypto';

/** Minúsculas, sin tildes, sin signos; deja letras, números y + # . (c#, node.js). */
export function normalizeText(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9+#.]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const COMPANY_SUFFIXES = /\b(s ?a ?s|s ?a|ltda|inc|llc|corp|spa|s ?de ?r ?l|sa de cv)\b\.?/g;

export function normalizeCompany(name: string): string {
	return normalizeText(name.replace(/\./g, ' ')).replace(COMPANY_SUFFIXES, '').replace(/\s+/g, ' ').trim();
}

// Palabras que cambian entre republicaciones sin que cambie la vacante.
const TITLE_NOISE =
	/\b(urgente|urgent|remoto|remote|hibrido|hybrid|presencial|colombia|latam|barranquilla|bogota|medellin|cali|100|a|o|as|os)\b/g;

export function normalizeTitle(title: string): string {
	return normalizeText(title)
		.replace(/\bfull ?stack\b/g, 'fullstack')
		.replace(/\bback ?end\b/g, 'backend')
		.replace(/\bfront ?end\b/g, 'frontend')
		.replace(TITLE_NOISE, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function htmlToText(html: string): string {
	return html
		.replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s*\n+/g, '\n')
		.trim();
}

export function descriptionHash(description: string): string {
	return createHash('sha1').update(normalizeText(description)).digest('hex');
}

/** "Barranquilla, Atlántico" contiene "barranquilla"; sin importar tildes ni mayúsculas. */
export function samePlace(text: string, place: string): boolean {
	return normalizeText(text).includes(normalizeText(place));
}

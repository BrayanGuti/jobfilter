import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDetail, parseSearchPage } from './linkedin';

const fixture = (name: string) => readFileSync(resolve('fixtures/linkedin', name), 'utf8');

describe('parseSearchPage', () => {
	const remote = parseSearchPage(fixture('busqueda-remoto.html'), 'remoto');

	test('lee las 10 tarjetas de una página', () => {
		expect(remote).toHaveLength(10);
	});

	test('arma la vacante con la URL limpia y la fecha exacta', () => {
		expect(remote[0]).toMatchObject({
			externalId: '4462080323',
			url: 'https://www.linkedin.com/jobs/view/4462080323/',
			title: 'Senior Full Stack Developer (Django + React) - Remote Work | REF#302834',
			company: 'BairesDev',
			location: 'Colombia',
			modality: 'remoto',
			publishedRaw: 'Hace 2 semanas'
		});
		expect(remote[0].publishedAt.toISOString()).toBe('2026-10-01T12:00:00.000Z');
	});

	test('la búsqueda por ciudad no asume modalidad', () => {
		const city = parseSearchPage(fixture('busqueda-ciudad.html'));
		expect(city.length).toBeGreaterThan(0);
		expect(city.every((p) => p.modality === undefined)).toBe(true);
		expect(city.some((p) => p.location?.startsWith('Barranquilla'))).toBe(true);
	});

	test('una página vacía no rompe', () => {
		expect(parseSearchPage('')).toEqual([]);
	});
});

describe('parseDetail', () => {
	test('descripción completa con los criterios', () => {
		const { description } = parseDetail(fixture('detalle.html'));
		expect(description).toContain('Integral Group Solution');
		expect(description).toContain('Nivel de antigüedad: Intermedio');
		expect(description).toContain('Tipo de empleo: Jornada completa');
		expect(description).not.toContain('<');
	});

	test('sin descripción devuelve vacío', () => {
		expect(parseDetail('<html></html>')).toEqual({});
	});
});

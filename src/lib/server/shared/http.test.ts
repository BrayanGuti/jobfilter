import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isChallengePage } from './http';

describe('isChallengePage', () => {
	test('un desafío de Cloudflare siempre es bloqueo', () => {
		expect(isChallengePage('<html>' + 'x'.repeat(50_000) + 'challenge-platform</html>')).toBe(true);
	});

	test('una página corta con captcha es un desafío', () => {
		expect(isChallengePage('<html><div class="g-recaptcha"></div></html>')).toBe(true);
	});

	test('una página real con un formulario de reCAPTCHA no es bloqueo', () => {
		const page = readFileSync(resolve('fixtures/elempleo/portada-ofertas.html'), 'utf8');
		expect(page).toContain('g-recaptcha');
		expect(isChallengePage(page)).toBe(false);
	});
});

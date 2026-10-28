import { redirect } from '@sveltejs/kit';
import { finishConnection } from '$lib/server/features/cloud/commands/finish-connection';
import type { RequestHandler } from './$types';

// Google vuelve aquí después de la pantalla de permisos.
export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	let error = url.searchParams.get('error');
	if (code) {
		try {
			await finishConnection(code, url.searchParams.get('state'));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
	redirect(303, error ? `/nube?error=${encodeURIComponent(error)}` : '/nube');
};

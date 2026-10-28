import { fail, redirect } from '@sveltejs/kit';
import { disconnectCloud } from '$lib/server/features/cloud/commands/disconnect-cloud';
import { restoreBackup } from '$lib/server/features/cloud/commands/restore-backup';
import { startConnection } from '$lib/server/features/cloud/commands/start-connection';
import {
	BackupWouldOverwrite,
	uploadBackup
} from '$lib/server/features/cloud/commands/upload-backup';
import { getCloudStatus } from '$lib/server/features/cloud/queries/get-cloud-status';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ cloud: getCloudStatus() });

/** Los errores de Google se muestran en la página en vez de tumbarla. */
async function attempt(fn: () => Promise<void>) {
	try {
		await fn();
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : String(e),
			canForce: e instanceof BackupWouldOverwrite
		});
	}
}

export const actions: Actions = {
	conectar: ({ url }) => {
		redirect(303, startConnection(`${url.origin}/nube/callback`));
	},
	guardar: async ({ request }) => {
		const force = (await request.formData()).has('force');
		return attempt(() => uploadBackup(force));
	},
	restaurar: () => attempt(restoreBackup),
	desconectar: () => attempt(disconnectCloud)
};

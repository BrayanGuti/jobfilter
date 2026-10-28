import { existsSync } from 'node:fs';
import { STAGED_RESTORE_PATH } from '$lib/server/db/client';
import { hasFile, putFile } from '../google-drive';
import { requireSettings, saveSettings } from '../settings';
import { createSnapshot, DB_FILE, PROFILE_FILE } from '../snapshot';

export class BackupWouldOverwrite extends Error {}

/** Sube la base y el perfil a la carpeta de la app en tu Drive, reemplazando el respaldo anterior. */
export async function uploadBackup(force: boolean) {
	if (existsSync(STAGED_RESTORE_PATH)) {
		// Subiría la base que se está por reemplazar, no la restaurada.
		throw new Error('Reinicia la app antes de guardar: hay una restauración pendiente.');
	}
	const settings = requireSettings();
	// Un computador que nunca sincronizó (por ejemplo, uno nuevo) pisaría el respaldo bueno.
	if (!force && !settings.lastSyncAt && (await hasFile(settings.refreshToken, DB_FILE))) {
		throw new BackupWouldOverwrite(
			'Ya hay un respaldo en esta cuenta, de otro computador o de antes. Si lo quieres, restáuralo; si guardas, se reemplaza por lo de este computador.'
		);
	}
	const snapshot = createSnapshot();
	await putFile(settings.refreshToken, DB_FILE, snapshot.db);
	await putFile(settings.refreshToken, PROFILE_FILE, snapshot.profile);
	saveSettings({ ...settings, lastSyncAt: new Date().toISOString() });
}

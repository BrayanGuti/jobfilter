import type { SearchProgress } from '$lib/progress';

// Estado en memoria de la búsqueda en curso: lo escribe el comando, lo lee la consulta.
export const search: { progress: SearchProgress } = {
	progress: { running: false, startedAt: null, finishedAt: null, platforms: [] }
};

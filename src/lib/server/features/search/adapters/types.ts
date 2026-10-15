import type { HttpClient } from '$lib/server/shared/http';
import type { Location } from '$lib/server/shared/profile';

export type Modality = 'remoto' | 'hibrido' | 'presencial';

/** Vacante tal como la entrega un adapter, ya filtrada por ubicación e idioma. */
export type RawPosting = {
	externalId: string;
	url: string;
	title: string;
	company: string | null;
	/** Quien publica, si la plataforma lo muestra (reclutador, cuenta, etc.). */
	recruiter?: string;
	location?: string;
	modality?: Modality;
	description?: string;
	publishedAt: Date;
	/** Fecha tal como vino de la plataforma ("hace 3 días", timestamp, etc.). */
	publishedRaw: string;
};

export type SearchContext = {
	client: HttpClient;
	/** Solo interesan vacantes publicadas desde esta fecha. */
	since: Date;
	/** Dónde puedes trabajar (profile/location.json); cada adapter filtra con esto. */
	location: Location;
};

export interface PlatformAdapter {
	id: string;
	name: string;
	/** Pausa aleatoria entre peticiones, en milisegundos. */
	delay: { min: number; max: number };
	search(term: string, ctx: SearchContext): AsyncGenerator<RawPosting>;
}

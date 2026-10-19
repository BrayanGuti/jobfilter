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
	/**
	 * La fecha es solo un tope ("Más de 30 días") o no se entendió: se guarda la primera vez,
	 * pero no se usa para detectar republicaciones.
	 */
	publishedApprox?: boolean;
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
	/**
	 * La plataforma busca por sinónimos ("tech lead" → "Líder técnico de instalaciones"): la
	 * búsqueda descarta las vacantes cuyo título y descripción no mencionan el término.
	 */
	looseSearch?: boolean;
	/**
	 * Máximo de peticiones por búsqueda, para plataformas que limitan mucho (LinkedIn). Al
	 * llegar, la búsqueda se detiene y las palabras que faltaron siguen en la próxima.
	 */
	maxRequestsPerRun?: number;
	/** Horas de pausa ante el primer bloqueo (se duplican si se repite). Por defecto, 24. */
	pauseHours?: number;
	search(term: string, ctx: SearchContext): AsyncGenerator<RawPosting>;
	/**
	 * Para plataformas cuyo listado no trae la descripción: la búsqueda lo llama solo con las
	 * vacantes que todavía no están en la base, y mezcla lo que devuelva.
	 */
	fetchDetail?(posting: RawPosting, ctx: SearchContext): Promise<Partial<RawPosting>>;
}

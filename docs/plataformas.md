# Plataformas

## Estado

| Plataforma | Estado | Cómo se integra | Dificultad estimada |
|---|---|---|---|
| [GetOnBoard](https://www.getonbrd.com) | ✅ Integrada | API pública JSON | — |
| [Computrabajo](https://co.computrabajo.com) | ✅ Integrada | HTML renderizado en el servidor + detalle de cada vacante nueva | — |
| [LinkedIn](https://www.linkedin.com/jobs) | ✅ Empleos | Endpoint público de invitados (sin login) + detalle, con cupo de peticiones | — |
| LinkedIn (publicaciones "estamos contratando") | Por decidir | La búsqueda de publicaciones exige sesión; ver abajo | — |
| [elempleo](https://www.elempleo.com/co/) | 🔜 Siguiente | API interna del sitio | Baja-media |
| [Torre](https://torre.ai) | Pendiente | API de búsqueda (el formato cambió, hay que redescubrirlo) | Media |
| [PeakU](https://peaku.co) | Pendiente | Estado embebido en el HTML (Nuxt) | Media |
| [Hireline](https://hireline.io/co) | Pendiente | HTML | Media |
| [Magneto365](https://www.magneto365.com/co) | Pendiente | API interna o `__NEXT_DATA__`; navegador headless si no queda otra | Media-alta |
| [Talently](https://talently.tech) | Por confirmar | Parece un marketplace donde las empresas te buscan, sin listado público | — |

Cada plataforma ya tiene su color reservado en `src/lib/platforms.ts`.

¿Quieres integrar una? Abre un issue con la plantilla **Nueva plataforma** para coordinar y
que nadie trabaje dos veces en lo mismo.

## Lo que se sabe de cada una

Sondeo hecho sin login y con un User-Agent de navegador (octubre de 2026):

- **GetOnBoard**: `https://www.getonbrd.com/api/v0/search/jobs?query=<texto>&per_page=100&page=N&expand=["company","location_cities","location_tenants"]`.
  Devuelve de la más nueva a la más vieja. Trae idioma (`lang`), modalidad
  (`remote_modality`: `fully_remote`, `remote_local`, `hybrid`, `no_remote`), países
  permitidos para remoto (`location_tenants`) y ciudades. Busca el texto también en la
  descripción, así que trae ruido; el mapa de calor lo compensa.
- **LinkedIn (empleos)**: endpoint público de invitados, el mismo que usa la página de
  empleos sin sesión. Sin login ni cookies.
  - Búsqueda: `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=<texto>&location=<lugar>&f_TPR=r<segundos>&f_WT=2&start=<offset>`.
    `location` acepta "Colombia" o "Barranquilla, Colombia" (y trae ciudades cercanas);
    `f_WT=2` es remoto; `f_TPR` filtra por antigüedad en segundos. 10 tarjetas por página,
    `start` avanza de 10 en 10. `sortBy=DD` no ordena de verdad por fecha.
  - Cada tarjeta trae id (`urn:li:jobPosting:<id>`), título, empresa, ubicación y la fecha
    exacta (`<time datetime="2026-10-13">`). La URL limpia es `/jobs/view/<id>/`.
  - Detalle: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<id>`, con la
    descripción (`show-more-less-html__markup`) y criterios (nivel, tipo de empleo, sector).
  - **Límites medidos**: tolera unas 30 peticiones por ventana de 10 a 15 minutos, más o menos
    rápido, y después responde 429 (también usa el código `999`); el límite se resetea solo.
    Por eso el adapter va con pausas de 15 a 25 segundos, un cupo de 25 peticiones por
    búsqueda (`maxRequestsPerRun`) y una pausa de 2 horas ante un bloqueo (`pauseHours`). La
    primera pasada por todas las palabras clave toma varias búsquedas; después cada palabra
    solo pide lo nuevo.
  - En pruebas reales, unas 6 de cada 10 vacantes remotas de Colombia estaban en inglés.
  - Muchas vacantes están en inglés: las filtra el detector de idioma de la búsqueda.
- **LinkedIn (publicaciones)**: las publicaciones de reclutadores ("estamos contratando") no
  se pueden buscar sin sesión. Una publicación sí se lee sin login si se tiene su link (trae
  `SocialMediaPosting` en JSON-LD con texto, autor y fecha), pero encontrarlas es el problema:
  DuckDuckGo y Bing responden con captcha a búsquedas automáticas, y la API de búsqueda de
  Google está cerrada a clientes nuevos. Opciones abiertas: un modo asistido (JobFilter abre la
  búsqueda en tu navegador y tú pegas los links que te sirvan) o una API de búsqueda de pago.
  Usar una sesión de LinkedIn queda descartado por el riesgo para la cuenta.
- **Computrabajo**: un subdominio por país con el mismo formato (`co`, `mx`, `pe`, `ar`,
  `cl`, `ec`, `ve`, `bo`, `py`, `uy`, `gt`, `sv`, `hn`, `ni`, `cr`, `pa`, `do`); el adapter
  elige según `location.country`.
  - Búsqueda: `https://co.computrabajo.com/trabajo-de-<término>-en-<lugar>?by=publicationtime&pubdate=<días>&p=<página>`.
    `<lugar>` es `remoto` o el slug de la ciudad (`barranquilla`, `bogota`); el slug del
    término quita tildes y puntos (`node.js` → `node-js`).
  - `pubdate` acepta 1, 3, 7, 15 o 30 días; `by=publicationtime` ordena por fecha (no
    estricto). 20 vacantes por página; el total viene en el `<h1>`.
  - Cada tarjeta es un `<article class="box_offer" data-id="…">` con título, empresa (link a
    su perfil; sin link es confidencial: "Importante empresa del sector"), ubicación, fecha
    ("Hace 3 horas", "Ayer", "Hace 5 días", "14 de septiembre" o "Más de 30 días") y etiquetas `Remoto` o `Presencial y
    remoto` (híbrido).
  - La tarjeta no trae la descripción: se pide la página de la vacante solo para las nuevas
    (bloque "Descripción de la oferta", que incluye requisitos y conocimientos).
  - La búsqueda por ciudad cuela algunas de otras ciudades: el adapter vuelve a filtrar con
    la ubicación de cada tarjeta.
  - Busca por sinónimos: "tech lead" en Barranquilla trae 72 resultados, entre ellos
    "Director Técnico Farmacéutico". El adapter declara `looseSearch: true` y la búsqueda
    solo guarda las que mencionan el término en el título o la descripción, con sus palabras
    en orden y cerca (en una prueba real, eso descartó 148 de 180).
- **elempleo**: el sitio llama a `api/joboffers/findbyfilter` (búsqueda) y
  `api/joboffers/getjoboffer` (detalle).
- **PeakU**: Nuxt con SSR; el estado de la página viene en `window.__NUXT__`.
- **Hireline**: páginas `https://hireline.io/co/empleos-de-<texto>` en HTML.
- **Magneto365**: Next.js. `/co/empleos` responde, pero las rutas de búsqueda probadas dieron
  500. Hay que mirar las peticiones del sitio desde el navegador.
- **Torre**: el endpoint conocido (`POST https://search.torre.co/opportunities/_search`)
  responde "Invalid request": cambió el formato del cuerpo.
- **Talently**: `/empleos`, `/ofertas` y `/jobs` dan 404.

## Agregar una plataforma

### 1. Investiga y guarda fixtures

Busca cómo trae el sitio las vacantes sin iniciar sesión: una API (pestaña *Network* del
navegador), HTML renderizado en el servidor o un estado embebido (`__NEXT_DATA__`,
`__NUXT__`). Anota:

- URL de búsqueda, parámetros y paginación.
- Si se puede filtrar por fecha y en qué orden vienen los resultados.
- Qué campos trae: empresa, quién publica, fecha (exacta o relativa: "hace 3 días"),
  ubicación, modalidad, idioma, descripción.

Guarda una o dos respuestas reales en `fixtures/<plataforma>/` para desarrollar el parser sin
pegarle al sitio en cada prueba.

### 2. Escribe el adapter

Crea `src/lib/server/features/search/adapters/<plataforma>.ts`:

```ts
import { htmlToText, samePlace } from '$lib/server/shared/normalize';
import type { PlatformAdapter, RawPosting } from './types';

export const miPlataforma: PlatformAdapter = {
	id: 'miplataforma', // el mismo id que en src/lib/platforms.ts
	name: 'Mi Plataforma',
	delay: { min: 4_000, max: 12_000 }, // pausa aleatoria entre peticiones, en ms

	async *search(term, { client, since, location }) {
		for (let page = 1; page <= 10; page++) {
			const html = await client.text(`https://.../buscar?q=${encodeURIComponent(term)}&page=${page}`);
			const items = parse(html); // tu parser

			let reachedOld = false;
			for (const item of items) {
				if (item.publishedAt < since) {
					reachedOld = true;
					continue;
				}
				// filtra por location.country / location.city / location.languages
				if (!item.remote && !samePlace(item.city, location.city)) continue;
				yield item satisfies RawPosting;
			}
			if (reachedOld || items.length === 0) return;
		}
	}
};
```

Si el listado no trae la descripción, implementa también `fetchDetail(posting, ctx)`: la
búsqueda lo llama solo para las vacantes que todavía no están en la base, así que cuesta una
petición por vacante nueva y nada en las búsquedas siguientes.

Si la plataforma devuelve resultados que no mencionan lo que buscaste (sinónimos, búsqueda
"inteligente"), declara `looseSearch: true`: la búsqueda descarta las vacantes cuyo título y
descripción no mencionan el término (sus palabras en orden y con hasta 2 palabras entre
una y otra).

Si la plataforma corta rápido con 429 (como LinkedIn), declara `maxRequestsPerRun`: cada
búsqueda hace como mucho esa cantidad de peticiones y las palabras clave que falten siguen en
la próxima, gracias al cursor por palabra. Si su límite se resetea rápido, baja también
`pauseHours` (por defecto 24).

Reglas del adapter:

- Solo traduce y filtra. No guarda nada: de eso se encarga la búsqueda.
- Usa siempre `ctx.client`: ya maneja pausas, reintentos y bloqueos (un 429, un 403 o un
  captcha pausan la plataforma 24 h).
- Corta la paginación en cuanto llegue a vacantes anteriores a `since`.
- Si la fecha viene como texto ("Hace 3 días", "14 de septiembre"), conviértela con
  `parsePublishedDate` de `$lib/server/shared/relative-date` y guarda el texto original en
  `publishedRaw`. Si la fecha es solo un tope ("Más de 30 días") o no se entiende, marca
  `publishedApprox: true`: así no se confunde con una republicación.
- Exporta las funciones de parseo por separado (como `parseSearchPage` y `parseDetail` en
  `computrabajo.ts`) para poder probarlas contra los fixtures.
- Nunca inicies sesión ni uses cookies de una cuenta.

### 3. Regístrala

Agrégala al arreglo de `src/lib/server/features/search/adapters/index.ts`. Si su id no está
en `src/lib/platforms.ts`, agrégalo con un tono que se distinga de los demás.

### 4. Prueba

Escribe `<plataforma>.test.ts` junto al adapter, con tests del parser contra tus fixtures
(`computrabajo.test.ts` sirve de ejemplo). No hagas peticiones reales en los tests.

```sh
bun run test      # tests de los parsers
bun run check     # tipos
bun run buscar    # una búsqueda real desde la terminal
```

Revisa que una segunda búsqueda no traiga duplicados y que los filtros de ubicación e
idioma funcionen.

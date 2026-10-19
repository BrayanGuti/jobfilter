# Changelog

Todos los cambios relevantes del proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado

- Integración con **LinkedIn Empleos** por el endpoint público de invitados: sin login ni
  cookies, así que no hay cuenta que se pueda bloquear. Busca remoto en tu país y en tu
  ciudad, y pide la descripción completa (con nivel y tipo de empleo) solo de las vacantes
  nuevas.
- **Cupo de peticiones por búsqueda** (`maxRequestsPerRun`) para plataformas que limitan
  mucho: LinkedIn hace 25 por búsqueda, con pausas de 15 a 25 segundos, y cada búsqueda
  avanza unas palabras clave.
- **Pausa por bloqueo configurable por plataforma** (`pauseHours`): LinkedIn se pausa 2 horas,
  porque su límite se resetea en minutos; las demás siguen en 24.
- **Cursor por palabra clave**: cada palabra recuerda cuándo se buscó completa, así una
  búsqueda cortada por el cupo sigue la próxima vez desde donde quedó.
- **Caché de detalles**: la descripción de cada vacante se pide una sola vez, aunque se
  descarte, y los filtros se vuelven a aplicar sobre la copia guardada.
- **Filtro de idioma** por la descripción, para todas las plataformas: si tu perfil solo acepta
  español, se descartan las vacantes en inglés aunque la plataforma no diga el idioma.
- LinkedIn bloquea con el código propio `999`: ahora también pausa la plataforma.

## [0.2.0] - 2026-10-17

### Agregado

- Integración con **Computrabajo**: busca en tu ciudad y en remoto con cada palabra clave, usa
  el filtro de fecha del sitio en las búsquedas incrementales y trae la descripción completa
  solo de las vacantes nuevas. Elige el sitio según el país del perfil (Colombia, México,
  Perú, Argentina, Chile y otros 12 países de Latinoamérica).
- Computrabajo busca por sinónimos ("tech lead" trae "Líder técnico de instalaciones"): sus
  vacantes solo se guardan si el título o la descripción mencionan el término (sus palabras en
  orden y cerca). Los adapters que buscan así lo declaran con `looseSearch`.
- Las empresas confidenciales de Computrabajo ("Importante empresa del sector") no se guardan
  como empresa, para no mezclarlas en la lista negra.
- Los adapters pueden pedir el detalle de una vacante (`fetchDetail`) cuando el listado no trae
  la descripción; la búsqueda lo hace solo para las vacantes que no están en la base.
- Fechas como las muestran los portales: "Hace 3 horas", "Ayer", "14 de septiembre" y "Más de
  30 días". Las que son solo un tope ("Más de 30 días") se marcan como aproximadas y no cuentan
  como republicación.
- Tests de los parsers con `bun test`, contra respuestas reales guardadas en `fixtures/`. El CI
  también los corre.

### Cambiado

- La lista se ordena por compatibilidad con tu perfil (100% primero) y, a igual porcentaje, por
  fecha de publicación, sin importar la plataforma. Las vacantes sin tecnologías reconocidas
  van al final.

## [0.1.0] - 2026-10-14

Primera versión.

### Agregado

- Botón **Buscar**: busca con las palabras clave del perfil, desde hoy hasta 3 meses atrás, y
  después solo lo nuevo. Pausas aleatorias entre peticiones y pausa automática de una
  plataforma ante un bloqueo (429, 403 o captcha).
- Integración con **GetOnBoard** (API pública), filtrando por país, ciudad e idioma del
  perfil.
- Lista de vacantes con **Apliqué** y **Descarto**, y página **Descartadas** para retomarlas.
- **Lista negra automática**: la misma vacante publicada 3 o más veces en 3 meses, reconocida
  por título o por similitud de la descripción. Aviso ⟲ desde la segunda publicación.
- **Bloquear empresa** a mano y **lista blanca**.
- **Mapa de calor** según `profile/skills.json`, con la mejor vacante de cada empresa marcada
  con ★.
- Perfil portable en `profile/` y prompts para generarlo desde un CV.
- SQLite con Drizzle ORM: `bun:sqlite` con Bun y `better-sqlite3` con Node, elegido al
  arrancar.
- Modo oscuro automático.

[Sin publicar]: https://github.com/SebastianAsprino/jobfilter/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SebastianAsprino/jobfilter/releases/tag/v0.1.0

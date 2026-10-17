# Changelog

Todos los cambios relevantes del proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

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

[Sin publicar]: https://github.com/SebastianAsprino/jobfilter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SebastianAsprino/jobfilter/releases/tag/v0.1.0

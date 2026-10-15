# Changelog

Todos los cambios relevantes del proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

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

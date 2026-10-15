# JobFilter

App local que reemplaza la búsqueda manual de vacantes de todos los días. Un botón busca en
las plataformas de empleo con tus palabras clave, descarta las empresas que publican la
misma vacante una y otra vez para juntar CVs, y te deja una lista de links con un color
según cuánto encaja cada vacante con tu perfil. Aplicar lo haces tú.

Corre en tu máquina, sin cuentas ni servidores, y nunca inicia sesión en las plataformas.

## Requisitos

- [Bun](https://bun.sh) 1.4 o superior (recomendado). La app también corre con Node 22+, ver
  [Correrla](#correrla).
- Un CV (PDF, Word o texto) y acceso a un asistente de IA (Claude, ChatGPT…) para generar tu
  perfil una sola vez.

## Instalación

```sh
git clone <url-del-repo> jobfilter
cd jobfilter
bun install
```

## Tu perfil: la carpeta `profile/`

Todo lo personal vive en `profile/`, que **no se sube a git**. Son tres archivos:

| Archivo | Para qué sirve |
|---|---|
| `profile/keywords.json` | Las búsquedas que corre el botón en cada plataforma (cargos y tecnologías). |
| `profile/skills.json` | Las tecnologías que **tienes** y las que **no**. De aquí sale el color de cada vacante. |
| `profile/location.json` | Tu país, tu ciudad y los idiomas en que aceptas vacantes. |

Sin estos archivos la app no arranca y te avisa qué falta. Tienes dos opciones:

- **Probar rápido**: `cp -r profile.example profile` (es el perfil de un fullstack
  TypeScript; los colores no van a reflejar el tuyo).
- **Generar el tuyo** con los prompts de abajo. Toma unos minutos y es lo recomendado.

### Prompt 1: generar el perfil desde tu CV

Abre un chat nuevo con tu asistente de IA, adjunta tu CV y pega esto. Completa los tres datos
entre corchetes:

````text
Voy a usar una app que busca vacantes por mí. Necesito que, a partir de mi CV adjunto, generes
3 archivos JSON. Datos que no están en el CV:
- País donde vivo: [Colombia]
- Ciudad (para vacantes presenciales o híbridas): [Bogotá]
- Idiomas en los que acepto vacantes (códigos ISO): [es]   ← agrega "en" solo si trabajas en inglés

Reglas generales: no inventes nada que no esté en el CV. Devuelve cada archivo en su propio
bloque de código, con su nombre como título, y nada más.

## 1) location.json
{
  "_nota": "Dónde puedes trabajar.",
  "country": "<país>",
  "city": "<ciudad>",
  "languages": ["<códigos ISO>"]
}

## 2) keywords.json
Son las búsquedas que se escriben en el buscador de cada portal de empleo (como las que yo
escribiría a mano). Formato:
{
  "_nota": "Búsquedas que corre el botón Buscar.",
  "keywords": ["...", "..."]
}
Reglas:
- Entre 15 y 25 búsquedas, cortas (1 a 3 palabras), en minúsculas.
- Mezcla: los cargos a los que apunto según mi experiencia (en español y en inglés, porque en
  Latinoamérica muchos títulos vienen en inglés: "desarrollador backend" y "backend
  developer") y mis 4 a 6 tecnologías principales solas ("typescript", "react").
- Incluye cargos de mi nivel y uno arriba o abajo si mi experiencia lo justifica
  (por ejemplo "tech lead" si lideré equipos).
- Nada de tecnologías que no estén en el CV.

## 3) skills.json
De aquí sale el color de cada vacante: compara lo que pide con lo que tengo. Formato:
{
  "_nota": "...",
  "tengo": {
    "TypeScript": ["typescript"],
    "Node.js": ["node.js", "nodejs", "node js"],
    "Go": ["golang", "go lang", "titulo:go"]
  },
  "no_tengo": {
    "Java": ["java"],
    "Spring": ["spring", "spring boot"]
  }
}
Reglas:
- La clave es el nombre visible; el valor es la lista de formas en que aparece escrito en
  una vacante (minúsculas, con y sin punto o espacio: "next.js", "nextjs", "next js").
- "tengo": SOLO lenguajes, frameworks, bases de datos, nubes y herramientas que aparecen en
  mi CV. Puedes agrupar servicios bajo su nube ("aws": "lambda", "s3", "sqs"...).
- "no_tengo": entre 30 y 50 tecnologías que aparecen seguido en vacantes de MI área y NO
  están en mi CV (por ejemplo, para un backend: Java, Spring, PHP, Laravel, Kotlin,
  Kubernetes, Azure, GCP, MongoDB, Redis, Kafka, SAP, Salesforce...).
- NO incluyas tecnologías genéricas que piden casi todas las vacantes y no dicen nada del
  cargo: SQL, Git, REST, CI/CD, HTML/CSS, Agile/Scrum, inglés.
- Palabras cortas que son ambiguas en un texto normal (como "go" o "r"): ponles el prefijo
  "titulo:" ("titulo:go") y así solo cuentan si aparecen en el título de la vacante.
- Cuidado con las que se contienen entre sí: "java" no debe usarse como variante de
  JavaScript, ni "react" de React Native (pon React Native como entrada propia).
- Una misma variante no puede estar en "tengo" y en "no_tengo".
````

Guarda los tres bloques como `profile/location.json`, `profile/keywords.json` y
`profile/skills.json`.

### Prompt 2: actualizar después de cambiar el CV

Si aprendiste algo nuevo o cambiaste el CV, adjunta el CV nuevo **y tu `skills.json`
actual** y pega:

````text
Actualicé mi CV (adjunto) y este es mi skills.json actual (adjunto). Devuélveme el skills.json
actualizado con las mismas reglas de formato:
- Pasa de "no_tengo" a "tengo" lo que ahora aparece en el CV.
- Agrega a "tengo" las tecnologías nuevas del CV, con sus variantes de escritura.
- No borres ni cambies entradas que yo agregué a mano, aunque no estén en el CV.
- No agregues genéricas (SQL, Git, REST, CI/CD, HTML/CSS).
Devuelve solo el JSON.
````

Si cambiaste de cargo objetivo, repite el Prompt 1 solo para `keywords.json`. Las palabras
que agregues o quites desde la app quedan guardadas en la base y no se pierden.

### Ajustes a mano

Los tres archivos se pueden editar en cualquier momento: `skills.json` se relee en cada carga
de la página, `location.json` en cada búsqueda y `keywords.json` al reiniciar la app.

## Correrla

```sh
bun run dev        # con Bun (usa bun:sqlite) y abre el navegador
bun run dev:node   # con Node (usa better-sqlite3), si no quieres usar Bun
bun run buscar     # la misma búsqueda del botón, desde la terminal (requiere Bun)
```

La app detecta sola con qué runtime arrancó y elige el driver de SQLite. La base se crea sola
en `data/jobfilter.db` la primera vez.

## Cómo se usa

- **Buscar**: busca con cada palabra clave en todas las plataformas. La primera vez trae los
  últimos 3 meses (tarda unos minutos); después, solo lo nuevo.
- **Cada vacante** tiene una franja de color según qué parte de lo que pide tienes: 🟢 75% o
  más, 🟠 40–75%, 🔴 menos de 40%, gris si no menciona tecnologías. Si una empresa tiene varias
  vacantes en tu lista, la que más encaja lleva **★**: aplica a esa.
- **Apliqué / Descarto**: la sacan de la lista. Las descartadas se pueden **retomar** desde su
  página.
- **Lista negra**: una empresa cae sola si publica **la misma vacante 3 o más veces en 3
  meses** (con 2 solo aparece un aviso ⟲). También puedes **Bloquear** una empresa a mano o
  pasarla a **lista blanca** para que nunca caiga.
- Se buscan solo vacantes en los idiomas de tu perfil, remotas abiertas a tu país o
  presenciales/híbridas en tu ciudad.

## Para desarrollar

El código está organizado en **slices verticales** con **CQRS**: cada funcionalidad tiene su
carpeta, y dentro, los **comandos** (cambian datos) separados de las **consultas** (solo
leen). Las rutas de SvelteKit solo llaman a un comando o una consulta.

```
src/lib/server/
  db/            client.ts (elige bun:sqlite o better-sqlite3), schema.ts (Drizzle)
  shared/        http.ts (pausas, reintentos, bloqueos), normalize.ts, profile.ts
  features/
    search/      commands/start-search · queries/get-search-progress · adapters/ (una plataforma por archivo)
    postings/    commands/save-posting, mark-applied, discard-posting, retake-posting · queries/list-new-postings, list-discarded
    companies/   commands/recalculate-blacklist, block-company, whitelist-company, unlist-company · queries/list-companies
    keywords/    commands/import-keyword-seed, add-keyword, disable-keyword · queries/list-keywords
    match/       queries/match-posting (el color de cada vacante)
src/routes/      páginas: / (lista), /descartadas, /lista-negra, /api/buscar
drizzle/         migraciones
```

- **Agregar una plataforma**: un archivo en `features/search/adapters/` que implemente
  `PlatformAdapter` (traducir la respuesta de la plataforma a `RawPosting` y filtrar por
  ubicación e idioma con `ctx.location`), y sumarlo en `adapters/index.ts`. Su color va en
  `src/lib/platforms.ts`. `PLAN.md` tiene lo que se sabe de cada plataforma.
- **Cambiar la base**: edita `db/schema.ts` y corre `bun run db:generate`. La migración se
  aplica sola al arrancar.
- `bun run check` revisa los tipos.

## Aviso

Algunas plataformas prohíben el scraping en sus términos de uso. JobFilter está pensado para
uso personal: pocas peticiones, pausas entre ellas, sin iniciar sesión y sin redistribuir
datos. Úsalo bajo tu responsabilidad.

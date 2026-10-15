# JobFilter: plan

App local (Bun + SvelteKit + SQLite) que reemplaza la búsqueda manual de todos los días
("fullstack", "backend", "typescript"… en cada plataforma). Busca, filtra a las empresas
que reciclan vacantes y te deja una lista de links. Aplicar lo haces tú a mano, como hoy.

---

## 1. La app

Es **un botón, una lista y una página de lista negra**. Nada más.

**Página principal**

```
[ Buscar ]   fullstack · backend developer · typescript · … [+ agregar]
             GetOnBoard ✓ 12 nuevas · LinkedIn ✓ 30 · Computrabajo ⏸ en pausa · …

Desarrollador Fullstack  — Acme S.A.S  · Computrabajo · 2026-10-13   [Apliqué] [Descarto]
Backend Engineer (Node)  — Foo Labs    · LinkedIn     · 2026-10-12   [Apliqué] [Descarto]
…
```

- **Botón Buscar**: corre la búsqueda en todas las plataformas y actualiza la lista. Debajo
  muestra cómo le fue a cada una.
- **Palabras clave**: chips junto al botón con un campo para agregar más. La lista inicial
  la genero yo a partir del CV (sección 4).
- **Lista**: cada fila es el título (link a la vacante, abre en pestaña nueva), la
  empresa, la plataforma y la fecha de publicación, de la más nueva a la más vieja.
  Solo aparecen vacantes sin marcar y de empresas que no están en la lista negra.
- **Dos botones por fila**:
  - **Apliqué**: la guarda como aplicada y sale de la lista.
  - **Descarto**: sale de la lista y queda registrada como **repetición** de esa empresa
    (ver sección 3).

- **Mapa de calor**: cada fila tiene una franja de color según cuánto de lo que pide la
  vacante tienes. Sale de `skills.json` (lo genero yo desde el CV): `tengo` y `no_tengo`.
  🟢 75% o más · 🟠 40–75% · 🔴 menos de 40% · gris si no menciona tecnologías. Las del
  título cuentan doble. Debajo del título se ven las que tienes (verde) y las que no (✗
  rojo). Las genéricas (SQL, Git, REST…) no cuentan. Ejemplos reales: "Java + Angular" 50%
  naranja, "Kotlin/Java" 14% rojo.
- **Varias vacantes de una misma empresa**: se marca con **★ la mejor de N** la que mejor
  encaja contigo, para aplicar a una sola (si todas son rojas, ninguna lleva ★).
- **Bloquear** (junto al nombre de la empresa, pide confirmación): manda la empresa a la
  lista negra a mano. Es para casos conocidos que no publican la misma vacante sino muchas
  distintas. Se deshace con **Desbloquear** en la lista negra.

**Página Lista negra**

```
Empresa X   10 veces "Desarrollador Fullstack" entre 2026-09-12 y 2026-10-10   [Lista blanca]
            ▸ ver publicaciones (fecha · plataforma · link)
Empresa Y   3 vacantes descartadas por ti en 2 meses                           [Lista blanca]
```

- Cada empresa trae **el motivo**: qué vacante repitió, cuántas veces, en qué fechas y en
  qué plataformas. Al expandir ves cada publicación con su link.
- **Lista blanca**: saca a la empresa de la lista negra y no vuelve a caer ahí
  automáticamente. Es para casos como **Ombia**: una software factory que publica cada ~2
  meses porque contrata de verdad. Desde una pestaña "Lista blanca" en la misma página se
  puede deshacer.

---

## 2. Qué hace el botón, por plataforma

1. Para cada palabra clave activa, busca vacantes publicadas **desde hoy hasta 3 meses
   atrás**, y se queda con las remotas que acepten Colombia y las de Barranquilla
   (presencial o híbrido), en español.
   - La primera vez trae los 3 meses completos. Las siguientes solo traen lo nuevo desde
     la última búsqueda (una palabra clave recién agregada sí busca sus 3 meses).
   - Algunas plataformas no muestran 3 meses hacia atrás (muchas solo ~30 días). En ese
     caso se trae lo que haya y el historial de 3 meses se completa con el uso.
2. Guarda cada vacante con **fecha de publicación y quién la publica** (empresa, y el
   reclutador si la plataforma lo muestra).
3. Junta duplicados: la misma vacante encontrada con varias palabras clave, o en varias
   plataformas el mismo día, es **una sola fila** (no es repetición).
4. Corre la **purga** (sección 3) y actualiza la lista y la lista negra.

Sin LLM y sin agente: es un script. Yo participo solo al principio, para descubrir cómo
responde cada plataforma, y cuando me pidas regenerar las palabras clave.

---

## 3. Purga y lista negra

La purga corre al terminar cada búsqueda, al descartar y al retomar. Recalcula todo: agrega
empresas y saca las que ya no tienen motivo. Nunca toca la lista blanca.

**"Misma vacante"** se mide comparando cuánto texto comparten las descripciones (grupos de 3
palabras seguidas). Con datos reales de GetOnBoard: vacantes distintas de una misma empresa
comparten como mucho ~21% (la presentación de la empresa); la misma vacante con el texto
retocado ~70%; una copia exacta, 100%.

**Cuándo cae una empresa**: cuando publica **la misma vacante 3 o más veces dentro de 3
meses** (más o menos una vez al mes, el patrón de las que recolectan CVs). Una sola
republicación puede ser real (el contratado no funcionó), así que con 2 la vacante sigue en
la lista con el aviso **"⟲ 2ª publicación, desde <fecha>"**. Publicaciones a menos de 7 días
entre sí cuentan como una sola (por ejemplo, la misma en dos plataformas).

**Cómo se reconoce "la misma vacante"**: mismo título normalizado, o descripción ≥ 90% igual
(el script solo). Ejemplo real: Improving publicó la misma descripción con dos títulos
("Desarrollador Full-Stack: Java & Angular" y "Full-Stack Developer: Java + Angular") con 4
semanas de diferencia: hoy tiene el aviso de 2ª publicación; si la publica una tercera vez,
cae.

**Descarto**: la vacante sale de la lista y pasa a la página **Descartadas**. Si su
descripción es ≥ 60% igual a otra vacante de la misma empresa, cuenta como una publicación
más de esa vacante. Tu descarte no tumba a nadie por sí solo: solo suma al conteo de 3.

**Retomar** (en Descartadas): la vacante vuelve a la lista y el conteo se recalcula; si la
empresa había caído por ese descarte, sale de la lista negra.

**Qué pasa al caer**: sus vacantes desaparecen de la lista (no se borran de la base). El
motivo queda con los títulos, las fechas y las vacantes que lo prueban (marcadas con ⟲).

**Lista blanca**: una empresa ahí nunca cae automáticamente. Al quitarla de la lista blanca
se vuelve a evaluar.

**Empresas "Confidencial"** (comunes en Computrabajo): no tienen nombre para bloquear. Se
agrupan por descripción casi idéntica y en la lista negra se muestran como
"Confidencial · <título> · <plataforma>".

---

## 4. Palabras clave

Son las búsquedas que hoy escribes a mano. Las genero yo a partir del CV y quedan en
`keywords.seed.json` (origen `claude`). Lo que agregues desde la app queda como `manual`.
Si me pides "regenerar keywords" (por ejemplo, porque cambiaste el CV), actualizo solo las
mías.

Lista inicial:

`fullstack` · `full stack developer` · `desarrollador fullstack` · `backend developer` ·
`desarrollador backend` · `typescript` · `node.js` · `next.js` · `react developer` ·
`devops` · `software engineer` · `ingeniero de software` · `desarrollador web` ·
`arquitecto de software` · `cloud engineer` · `aws developer` · `golang developer` ·
`desarrollador .net` · `serverless` · `angular developer` · `python developer` ·
`sveltekit` · `tech lead`

Cada palabra es una búsqueda por plataforma. Con 23 palabras y 8 plataformas son muchas
peticiones, así que la primera búsqueda (3 meses) va a tardar. Las siguientes son mucho
más rápidas porque son incrementales.

---

## 5. Plataformas: lo que encontré (sondeo 2026-10-14)

Prueba con `curl`, sin login y con un User-Agent de navegador:

| Plataforma | Respuesta | Estrategia | Dificultad |
|---|---|---|---|
| **GetOnBoard** | API pública JSON `api/v0/search/jobs?query=` → 200 | `api` | Muy baja |
| **LinkedIn** | Endpoint guest `jobs-guest/jobs/api/seeMoreJobPostings/search` → 200, filtro de fecha `f_TPR` (sirve para 90 días) | `html` sin login | Baja-media (la que más limita) |
| **Computrabajo** | `co.computrabajo.com/trabajo-de-<query>` → 200, HTML server-side | `html` | Baja |
| **elempleo** | El sitio usa `api/joboffers/findbyfilter` | `api` interna | Baja-media |
| **PeakU** | Nuxt SSR, estado en `window.__NUXT__` | `html` | Media |
| **Hireline** | HTML 200 (`/co/empleos-de-...`) | `html` | Media |
| **Magneto365** | `/co/empleos` → 200; las rutas de búsqueda dieron 500 | API interna o `__NEXT_DATA__`; Playwright si no | Media-alta |
| **Torre** | El endpoint conocido respondió "Invalid request" | descubrir el formato actual | Media |
| **Talently** | `/empleos`, `/ofertas` y `/jobs` → 404 | Parece marketplace, no buscador | Por confirmar |

### Sin login, para que no bloqueen tu cuenta

El script **nunca inicia sesión**: todas estas plataformas muestran vacantes sin cuenta.
Si no hay cuenta, no hay cuenta que bloquear. Lo peor es un captcha temporal a tu IP, y
para eso:

- Peticiones en secuencia por plataforma, con 4–12 s aleatorios entre una y otra.
- Headers de navegador real y palabras clave en orden aleatorio.
- Se corta al llegar a vacantes ya conocidas.
- Si una plataforma responde 429/403 o captcha, queda **en pausa 24 h** (aparece como ⏸
  debajo del botón) y las demás siguen.
- Playwright solo donde no haya otra opción, con un perfil propio del bot y sin login.

Aplicar sí lo haces tú, logueado, desde tu navegador: tráfico normal.

> LinkedIn y otras prohíben el scraping en sus términos. Siendo uso personal, de poco
> volumen y sin login, el riesgo es bajo, pero no es cero.

---

## 6. Por dentro

Instalación, cómo correrlo y la estructura del código (slices verticales con CQRS) están en
`README.md`. Lo personal (palabras clave, skills y ubicación) vive en `profile/`, fuera de
git. La base es SQLite con Drizzle (`src/lib/server/db/schema.ts`): `bun:sqlite` si arranca
con Bun, `better-sqlite3` si arranca con Node.

**Base de datos**

```
companies   id, name, normalized_name,
            list (null | negra | blanca), list_reason, list_source (auto | manual), listed_at
postings    id, platform, external_id, url, title, normalized_title, company_id, recruiter,
            description_hash, published_at, published_raw, first_seen_at,
            status (nueva | aplicada | descartada), status_at,
            repeat_times, repeat_first   ← cuántas veces se publicó (lo calcula la purga)
            UNIQUE(platform, external_id)
publications posting_id, published_at   ← cada fecha de publicación distinta de una vacante
keywords    id, term, enabled, source (claude | manual), created_at
runs        id, platform, started_at, finished_at, found, new, error
platforms   id, paused_until, failures
```

- `published_raw` guarda el texto tal cual ("hace 3 días") y `published_at` la fecha
  calculada.
- La tabla `postings` con `status = aplicada` es tu registro de vacantes aplicadas, con la
  fecha de publicación y la empresa.

---

## 7. Etapas

Cada etapa termina en algo que se puede usar. Antes de cada plataforma reviso cómo
responde y guardo fixtures reales.

1. ✅ **Base + GetOnBoard** (2026-10-14): proyecto, base de datos, cliente HTTP con pausas, flujo del botón
   y la primera plataforma de punta a punta.
   **Hecho cuando**: das Buscar, aparecen vacantes reales de 3 meses, y una segunda
   búsqueda no duplica nada.
2. ✅ **La app** (2026-10-14): botón, lista con Apliqué/Descarto, chips de palabras clave,
   y un color fijo por plataforma (`src/lib/platforms.ts`, ya definido para las 9).
3. ✅ **Purga + página Lista negra** (2026-10-14): reglas automáticas, descartes como repetición, motivo
   con evidencia y lista blanca.
   **Hecho cuando**: una empresa con la misma vacante dos veces en 3 meses desaparece de
   la lista y aparece en la lista negra con su motivo, y al pasarla a lista blanca vuelve.
4. **LinkedIn**
5. **Computrabajo** (aquí entra el manejo de "Confidencial")
6. **elempleo**
7. **Torre**
8. **PeakU + Hireline**
9. **Magneto365**
10. **Talently**: se confirma si tiene listado público; si no, se descarta.

---

## 8. Decisiones (respondidas 2026-10-14)

- **Ubicación**: remoto (que acepte Colombia) + Barranquilla presencial o híbrido. Otras
  ciudades presenciales no.
- **Idioma**: solo vacantes en español. Las que estén en inglés se descartan solas
  (GetOnBoard trae el idioma; en las demás se detecta por el texto).
- **Seniority**: todo, de junior a 10+ años. Sin salario mínimo.
- **Cuándo busca**: solo al presionar el botón, con animación de progreso. Sin timer.
- **Plataformas**: todas las de la lista se mantienen; Talently queda al final.
- **Nombre**: el proyecto se llama JobFilter y vive en `postulaciones/jobfilter/`, con su
  propio repo de git (2026-10-14).
- **Drizzle ORM** con dos drivers según el runtime: `bun:sqlite` o `better-sqlite3`
  (2026-10-14). Migraciones en `drizzle/`.
- **Estructura**: slices verticales con CQRS (comandos y consultas separados por feature).
- **Perfil portable**: `profile/` (fuera de git) con keywords, skills y ubicación; README.md
  trae los prompts para generarlo desde un CV.
- **Modo oscuro** automático según el sistema operativo.
- **Lista negra**: 3+ publicaciones de la misma vacante en 3 meses (2 = solo aviso). Bloqueo
  manual y lista blanca disponibles.

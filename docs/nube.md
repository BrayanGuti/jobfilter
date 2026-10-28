# Respaldo en la nube

JobFilter guarda todo en tu máquina: `data/jobfilter.db` (vacantes nuevas, aplicadas y
descartadas, lista negra y blanca, palabras clave) y `profile/` (tu perfil). La pestaña
**Nube** sube una copia de los dos a **tu propia cuenta de Google Drive**, para no perderlos si
cambias de computador o se daña el disco.

- **Cada quien en su cuenta.** No hay servidor de JobFilter en el medio: la app habla
  directo con Google desde tu máquina.
- **Solo una carpeta oculta.** Se pide el permiso `drive.appdata`, que da acceso únicamente a
  una carpeta privada de la app. JobFilter no puede ver ni tocar el resto de tu Drive, y esa
  carpeta tampoco aparece entre tus archivos.
- **El token se queda contigo**, en `data/nube.json` (fuera de git).

## Configurar (una sola vez)

Google exige que cada app tenga sus credenciales. Como JobFilter corre en tu máquina, las creas
tú, en tu cuenta. Toma unos 5 minutos:

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) y crea un proyecto
   (por ejemplo, `jobfilter`).
2. **APIs y servicios → Biblioteca**: busca **Google Drive API** y habilítala.
3. **Google Auth Platform → Branding** (pantalla de consentimiento): nombre de la app y tu
   correo. Público: **Externo**. En **Usuarios de prueba** agrega tu correo de Gmail.
4. **Clientes → Crear cliente**: tipo **Aplicación web**. En **URI de redireccionamiento
   autorizados** agrega:

   ```
   http://localhost:5173/nube/callback
   ```

   Si corres la app en otro puerto, agrega también ese.
5. Copia el ID y el secreto del cliente a un archivo `.env` en la raíz de `jobfilter/` (está en
   `.gitignore`):

   ```sh
   GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
   ```

6. Reinicia `bun run dev`, abre la pestaña **Nube** y toca **Conectar Google Drive**.

Mientras la app esté en modo **Prueba**, Google vence el acceso a los 7 días y hay que volver a
conectar. Para que no venza, en **Público** toca **Publicar app**. Al conectar, Google te va a
avisar que la app no está verificada: es la tuya, así que puedes seguir con **Avanzado → Ir a
jobfilter**.

## Uso

- **Guardar en Drive** sube una copia de la base y del perfil, y reemplaza la anterior.
- **Restaurar desde Drive** reemplaza lo de este computador por el respaldo. El perfil se
  cambia de una vez; la base se cambia la próxima vez que arranques la app, porque no se puede
  reemplazar mientras está abierta. Lo que había queda en `data/jobfilter.db.antes-de-restaurar`
  y `data/profile-antes-de-restaurar/`.
- **Desconectar** revoca el permiso. El respaldo sigue en tu Drive; para borrarlo, en
  [drive.google.com](https://drive.google.com) → ⚙ Configuración → **Administrar apps** →
  JobFilter → **Borrar datos ocultos de la app**.

En un computador nuevo: instala JobFilter, configura el mismo `.env`, conecta la cuenta y toca
**Restaurar**. Si en cambio tocas **Guardar** primero, la app te avisa que ya hay un respaldo
antes de reemplazarlo con lo de un computador vacío.

## Cómo está hecho

Slice `src/lib/server/features/cloud/`:

```
google-drive.ts     OAuth (con PKCE) y la API de archivos de Drive, con fetch
snapshot.ts         copia de la base con VACUUM INTO (consistente aunque esté en modo WAL) y de profile/
settings.ts         data/nube.json: la cuenta conectada y la última sincronización
pending.ts          el estado de OAuth entre Conectar y la vuelta desde Google
commands/  start-connection, finish-connection, upload-backup, restore-backup, disconnect-cloud
queries/   get-cloud-status
```

En Drive quedan dos archivos: `jobfilter.db` (la base tal cual) y `profile.json` (los archivos
de `profile/` en un solo JSON). `db/client.ts` aplica la restauración pendiente
(`data/restaurar.db`) antes de abrir la base; las migraciones corren después, así que un
respaldo de una versión anterior se pone al día solo.

Para sumar otro proveedor (Dropbox, OneDrive) hace falta otro archivo con las mismas funciones
(`authUrl`, `exchangeCode`, `putFile`, `getFile`, `hasFile`, `revoke`) y que los comandos
elijan según `provider` en `data/nube.json`. La copia y la restauración no cambian.

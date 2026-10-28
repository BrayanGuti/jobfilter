<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let { data, form } = $props();

	let busy = $state<string | null>(null);
	const error = $derived(form?.error ?? page.url.searchParams.get('error'));

	/** Deshabilita los botones mientras Google responde (subir la base puede tardar). */
	const track = (action: string) => () => {
		busy = action;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = null;
		};
	};
</script>

<p class="muted intro">
	Guarda tu perfil, tus vacantes aplicadas y descartadas, la lista negra y tus palabras clave en
	<strong>tu propia cuenta de Google Drive</strong>, en una carpeta oculta que solo ve JobFilter. Así
	no lo pierdes si cambias de computador. No pasa por ningún servidor: va directo de tu máquina a tu
	Drive.
</p>

{#if !data.cloud.configured}
	<div class="card">
		<p>
			Para conectar Google Drive falta crear tus credenciales de Google y ponerlas en
			<code>.env</code>. Son unos minutos; los pasos están en <code>docs/nube.md</code>.
		</p>
	</div>
{:else if !data.cloud.connected}
	<div class="card">
		<p>No hay ninguna cuenta conectada.</p>
		<!-- Sin use:enhance: la respuesta es una redirección a Google y la hace el navegador. -->
		<form method="POST" action="?/conectar">
			<button class="primary">Conectar Google Drive</button>
		</form>
	</div>
{:else}
	<div class="card">
		<p>
			Conectado como <strong>{data.cloud.email ?? 'tu cuenta de Google'}</strong>.
			{#if data.cloud.lastSyncAt}
				Última sincronización: {new Date(data.cloud.lastSyncAt).toLocaleString('es')}.
			{:else}
				Este computador todavía no se ha sincronizado con tu Drive.
			{/if}
		</p>
		<div class="actions">
			<form method="POST" action="?/guardar" use:enhance={track('guardar')}>
				<button class="primary" disabled={busy !== null}>
					{busy === 'guardar' ? 'Guardando…' : 'Guardar en Drive'}
				</button>
			</form>
			<form method="POST" action="?/restaurar" use:enhance={track('restaurar')}>
				<button disabled={busy !== null}>
					{busy === 'restaurar' ? 'Bajando…' : 'Restaurar desde Drive'}
				</button>
			</form>
			<form method="POST" action="?/desconectar" use:enhance={track('desconectar')}>
				<button class="link" disabled={busy !== null}>Desconectar</button>
			</form>
		</div>
		<p class="muted small">
			Restaurar reemplaza lo que hay en este computador por el respaldo. Lo actual queda guardado en
			<code>data/</code> por si te arrepientes.
		</p>
	</div>
{/if}

{#if data.cloud.restorePending}
	<p class="notice">
		Respaldo descargado y perfil restaurado. <strong>Reinicia la app</strong> (detén
		<code>bun run dev</code> y vuelve a correrlo) para cargar tus vacantes y listas.
	</p>
{/if}

{#if error}
	<p class="error">{error}</p>
	{#if form?.canForce}
		<form method="POST" action="?/guardar" use:enhance={track('guardar')}>
			<input type="hidden" name="force" value="1" />
			<button class="link" disabled={busy !== null}>Reemplazar el respaldo de Drive</button>
		</form>
	{/if}
{/if}

<style>
	.intro {
		font-size: 14px;
		margin: 0 0 12px;
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 14px 16px;
	}
	.card p {
		margin: 0 0 12px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-bottom: 12px;
	}
	button {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 10px 16px;
	}
	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.primary {
		background: var(--accent);
		color: var(--accent-text);
		border: 0;
		font-weight: 600;
	}
	.link {
		background: none;
		border: 0;
		color: var(--danger);
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
	.notice {
		margin-top: 12px;
		color: var(--warn);
	}
	.error {
		margin-top: 12px;
		color: var(--danger);
		overflow-wrap: anywhere;
	}
</style>

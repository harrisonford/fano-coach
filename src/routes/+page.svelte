<script>
	import { onMount } from 'svelte';
	import { getConvexClient } from '$lib/convexClient';
	import { userId as userIdStore } from '$lib/stores/user';
	import { get } from 'svelte/store';

	/** @typedef {{ id: number; role: 'user'|'bot'; text: string, _loading?: boolean }} ChatMessage */
	let messages = /** @type{ChatMessage[]} */ ([
		{ id: 1, role: 'bot', text: 'Bienvenido a Fano Coaching. ¿En qué puedo ayudarte hoy?' }
	]);
	let draft = '';
	let nextId = 2;
	let loading = false;
	let errorText = '';
	let pathwaysJson = '';
	let currentUserId = '';

	function buildSystemPrompt(userId) {
		return `Eres un coach en español (Chile). userId=\"${userId}\". No pidas nombre. Sé proactivo: si no hay progreso, elige una ruta adecuada según el último mensaje (por defecto \"Conociéndote rápido\") y empieza con la primera pregunta. Puedes usar list_user_progress y start_progress. Si el usuario usa frases como \"recomiéndame\", decide tú.`;
	}

	onMount(async () => {
		try {
			const r = await fetch('/pathways.json', { headers: { accept: 'application/json' } });
			if (r.ok) pathwaysJson = await r.text();
		} catch {}
		queueMicrotask(() => document.getElementById('composer')?.focus());

		currentUserId = (get(userIdStore) || '').trim();
		const unsub = userIdStore.subscribe((val) => {
			const newId = (val || '').trim();
			if (newId && newId !== currentUserId) {
				messages = [{ id: 1, role: 'bot', text: 'Bienvenido a Fano Coaching. ¿En qué puedo ayudarte hoy?' }];
				draft = '';
				errorText = '';
				nextId = 2;
			}
			currentUserId = newId;
		});
		return () => unsub();
	});

	async function callLLM(userText, userId) {
		const client = getConvexClient();
		const convMessages = [
			{ role: 'system', content: buildSystemPrompt(userId) },
			...messages
				.filter(m => m.role === 'user' || m.role === 'bot')
				.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
			{ role: 'user', content: userText }
		];
		const origin = window.location.origin;
		const res = await client.action('ai:chatWithTools', { userId, origin, messages: convMessages, pathwaysJson });
		return res?.content ?? '';
	}

	async function persistProgress(userText, userId) {
		try {
			const client = getConvexClient();
			const res = await client.action('progressFlow:advance', { userId, pathwaysJson: pathwaysJson || '{"pathways":[]}', answer: userText });
			if (res?.completed) return '';
			return res?.nextQuestion || '';
		} catch {
			return '';
		}
	}

	function addLoader(text) {
		const id = nextId++;
		messages = [...messages, { id, role: 'bot', text, _loading: true }];
		return id;
	}
	function updateLoader(id, text) {
		messages = messages.map(m => (m.id === id ? { ...m, text } : m));
	}
	function replaceLoader(id, finalText) {
		messages = messages.map(m => (m.id === id ? { id, role: 'bot', text: finalText } : m));
	}
	function removeLoader(id) {
		messages = messages.filter(m => m.id !== id);
	}

	async function send() {
		const text = draft.trim();
		const userId = (get(userIdStore) || '').trim();
		if (!text || !userId || loading) return;
		messages = [...messages, { id: nextId++, role: 'user', text }];
		draft = '';
		loading = true;
		errorText = '';
		const loaderId = addLoader('Guardando progreso…');
		try {
			// First, persist to progress and get next question if available
			const nextQ = await persistProgress(text, userId);
			if (nextQ) {
				replaceLoader(loaderId, nextQ);
				loading = false;
				return;
			}
			updateLoader(loaderId, 'Consultando rutas…');
			// Brief staged status while we await the LLM
			const stageTimer = setTimeout(() => updateLoader(loaderId, 'Revisando tu historial…'), 500);
			const reply = await callLLM(text, userId);
			clearTimeout(stageTimer);
			if (!reply || !reply.trim()) throw new Error('Sin contenido del modelo');
			replaceLoader(loaderId, reply);
		} catch (err) {
			removeLoader(loaderId);
			errorText = err?.message || String(err);
		} finally {
			loading = false;
		}
	}

	function onKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<svelte:head>
	<title>Fano Coaching</title>
</svelte:head>

<div class="flex flex-col gap-4 h-full">
	{#if errorText}
		<div class="rounded-md border border-red-300/60 dark:border-red-700/60 bg-red-50/80 dark:bg-red-900/30 px-3 py-2 text-red-700 dark:text-red-200">{errorText}</div>
	{/if}

	<section class="flex-1 min-h-0 overflow-auto">
		<div class="space-y-4">
			{#each messages as m (m.id)}
				{#if m.role === 'user'}
					<div class="flex gap-3 items-start">
						<div class="h-8 w-8 shrink-0 rounded-full bg-[oklch(0.82_0.16_85)]/80 ring-2 ring-[oklch(0.7_0.15_85)]/60"></div>
						<div class="max-w-[80%] whitespace-pre-wrap text-sm leading-relaxed">
							<div class="rounded-md border border-[oklch(0.7_0.15_85)]/30 px-3 py-2 bg-white dark:bg-black shadow-[0_2px_12px_-4px_oklch(0.8_0.08_85/.35)]">
								{m.text}
							</div>
						</div>
					</div>
				{:else}
					<div class="max-w-none whitespace-pre-wrap text-base leading-relaxed rounded-lg border border-[oklch(0.7_0.15_85)]/30 px-4 py-3 bg-white dark:bg-black shadow-[0_6px_24px_-8px_oklch(0.8_0.08_85/.35)]">
						{m.text}
						{#if m._loading}
							<span class="inline-block ml-2 align-middle opacity-70 animate-pulse">…</span>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</section>

	<section>
		<form class="grid gap-2" on:submit|preventDefault={send}>
			<label class="text-sm text-[oklch(0.65_0.12_85)]" for="composer">Mensaje</label>
			<textarea
				id="composer"
				class="rounded-lg border border-[oklch(0.7_0.15_85)]/40 bg-white dark:bg-black/90 px-3 py-2 outline-none focus:border-[oklch(0.7_0.15_85)] focus:ring-2 focus:ring-[oklch(0.82_0.16_85/.35)] min-h-[84px]"
				bind:value={draft}
				on:keydown={onKeydown}
				placeholder="Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
			></textarea>
			<div class="flex justify-end">
				<button type="submit" class="inline-flex items-center justify-center rounded-md border border-[oklch(0.7_0.15_85)] bg-[oklch(0.82_0.16_85)]/95 text-black px-4 py-2 text-sm font-medium shadow hover:brightness-95 active:brightness-90 disabled:opacity-50 disabled:pointer-events-none" disabled={!get(userIdStore) || !draft || loading} title={!get(userIdStore) ? 'Ingresa tu nombre para enviar' : undefined}>
					{loading ? 'Enviando…' : 'Enviar'}
				</button>
			</div>
		</form>
	</section>
</div>

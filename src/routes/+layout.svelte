<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { userId } from '$lib/stores/user';
	import { get } from 'svelte/store';

	let theme = 'dark';
	let nameInput = '';
	let savedToast = '';
	let toastTimer;

	onMount(() => {
		const stored = localStorage.getItem('theme');
		if (stored === 'dark' || stored === 'light') theme = stored; else theme = 'dark';
		applyTheme();
		nameInput = get(userId) || '';
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		localStorage.setItem('theme', theme);
		applyTheme();
	}

	function applyTheme() {
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}

	function saveUserId() {
		const name = nameInput.trim().toLowerCase();
		if (!name) return;
		userId.set(name);
		showToast(`ID actualizado a “${name}”`);
	}

	function showToast(text) {
		savedToast = text;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (savedToast = ''), 1600);
	}
</script>

<div class="min-h-screen bg-white text-black dark:bg-black dark:text-white">
	<header class="sticky top-0 z-10 border-b border-[oklch(0.7_0.15_85)]/30 dark:border-[oklch(0.7_0.15_85)]/30 bg-white/80 dark:bg-black/70 backdrop-blur">
		<div class="mx-auto max-w-4xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
			<h1 class="text-lg font-semibold tracking-tight">
				<span class="bg-[oklch(0.82_0.16_85)] bg-clip-text text-transparent drop-shadow-[0_0_6px_oklch(0.88_0.12_85/.6)]">Fano Coaching</span>
			</h1>
			<div class="relative flex items-center gap-2">
				<label class="text-xs text-[oklch(0.65_0.12_85)]" for="userId">Nombre</label>
				<input id="userId" class="w-[160px] rounded-md border border-[oklch(0.7_0.15_85)]/40 bg-white dark:bg-black/90 px-2 py-1 text-sm outline-none focus:border-[oklch(0.7_0.15_85)] focus:ring-2 focus:ring-[oklch(0.82_0.16_85/.35)]" bind:value={nameInput} placeholder="ej: kris" />
				<button class="inline-flex items-center justify-center rounded-md border border-[oklch(0.7_0.15_85)] px-2 py-1 text-xs hover:bg-[oklch(0.98_0.01_90)] dark:hover:bg-[oklch(0.22_0.03_260)]" on:click={saveUserId} aria-describedby="toast-id">Usar</button>
				{#if savedToast}
					<div id="toast-id" class="absolute right-0 top-full mt-1 rounded-md border border-[oklch(0.7_0.15_85)]/40 bg-white/90 dark:bg-black/80 px-2 py-1 text-xs shadow">
						{savedToast}
					</div>
				{/if}
				<button
					class="inline-flex items-center gap-2 rounded-md border border-[oklch(0.7_0.15_85)] px-3 py-1.5 text-sm hover:bg-[oklch(0.98_0.01_90)] dark:hover:bg-[oklch(0.22_0.03_260)]"
					on:click={toggleTheme}
					aria-label="Cambiar tema"
				>
					<span class="hidden sm:inline">{theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</span>
					<span aria-hidden="true">🌓</span>
				</button>
			</div>
		</div>
	</header>
	<main class="px-4 py-6 max-w-4xl mx-auto flex flex-col h-[calc(100vh-64px)]">
		<slot />
	</main>
</div>

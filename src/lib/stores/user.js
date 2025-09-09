import { writable } from 'svelte/store';

const initial = typeof window !== 'undefined' ? (localStorage.getItem('userId') || '') : '';
export const userId = writable(initial);

if (typeof window !== 'undefined') {
	userId.subscribe((val) => {
		try {
			if (val) localStorage.setItem('userId', val);
			else localStorage.removeItem('userId');
		} catch {}
	});
}

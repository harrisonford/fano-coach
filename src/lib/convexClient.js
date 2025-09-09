import { ConvexClient } from "convex/browser";
import { PUBLIC_CONVEX_URL as STATIC_PUBLIC_CONVEX_URL } from "$env/static/public";
import { env as PUBLIC } from "$env/dynamic/public";

let client;

export function getConvexClient() {
	if (typeof window === "undefined") {
		throw new Error("Convex client can only be used in the browser");
	}
	if (!client) {
		const url = STATIC_PUBLIC_CONVEX_URL || PUBLIC?.PUBLIC_CONVEX_URL || import.meta.env.VITE_CONVEX_URL;
		if (!url) {
			throw new Error("PUBLIC_CONVEX_URL (or VITE_CONVEX_URL) is not set");
		}
		client = new ConvexClient(url);
	}
	return client;
}

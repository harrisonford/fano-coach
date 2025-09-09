import { action } from "./_generated/server";
import { v } from "convex/values";

export const fetch = action({
	args: { url: v.string() },
	handler: async (_ctx, args) => {
		const res = await fetch(args.url, { headers: { "accept": "application/json" } });
		if (!res.ok) throw new Error(`Failed to fetch pathways.json: ${res.status}`);
		const data = await res.json();
		return data;
	}
});

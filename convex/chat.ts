import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
	args: { userId: v.string(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const all = await ctx.db.query("chats").collect();
		const items = all.filter(m => m.userId === args.userId);
		items.sort((a, b) => a._creationTime - b._creationTime);
		return args.limit ? items.slice(-args.limit) : items;
	}
});

export const add = mutation({
	args: { userId: v.string(), role: v.union(v.literal("user"), v.literal("bot")), text: v.string(), pathwayId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const id = await ctx.db.insert("chats", args);
		return { id };
	}
});

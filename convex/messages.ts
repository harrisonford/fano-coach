import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("messages").collect();
	}
});

export const send = mutation({
	args: { body: v.string(), author: v.string() },
	handler: async (ctx, args) => {
		const id = await ctx.db.insert("messages", {
			body: args.body,
			author: args.author
		});
		return id;
	}
});

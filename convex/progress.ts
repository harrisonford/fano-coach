import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
	args: { userId: v.string(), pathwayId: v.string() },
	handler: async (ctx, args) => {
		const all = await ctx.db.query("progresses").collect();
		return all.find(p => p.userId === args.userId && p.pathwayId === args.pathwayId) ?? null;
	}
});

export const listByUser = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const all = await ctx.db.query("progresses").collect();
		return all.filter(p => p.userId === args.userId);
	}
});

export const start = mutation({
	args: { userId: v.string(), pathwayId: v.string() },
	handler: async (ctx, args) => {
		const all = await ctx.db.query("progresses").collect();
		const existing = all.find(p => p.userId === args.userId && p.pathwayId === args.pathwayId);
		if (existing) return { id: existing._id };
		const id = await ctx.db.insert("progresses", {
			userId: args.userId,
			pathwayId: args.pathwayId,
			currentStepIndex: 0,
			completed: false,
			responses: []
		});
		return { id };
	}
});

export const upsertAppendResponse = mutation({
	args: {
		userId: v.string(),
		pathwayId: v.string(),
		stepId: v.string(),
		answer: v.string(),
		nextStepIndex: v.optional(v.number()),
		completed: v.optional(v.boolean())
	},
	handler: async (ctx, args) => {
		const all = await ctx.db.query("progresses").collect();
		const existing = all.find(p => p.userId === args.userId && p.pathwayId === args.pathwayId);
		if (!existing) {
			const id = await ctx.db.insert("progresses", {
				userId: args.userId,
				pathwayId: args.pathwayId,
				currentStepIndex: args.nextStepIndex ?? 0,
				completed: args.completed ?? false,
				responses: [{ stepId: args.stepId, answer: args.answer }]
			});
			return { id };
		}
		const id = existing._id;
		await ctx.db.patch(id, {
			responses: [...existing.responses, { stepId: args.stepId, answer: args.answer }],
			currentStepIndex: args.nextStepIndex ?? existing.currentStepIndex,
			completed: args.completed ?? existing.completed
		});
		return { id };
	}
});

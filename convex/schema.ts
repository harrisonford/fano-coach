import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	progresses: defineTable({
		userId: v.string(),
		pathwayId: v.string(),
		currentStepIndex: v.number(),
		completed: v.boolean(),
		responses: v.array(v.object({
			stepId: v.string(),
			answer: v.string()
		}))
	}),
	chats: defineTable({
		userId: v.string(),
		role: v.union(v.literal("user"), v.literal("bot")),
		text: v.string(),
		pathwayId: v.optional(v.string())
	})
});

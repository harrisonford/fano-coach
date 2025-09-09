import { action } from "./_generated/server";
import { v } from "convex/values";

export const advance = action({
	args: {
		userId: v.string(),
		pathwaysJson: v.string(),
		answer: v.string()
	},
	visibility: "public",
	handler: async (ctx, args) => {
		const pathwaysData = JSON.parse(args.pathwaysJson || '{"pathways":[]}');
		const pathways = Array.isArray(pathwaysData.pathways) ? pathwaysData.pathways : [];

		// Pick active progress or create intro
		const list = await ctx.runQuery("progress:listByUser", { userId: args.userId });
		let active = list.find(p => !p.completed) || null;
		if (!active) {
			const intro = pathways.find((p: any) => p.pathwayId === "intro-get-to-know") || pathways[0];
			if (!intro) return { nextQuestion: "", completed: false };
			await ctx.runMutation("progress:start", { userId: args.userId, pathwayId: intro.pathwayId });
			active = { userId: args.userId, pathwayId: intro.pathwayId, currentStepIndex: 0, completed: false, responses: [] } as any;
		}

		const pathway = pathways.find((p: any) => p.pathwayId === active!.pathwayId);
		if (!pathway) return { nextQuestion: "", completed: false };
		const steps = Array.isArray(pathway.steps) ? pathway.steps : [];
		const idx = Math.min(Math.max(active!.currentStepIndex || 0, 0), Math.max(steps.length - 1, 0));
		if (steps.length === 0) return { nextQuestion: "", completed: true };

		const step = steps[idx];
		const nextIdx = idx + 1;
		const completed = nextIdx >= steps.length;

		await ctx.runMutation("progress:upsertAppendResponse", {
			userId: args.userId,
			pathwayId: active!.pathwayId,
			stepId: step.id,
			answer: args.answer,
			nextStepIndex: completed ? idx : nextIdx,
			completed
		});

		const nextQuestion = completed ? "" : steps[nextIdx].question;
		return { nextQuestion, completed, pathwayId: active!.pathwayId };
	}
});

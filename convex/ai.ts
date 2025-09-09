import { action } from "./_generated/server";
import { v } from "convex/values";

// Minimal Chat Completions + tool calling loop using fetch to avoid SDK deps
export const chatWithTools = action({
	args: {
		userId: v.string(),
		origin: v.string(),
		messages: v.array(
			v.object({ role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")), content: v.string() })
		),
		pathwaysJson: v.optional(v.string())
	},
	visibility: "public",
	handler: async (ctx, args) => {
		const apiKey = process.env.OPENAI_API_KEY;
		const model = process.env.OPENAI_MODEL || "gpt-5-mini";
		const org = process.env.OPENAI_ORG;
		if (!apiKey) throw new Error("OPENAI_API_KEY es requerido");

		const tools = [
			{ type: "function", function: { name: "list_pathways", description: "Lista rutas de coaching disponibles (provistas por el cliente)", parameters: { type: "object", properties: {}, additionalProperties: false } } },
			{ type: "function", function: { name: "get_progress", description: "Obtiene progreso de usuario para una ruta", parameters: { type: "object", properties: { userId: { type: "string" }, pathwayId: { type: "string" } }, required: ["userId", "pathwayId"], additionalProperties: false } } },
			{ type: "function", function: { name: "list_user_progress", description: "Lista todas las rutas con progreso de un usuario", parameters: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"], additionalProperties: false } } },
			{ type: "function", function: { name: "start_progress", description: "Crea progreso inicial para una ruta (si no existe)", parameters: { type: "object", properties: { userId: { type: "string" }, pathwayId: { type: "string" } }, required: ["userId", "pathwayId"], additionalProperties: false } } },
			{ type: "function", function: { name: "upsert_progress", description: "Guarda respuesta del usuario y avanza pasos", parameters: { type: "object", properties: { userId: { type: "string" }, pathwayId: { type: "string" }, stepId: { type: "string" }, answer: { type: "string" }, nextStepIndex: { type: ["integer", "null"] }, completed: { type: ["boolean", "null"] } }, required: ["userId", "pathwayId", "stepId", "answer"], additionalProperties: false } } },
			{ type: "function", function: { name: "chat_add", description: "Agrega mensaje a historial del chat", parameters: { type: "object", properties: { userId: { type: "string" }, role: { type: "string", enum: ["user", "bot"] }, text: { type: "string" }, pathwayId: { type: ["string", "null"] } }, required: ["userId", "role", "text"], additionalProperties: false } } }
		];

		let chatMessages: any[] = args.messages.map(m => ({ role: m.role, content: m.content }));
		console.log("[ai] start", { model, userId: args.userId, msgs: chatMessages.length });

		const pathwaysData = (() => {
			try { return args.pathwaysJson ? JSON.parse(args.pathwaysJson) : { pathways: [] }; } catch { return { pathways: [] }; }
		})();

		function extractText(msg: any): string {
			if (!msg) return "";
			const c = msg.content;
			if (typeof c === "string") return c;
			if (Array.isArray(c)) return c.map((p: any) => p?.text || p?.content || "").join("");
			return "";
		}

		async function postToOpenAI(body: any) {
			let lastErr: any;
			for (let attempt = 0; attempt < 3; attempt++) {
				const headers: Record<string, string> = {
					"content-type": "application/json",
					"authorization": `Bearer ${apiKey}`
				};
				if (org) headers["OpenAI-Organization"] = org;
				console.log("[ai] POST", { attempt: attempt + 1, hasOrg: !!org });
				const resp = await fetch("https://api.openai.com/v1/chat/completions", {
					method: "POST",
					headers,
					body: JSON.stringify(body)
				});
				console.log("[ai] status", resp.status);
				if (resp.status === 429) {
					const ra = resp.headers.get("retry-after");
					const delayMs = ra ? parseInt(ra, 10) * 1000 : 500 * Math.pow(2, attempt);
					console.log("[ai] rate_limited", { attempt: attempt + 1, delayMs });
					await new Promise(r => setTimeout(r, isNaN(delayMs) ? 800 : delayMs));
					lastErr = new Error(`OpenAI rate limited (429)`);
					continue;
				}
				if (!resp.ok) {
					const txt = await resp.text();
					console.log("[ai] error_body", txt.slice(0, 500));
					throw new Error(`OpenAI error ${resp.status}: ${txt}`);
				}
				const json = await resp.json();
				console.log("[ai] ok");
				return json;
			}
			throw lastErr ?? new Error("OpenAI request failed");
		}

		let maxTokens = 768;
		for (let i = 0; i < 4; i++) {
			const data: any = await postToOpenAI({
				model,
				messages: chatMessages,
				tools,
				tool_choice: "auto",
				response_format: { type: "text" },
				max_completion_tokens: maxTokens
			});
			const choice = data.choices?.[0];
			if (!choice) throw new Error("No choices returned");
			const contentText = extractText(choice.message);
			console.log("[ai] choice", { finish: choice.finish_reason, hasTools: !!choice.message?.tool_calls?.length, contentLen: contentText.length });

			if (choice.finish_reason === "tool_calls" && choice.message?.tool_calls?.length) {
				chatMessages.push({ role: "assistant", content: contentText, tool_calls: choice.message.tool_calls });
				let onlyProgress = true;
				let allProgressNull = true;
				for (const call of choice.message.tool_calls) {
					const name = call.function.name;
					const argsObj = JSON.parse(call.function.arguments || "{}");
					console.log("[ai] tool_call", { name, keys: Object.keys(argsObj || {}) });
					let result: any;
					if (name === "list_pathways") {
						onlyProgress = false;
						result = pathwaysData;
					} else if (name === "get_progress") {
						result = await ctx.runQuery("progress:get", { userId: argsObj.userId, pathwayId: argsObj.pathwayId });
						if (result) allProgressNull = false;
					} else if (name === "list_user_progress") {
						onlyProgress = false;
						result = await ctx.runQuery("progress:listByUser", { userId: argsObj.userId });
					} else if (name === "start_progress") {
						onlyProgress = false;
						result = await ctx.runMutation("progress:start", { userId: argsObj.userId, pathwayId: argsObj.pathwayId });
					} else if (name === "upsert_progress") {
						onlyProgress = false;
						result = await ctx.runMutation("progress:upsertAppendResponse", { userId: argsObj.userId, pathwayId: argsObj.pathwayId, stepId: argsObj.stepId, answer: argsObj.answer, nextStepIndex: argsObj.nextStepIndex ?? undefined, completed: argsObj.completed ?? undefined });
					} else if (name === "chat_add") {
						onlyProgress = false;
						result = await ctx.runMutation("chat:add", { userId: argsObj.userId, role: argsObj.role, text: argsObj.text, pathwayId: argsObj.pathwayId ?? undefined });
					} else {
						result = { error: `Unknown tool ${name}` };
					}
					const summary = result == null ? 'null' : Array.isArray(result) ? `array(${result.length})` : typeof result === 'object' ? Object.keys(result) : String(result).slice(0, 80);
					console.log("[ai] tool_result", { name, summary });
					chatMessages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(result) });
				}

				if (onlyProgress && allProgressNull) {
					const pts = (pathwaysData.pathways || []).map((p: any) => `- ${p.title} (id: ${p.pathwayId})`).join("\n");
					const reply = `No veo progreso previo para \"${args.userId}\". Elige una ruta para empezar:\n${pts}\n\nEscribe: \"empezar {id}\" (p. ej., empezar stress-checkin). Si prefieres, di \"recomiéndame\".`;
					console.log("[ai] synth_reply");
					return { content: reply };
				}

				continue;
			}

			if (choice.finish_reason === "length" && !contentText.trim()) {
				maxTokens = Math.min(maxTokens * 2, 2048);
				console.log("[ai] retry length", { maxTokens });
				continue;
			}

			console.log("[ai] assistant", contentText.slice(0, 160));
			if (!contentText.trim()) throw new Error("Modelo no entregó contenido");
			return { content: contentText };
		}

		throw new Error("Sin respuesta del modelo tras múltiples rondas");
	}
});

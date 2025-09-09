# Fano Coaching – LLM Tools Spec (PoC)

All functions are in Convex. User identity is a simple lowercase first name (e.g., "kris").

## Tools

- pathways:fetch(url)
  - type: action
  - args: { url: string }
  - returns: { pathways: Array<Pathway> }

- progress:get(userId, pathwayId)
  - type: query
  - returns: Progress | null

- progress:upsertAppendResponse(userId, pathwayId, stepId, answer, nextStepIndex?, completed?)
  - type: mutation
  - returns: { id }

- chat:list(userId, limit?)
  - type: query
  - returns: ChatMessage[] (ascending by time)

- chat:add(userId, role, text, pathwayId?)
  - type: mutation
  - returns: { id }

## Types

- Pathway { pathwayId: string; title: string; description: string; steps: Step[]; endCondition: string }
- Step { id: string; question: string; forwardCondition: "answer_provided" | "number_1_10" }
- Progress { userId: string; pathwayId: string; currentStepIndex: number; completed: boolean; responses: Array<{ stepId: string; answer: string }> }
- ChatMessage { userId: string; role: "user" | "bot"; text: string; pathwayId?: string }

## Orchestration Hints

1) Identify or ask user name → `userId`.
2) Load pathways: `pathways:fetch("/pathways.json")`.
3) Suggest a pathway not completed or continue a pending one via `progress:get`.
4) For each user answer: call `progress:upsertAppendResponse` with nextStepIndex or completed.
5) Write messages to history via `chat:add`.

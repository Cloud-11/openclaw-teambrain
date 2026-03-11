import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { NeigeConfig } from "./config.ts";
import {
  runNeigeMainAction,
  type NeigeMainIntakeInput,
  type NeigeMainSessionInput,
  type NeigeMainTaskLinksInput,
} from "./main-runtime.ts";
import type { NeigeReliabilityInput } from "./reliability.ts";
import type { NeigeTriageSignals } from "./triage.ts";

function toolResult(text: string, details: unknown) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function requireAction(params: Record<string, unknown>): "intake" | "portfolio" | "task-links" {
  const action = params.action;
  if (action !== "intake" && action !== "portfolio" && action !== "task-links") {
    throw new Error("action required");
  }

  return action;
}

function readString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readStringArray(params: Record<string, unknown>, key: string): string[] | undefined {
  const value = params[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function readNumber(params: Record<string, unknown>, key: string): number | undefined {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function readSignals(params: Record<string, unknown>): NeigeTriageSignals {
  const signals = readRecord(params.signals) ?? {};
  return {
    isSimpleQuestion: signals.isSimpleQuestion === true,
    hasExplicitDeliverable: signals.hasExplicitDeliverable === true,
    shouldRetainRecord: signals.shouldRetainRecord === true,
    requiresTracking: signals.requiresTracking === true,
    requiresSpecialistRole: signals.requiresSpecialistRole === true,
    preferredRole: readString(signals, "preferredRole"),
    activeProjectId: readString(signals, "activeProjectId"),
    isNewProject: signals.isNewProject === true,
    affectsTeamRules: signals.affectsTeamRules === true,
    affectsKnowledgeAssets: signals.affectsKnowledgeAssets === true,
  };
}

function readSession(params: Record<string, unknown>): NeigeMainSessionInput | undefined {
  const session = readRecord(params.session);
  if (!session) {
    return undefined;
  }

  const sessionKey = readString(session, "sessionKey");
  const agentId = readString(session, "agentId");
  const roleId = readString(session, "roleId");
  const purpose = readString(session, "purpose");
  const kind = session.kind;

  if (
    !sessionKey ||
    !agentId ||
    !roleId ||
    !purpose ||
    (kind !== "main-session" &&
      kind !== "task-session" &&
      kind !== "subagent-session" &&
      kind !== "handoff-session" &&
      kind !== "adhoc-session")
  ) {
    throw new Error("invalid session");
  }

  return {
    sessionKey,
    agentId,
    roleId,
    purpose,
    kind,
    createdAt: readString(session, "createdAt"),
    endedAt: typeof session.endedAt === "string" ? session.endedAt : null,
  };
}

function readReliability(params: Record<string, unknown>): NeigeReliabilityInput | undefined {
  const reliability = readRecord(params.reliability);
  if (!reliability) {
    return undefined;
  }

  const result: NeigeReliabilityInput = {
    breakerOpen: reliability.breakerOpen === true,
    retryCount: readNumber(reliability, "retryCount"),
    retryBudget: readNumber(reliability, "retryBudget"),
    handoffDepth: readNumber(reliability, "handoffDepth"),
    maxHandoffDepth: readNumber(reliability, "maxHandoffDepth"),
    activeChildren: readNumber(reliability, "activeChildren"),
    maxActiveChildren: readNumber(reliability, "maxActiveChildren"),
    elapsedMs: readNumber(reliability, "elapsedMs"),
    timeoutMs: readNumber(reliability, "timeoutMs"),
  };

  return Object.values(result).some((value) => value !== undefined) ? result : undefined;
}

export function createNeigeMainTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-main",
    label: "Neige Main",
    description: "最小总管入口：执行 intake/triage/projectize，并可刷新 portfolio 汇报。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: ["intake", "portfolio", "task-links"],
        },
        projectId: {
          type: "string",
        },
        taskId: {
          type: "string",
        },
        request: {
          type: "string",
        },
        taskOwner: {
          type: "string",
        },
        definitionOfDone: {
          type: "array",
          items: {
            type: "string",
          },
        },
        constraints: {
          type: "array",
          items: {
            type: "string",
          },
        },
        risks: {
          type: "array",
          items: {
            type: "string",
          },
        },
        nextAction: {
          type: "string",
        },
        signals: {
          type: "object",
          additionalProperties: false,
          properties: {
            isSimpleQuestion: { type: "boolean" },
            hasExplicitDeliverable: { type: "boolean" },
            shouldRetainRecord: { type: "boolean" },
            requiresTracking: { type: "boolean" },
            requiresSpecialistRole: { type: "boolean" },
            preferredRole: { type: "string" },
            activeProjectId: { type: "string" },
            isNewProject: { type: "boolean" },
            affectsTeamRules: { type: "boolean" },
            affectsKnowledgeAssets: { type: "boolean" },
          },
        },
        reliability: {
          type: "object",
          additionalProperties: false,
          properties: {
            breakerOpen: { type: "boolean" },
            retryCount: { type: "number" },
            retryBudget: { type: "number" },
            handoffDepth: { type: "number" },
            maxHandoffDepth: { type: "number" },
            activeChildren: { type: "number" },
            maxActiveChildren: { type: "number" },
            elapsedMs: { type: "number" },
            timeoutMs: { type: "number" },
          },
        },
        session: {
          type: "object",
          additionalProperties: false,
          properties: {
            sessionKey: { type: "string" },
            agentId: { type: "string" },
            roleId: { type: "string" },
            kind: {
              type: "string",
              enum: [
                "main-session",
                "task-session",
                "subagent-session",
                "handoff-session",
                "adhoc-session",
              ],
            },
            purpose: { type: "string" },
            createdAt: { type: "string" },
            endedAt: { type: "string" },
          },
          required: ["sessionKey", "agentId", "roleId", "kind", "purpose"],
        },
      },
      required: ["action"],
    },
    async execute(_id, rawParams) {
      const params = rawParams as Record<string, unknown>;
      const action = requireAction(params);

      const result =
        action === "portfolio"
          ? await runNeigeMainAction(config, {
              action: "portfolio",
            })
          : action === "task-links"
            ? await runNeigeMainAction(config, {
                action: "task-links",
                projectId: readString(params, "projectId"),
                taskId: readString(params, "taskId") ?? "",
              } satisfies NeigeMainTaskLinksInput)
          : await runNeigeMainAction(config, {
              action: "intake",
              request: readString(params, "request") ?? "",
              signals: readSignals(params),
              reliability: readReliability(params),
              taskOwner: readString(params, "taskOwner"),
              definitionOfDone: readStringArray(params, "definitionOfDone"),
              constraints: readStringArray(params, "constraints"),
              risks: readStringArray(params, "risks"),
              nextAction: readString(params, "nextAction"),
              session: readSession(params),
            });

      return toolResult(result.summary, result);
    },
  };
}

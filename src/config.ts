import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

export type TeamBrainLayers = {
  includeTeamCharter: boolean;
  includeGlobalRules: boolean;
  includeProfiles: boolean;
  includeProjectState: boolean;
  includeTodo: boolean;
  includePrivateWorkspace: boolean;
};

export type TeamBrainPromptBudget = {
  maxCharsPerSection: number;
  maxTotalChars: number;
  maxWorkspaceFiles: number;
  maxWorkspaceFileChars: number;
};

export type TeamBrainAgentMappings = {
  profiles: Record<string, string>;
  workspaces: Record<string, string>;
};

export type TeamBrainConfig = {
  brainRoot: string;
  teamId: string;
  projectId: string;
  layers: TeamBrainLayers;
  promptBudget: TeamBrainPromptBudget;
  agentMappings: TeamBrainAgentMappings;
};

type ResolvePath = (input: string) => string;

const DEFAULT_LAYERS: TeamBrainLayers = {
  includeTeamCharter: true,
  includeGlobalRules: true,
  includeProfiles: true,
  includeProjectState: true,
  includeTodo: true,
  includePrivateWorkspace: false,
};

const DEFAULT_PROMPT_BUDGET: TeamBrainPromptBudget = {
  maxCharsPerSection: 3000,
  maxTotalChars: 12000,
  maxWorkspaceFiles: 3,
  maxWorkspaceFileChars: 1200,
};

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`TeamBrain 配置缺少有效的 ${fieldName}`);
  }

  return value.trim();
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return typeof record[key] === "boolean" ? (record[key] as boolean) : fallback;
}

function readNumber(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStringMap(value: unknown): Record<string, string> {
  const record = toRecord(value);
  const result: Record<string, string> = {};

  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string" && entry.trim() !== "") {
      result[key] = entry.trim();
    }
  }

  return result;
}

function normalizePathForConfig(value: string, resolvePath?: ResolvePath): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("~")) {
    return `${homedir()}${trimmed.slice(1)}`.replace(/\\/g, "/");
  }

  if (isAbsolute(trimmed)) {
    return trimmed.replace(/\\/g, "/");
  }

  if (resolvePath) {
    return resolvePath(trimmed).replace(/\\/g, "/");
  }

  return resolve(trimmed).replace(/\\/g, "/");
}

export function normalizeTeamBrainConfig(
  raw: unknown,
  resolvePath?: ResolvePath,
): TeamBrainConfig {
  const record = toRecord(raw);
  const layerRecord = toRecord(record.layers);
  const budgetRecord = toRecord(record.promptBudget);
  const mappingRecord = toRecord(record.agentMappings);

  return {
    brainRoot: normalizePathForConfig(requireNonEmptyString(record.brainRoot, "brainRoot"), resolvePath),
    teamId: requireNonEmptyString(record.teamId, "teamId"),
    projectId: requireNonEmptyString(record.projectId, "projectId"),
    layers: {
      includeTeamCharter: readBoolean(
        layerRecord,
        "includeTeamCharter",
        DEFAULT_LAYERS.includeTeamCharter,
      ),
      includeGlobalRules: readBoolean(
        layerRecord,
        "includeGlobalRules",
        DEFAULT_LAYERS.includeGlobalRules,
      ),
      includeProfiles: readBoolean(layerRecord, "includeProfiles", DEFAULT_LAYERS.includeProfiles),
      includeProjectState: readBoolean(
        layerRecord,
        "includeProjectState",
        DEFAULT_LAYERS.includeProjectState,
      ),
      includeTodo: readBoolean(layerRecord, "includeTodo", DEFAULT_LAYERS.includeTodo),
      includePrivateWorkspace: readBoolean(
        layerRecord,
        "includePrivateWorkspace",
        DEFAULT_LAYERS.includePrivateWorkspace,
      ),
    },
    promptBudget: {
      maxCharsPerSection: readNumber(
        budgetRecord,
        "maxCharsPerSection",
        DEFAULT_PROMPT_BUDGET.maxCharsPerSection,
      ),
      maxTotalChars: readNumber(
        budgetRecord,
        "maxTotalChars",
        DEFAULT_PROMPT_BUDGET.maxTotalChars,
      ),
      maxWorkspaceFiles: readNumber(
        budgetRecord,
        "maxWorkspaceFiles",
        DEFAULT_PROMPT_BUDGET.maxWorkspaceFiles,
      ),
      maxWorkspaceFileChars: readNumber(
        budgetRecord,
        "maxWorkspaceFileChars",
        DEFAULT_PROMPT_BUDGET.maxWorkspaceFileChars,
      ),
    },
    agentMappings: {
      profiles: readStringMap(mappingRecord.profiles),
      workspaces: readStringMap(mappingRecord.workspaces),
    },
  };
}

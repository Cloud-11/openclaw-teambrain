import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

export type NeigeLayers = {
  includeTeamCharter: boolean;
  includeGlobalRules: boolean;
  includeProfiles: boolean;
  includeProjectState: boolean;
  includeTodo: boolean;
  includePrivateWorkspace: boolean;
};

export type NeigePromptBudget = {
  maxCharsPerSection: number;
  maxTotalChars: number;
  maxWorkspaceFiles: number;
  maxWorkspaceFileChars: number;
};

export type NeigeRolePolicy = {
  label?: string;
  writebackGuidance: string[];
  allowedTools?: string[];
  deniedTools?: string[];
};

export type NeigeAgentMappings = {
  profiles: Record<string, string>;
  workspaces: Record<string, string>;
  roles: Record<string, string>;
};

export type NeigeConfig = {
  brainRoot: string;
  teamId: string;
  projectId: string;
  layers: NeigeLayers;
  promptBudget: NeigePromptBudget;
  agentMappings: NeigeAgentMappings;
  rolePolicies: Record<string, NeigeRolePolicy>;
};

type ResolvePath = (input: string) => string;

const DEFAULT_LAYERS: NeigeLayers = {
  includeTeamCharter: true,
  includeGlobalRules: true,
  includeProfiles: true,
  includeProjectState: true,
  includeTodo: true,
  includePrivateWorkspace: false,
};

const DEFAULT_PROMPT_BUDGET: NeigePromptBudget = {
  maxCharsPerSection: 3000,
  maxTotalChars: 12000,
  maxWorkspaceFiles: 3,
  maxWorkspaceFileChars: 1200,
};

const DEFAULT_ROLE_POLICIES: Record<string, NeigeRolePolicy> = {
  main: {
    label: "Main",
    writebackGuidance: [
      "Main 负责汇总项目阶段、任务分派和最近更新。",
      "Main 在任务重排或阶段切换后，优先统一更新 PROJECT_STATE.md。",
    ],
  },
  coder: {
    label: "Coder",
    writebackGuidance: [
      "Coder 在实现完成、阻塞变化或接手新任务时，同步活跃任务和 TODO。",
      "Coder 不把长篇调试过程写入共享白板，只写结果与下一步。",
    ],
  },
  writer: {
    label: "Writer",
    writebackGuidance: [
      "Writer 在文档完成或需求变更后，同步相关 TODO 状态和简短摘要。",
    ],
  },
  qa: {
    label: "QA",
    writebackGuidance: [
      "QA 在验证通过、复现失败或发现阻塞时，同步测试结论和风险摘要。",
    ],
  },
};

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Neige 配置缺少有效的 ${fieldName}`);
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

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readRolePolicies(value: unknown): Record<string, NeigeRolePolicy> {
  const record = toRecord(value);
  const result: Record<string, NeigeRolePolicy> = {};

  for (const [roleId, rawPolicy] of Object.entries(record)) {
    const policyRecord = toRecord(rawPolicy);
    const label =
      typeof policyRecord.label === "string" && policyRecord.label.trim() !== ""
        ? policyRecord.label.trim()
        : undefined;
    const writebackGuidance = readStringArray(policyRecord.writebackGuidance);

    if (!label && writebackGuidance.length === 0) {
      continue;
    }

    result[roleId] = {
      label,
      writebackGuidance,
      allowedTools: readStringArray(policyRecord.allowedTools),
      deniedTools: readStringArray(policyRecord.deniedTools),
    };
  }

  return result;
}

function mergeRolePolicies(
  defaults: Record<string, NeigeRolePolicy>,
  overrides: Record<string, NeigeRolePolicy>,
): Record<string, NeigeRolePolicy> {
  const result: Record<string, NeigeRolePolicy> = {};

  for (const [roleId, policy] of Object.entries(defaults)) {
    result[roleId] = {
      label: policy.label,
      writebackGuidance: [...policy.writebackGuidance],
    };
  }

  for (const [roleId, policy] of Object.entries(overrides)) {
    const existing = result[roleId];
    result[roleId] = {
      label: policy.label ?? existing?.label ?? roleId,
      writebackGuidance:
        policy.writebackGuidance.length > 0
          ? [...policy.writebackGuidance]
          : [...(existing?.writebackGuidance ?? [])],
      allowedTools:
        (policy.allowedTools?.length ?? 0) > 0
          ? [...(policy.allowedTools ?? [])]
          : [...(existing?.allowedTools ?? [])],
      deniedTools:
        (policy.deniedTools?.length ?? 0) > 0
          ? [...(policy.deniedTools ?? [])]
          : [...(existing?.deniedTools ?? [])],
    };
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

export function normalizeNeigeConfig(
  raw: unknown,
  resolvePath?: ResolvePath,
): NeigeConfig {
  const record = toRecord(raw);
  const layerRecord = toRecord(record.layers);
  const budgetRecord = toRecord(record.promptBudget);
  const mappingRecord = toRecord(record.agentMappings);
  const rolePolicies = mergeRolePolicies(
    DEFAULT_ROLE_POLICIES,
    readRolePolicies(record.rolePolicies),
  );

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
      roles: readStringMap(mappingRecord.roles),
    },
    rolePolicies,
  };
}


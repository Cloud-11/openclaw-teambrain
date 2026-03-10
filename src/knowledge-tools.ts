import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { NeigeConfig } from "./config.ts";
import { readOptionalUtf8 } from "./files.ts";
import { buildAgentPromptAddition } from "./hooks.ts";

type CandidateStatus = "draft" | "reviewing" | "promoted" | "rejected" | "archived";

function toolResult(text: string, details: unknown) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function requireString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} required`);
  }

  return value.trim();
}

function readStringArray(params: Record<string, unknown>, key: string): string[] {
  const value = params[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildId(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function candidateDir(config: NeigeConfig, projectId: string): string {
  return join(config.brainRoot, config.teamId, "projects", projectId, "state", "knowledge_candidates");
}

function candidatePath(config: NeigeConfig, projectId: string, candidateId: string): string {
  return join(candidateDir(config, projectId), `${candidateId}.json`);
}

function skillsDir(config: NeigeConfig): string {
  return join(config.brainRoot, config.teamId, "memory_global", "skills");
}

function skillPath(config: NeigeConfig, skillId: string): string {
  return join(skillsDir(config), `${skillId}.json`);
}

function skillRegistryPath(config: NeigeConfig): string {
  return join(skillsDir(config), "skill-registry.json");
}

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
}

export function createNeigeCandidateTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-candidate",
    label: "Neige Candidate",
    description: "创建或更新 Knowledge Candidate。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["create", "set_status"] },
        projectId: { type: "string" },
        candidateId: { type: "string" },
        agentId: { type: "string" },
        roleId: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        candidateType: { type: "string" },
        signal: { type: "number" },
        status: { type: "string" },
      },
      required: ["action", "projectId"],
    },
    async execute(_id, params) {
      const action = requireString(params, "action");
      const projectId = requireString(params, "projectId");

      if (action === "create") {
        const candidateId = buildId("KC");
        const filePath = candidatePath(config, projectId, candidateId);
        await ensureParent(filePath);
        await writeFile(
          filePath,
          JSON.stringify(
            {
              id: candidateId,
              projectId,
              agentId: requireString(params, "agentId"),
              roleId: requireString(params, "roleId"),
              title: requireString(params, "title"),
              summary: requireString(params, "summary"),
              candidateType: requireString(params, "candidateType"),
              signal: Number(params.signal ?? 1),
              status: "draft",
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
            null,
            2,
          ),
          "utf8",
        );

        return toolResult(`已创建 ${filePath}`, {
          candidateId,
          filePath,
        });
      }

      const candidateId = requireString(params, "candidateId");
      const filePath = candidatePath(config, projectId, candidateId);
      const existingRaw = await readOptionalUtf8(filePath);
      if (!existingRaw) {
        throw new Error(`candidate not found: ${candidateId}`);
      }

      const existing = JSON.parse(existingRaw) as Record<string, unknown>;
      const status = requireString(params, "status") as CandidateStatus;
      existing.status = status;
      existing.updatedAt = nowIso();
      await writeFile(filePath, JSON.stringify(existing, null, 2), "utf8");

      return toolResult(`已更新 ${filePath}`, {
        candidateId,
        filePath,
        status,
      });
    },
  };
}

export function createNeigeSkillTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-skill",
    label: "Neige Skill",
    description: "从 Candidate 提升为 Skill 并更新 Skill Registry。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["promote_candidate"] },
        candidateId: { type: "string" },
        skillName: { type: "string" },
        skillTitle: { type: "string" },
      },
      required: ["action", "candidateId", "skillName", "skillTitle"],
    },
    async execute(_id, params) {
      const candidateId = requireString(params, "candidateId");
      const skillName = requireString(params, "skillName");
      const skillTitle = requireString(params, "skillTitle");

      const projectId = config.projectId;
      const sourcePath = candidatePath(config, projectId, candidateId);
      const raw = await readOptionalUtf8(sourcePath);
      if (!raw) {
        throw new Error(`candidate not found: ${candidateId}`);
      }

      const candidate = JSON.parse(raw) as Record<string, unknown>;
      const skillId = buildId("SK");
      const outputPath = skillPath(config, skillId);
      const registryPath = skillRegistryPath(config);

      await ensureParent(outputPath);
      await writeFile(
        outputPath,
        JSON.stringify(
          {
            id: skillId,
            name: skillName,
            title: skillTitle,
            type: candidate.candidateType ?? "workflow-skill",
            owner: "neige",
            visibility: "team",
            description: candidate.summary ?? "",
            sourceCandidates: [candidateId],
            updatedAt: nowIso(),
          },
          null,
          2,
        ),
        "utf8",
      );

      const registryRaw = await readOptionalUtf8(registryPath);
      const registry = registryRaw
        ? (JSON.parse(registryRaw) as { entries: Array<Record<string, unknown>> })
        : { entries: [] as Array<Record<string, unknown>> };
      registry.entries.push({
        id: skillId,
        name: skillName,
        title: skillTitle,
        updatedAt: nowIso(),
      });
      await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf8");

      candidate.status = "promoted";
      candidate.updatedAt = nowIso();
      await writeFile(sourcePath, JSON.stringify(candidate, null, 2), "utf8");

      return toolResult(`已提升 ${candidateId} -> ${skillId}`, {
        skillId,
        outputPath,
      });
    },
  };
}

export function createNeigeHookPreviewTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-hook-preview",
    label: "Neige Hook Preview",
    description: "预览当前角色将收到的 hook 注入内容。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["preview"] },
        agentId: { type: "string" },
      },
      required: ["action", "agentId"],
    },
    async execute(_id, params) {
      const agentId = requireString(params, "agentId");
      const content = await buildAgentPromptAddition({
        config,
        agentId,
      });

      return toolResult(content ?? "", {
        agentId,
      });
    },
  };
}

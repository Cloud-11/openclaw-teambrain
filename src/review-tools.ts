import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { NeigeConfig } from "./config.ts";

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

function reviewPath(config: NeigeConfig, projectId: string, reviewId: string): string {
  return join(config.brainRoot, config.teamId, "projects", projectId, "state", "reviews", `${reviewId}.md`);
}

function renderReview(params: {
  reviewId: string;
  taskId: string;
  projectId: string;
  maker: string;
  checker: string;
  verdict: string;
  resultSummary: string[];
  findings: string[];
}): string {
  return [
    `# Review: ${params.reviewId}`,
    "",
    "## 基本信息",
    `- Task: ${params.taskId}`,
    `- Project: ${params.projectId}`,
    `- Maker: ${params.maker}`,
    `- Checker: ${params.checker}`,
    `- Verdict: ${params.verdict}`,
    "",
    "## 结果摘要",
    ...params.resultSummary.map((item) => `- ${item}`),
    "",
    "## Findings",
    ...params.findings.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export function createNeigeReviewTool(config: NeigeConfig): PluginTool {
  return {
    name: "neige-review",
    label: "Neige Review",
    description: "创建 Maker-Checker 审核结果文件。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["create"] },
        projectId: { type: "string" },
        taskId: { type: "string" },
        maker: { type: "string" },
        checker: { type: "string" },
        verdict: { type: "string" },
        resultSummary: { type: "array", items: { type: "string" } },
        findings: { type: "array", items: { type: "string" } },
      },
      required: [
        "action",
        "projectId",
        "taskId",
        "maker",
        "checker",
        "verdict",
        "resultSummary",
        "findings",
      ],
    },
    async execute(_id, params) {
      const projectId = requireString(params, "projectId");
      const taskId = requireString(params, "taskId");
      const maker = requireString(params, "maker");
      const checker = requireString(params, "checker");
      const verdict = requireString(params, "verdict");
      const resultSummary = readStringArray(params, "resultSummary");
      const findings = readStringArray(params, "findings");
      const reviewId = buildId("RV");
      const filePath = reviewPath(config, projectId, reviewId);

      await mkdir(join(filePath, ".."), { recursive: true });
      await writeFile(
        filePath,
        renderReview({
          reviewId,
          taskId,
          projectId,
          maker,
          checker,
          verdict,
          resultSummary,
          findings,
        }),
        "utf8",
      );

      return toolResult(`已创建 ${filePath}`, {
        reviewId,
        filePath,
        verdict,
      });
    },
  };
}

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginTool } from "openclaw/plugin-sdk/core";
import type { NeigeConfig } from "./config.ts";
import { DirectoryLockTimeoutError, type LockOptions, withDirectoryLock } from "./file-lock.ts";
import { readOptionalUtf8 } from "./files.ts";

type ProjectStateSnapshot = {
  stage?: string;
  activeTasks: string[];
  summary?: string;
};

type TodoItem = {
  text: string;
  done: boolean;
};

type WritebackAction = "set_project_state" | "upsert_todo" | "remove_todo";

function getStateDir(config: NeigeConfig): string {
  return join(config.brainRoot, config.teamId, "projects", config.projectId, "state");
}

function getProjectStatePath(config: NeigeConfig): string {
  return join(getStateDir(config), "PROJECT_STATE.md");
}

function getTodoPath(config: NeigeConfig): string {
  return join(getStateDir(config), "TODO.md");
}

function getLockDir(config: NeigeConfig): string {
  return join(getStateDir(config), ".neige.lock");
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

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function requireAction(params: Record<string, unknown>): WritebackAction {
  const value = readString(params, "action");
  if (
    value === "set_project_state" ||
    value === "upsert_todo" ||
    value === "remove_todo"
  ) {
    return value;
  }

  throw new Error("action 必须是 set_project_state / upsert_todo / remove_todo");
}

function requireText(params: Record<string, unknown>, key: string): string {
  const value = readString(params, key);
  if (!value) {
    throw new Error(`${key} required`);
  }

  return value;
}

function extractSection(markdown: string, heading: string): string | undefined {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "m"));
  return match?.[1]?.trim();
}

function parseProjectState(markdown?: string): ProjectStateSnapshot {
  if (!markdown) {
    return { activeTasks: [] };
  }

  const stage = extractSection(markdown, "当前阶段");
  const activeTasksRaw = extractSection(markdown, "活跃任务");
  const summary = extractSection(markdown, "最近更新");

  return {
    stage,
    activeTasks:
      activeTasksRaw
        ?.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim())
        .filter(Boolean) ?? [],
    summary,
  };
}

function renderProjectState(config: NeigeConfig, snapshot: ProjectStateSnapshot): string {
  const activeTasks =
    snapshot.activeTasks.length > 0
      ? snapshot.activeTasks.map((task) => `- ${task}`).join("\n")
      : "- 暂无";

  return [
    `# 项目状态：${config.projectId}`,
    "",
    "## 当前阶段",
    snapshot.stage ?? "未设置",
    "",
    "## 活跃任务",
    activeTasks,
    "",
    "## 最近更新",
    snapshot.summary ?? "暂无",
    "",
  ].join("\n");
}

function parseTodo(markdown?: string): TodoItem[] {
  if (!markdown) {
    return [];
  }

  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^- \[( |x)\] /.test(line))
    .map((line) => ({
      done: line.startsWith("- [x] "),
      text: line.replace(/^- \[(?: |x)\] /, "").trim(),
    }))
    .filter((item) => item.text !== "");
}

function renderTodo(items: TodoItem[]): string {
  const body =
    items.length > 0
      ? items.map((item) => `- [${item.done ? "x" : " "}] ${item.text}`).join("\n")
      : "";

  return ["# TODO", "", body, ""].join("\n");
}

async function ensureStateDir(config: NeigeConfig): Promise<void> {
  await mkdir(getStateDir(config), { recursive: true });
}

async function writeProjectState(
  config: NeigeConfig,
  params: Record<string, unknown>,
): Promise<{ filePath: string; snapshot: ProjectStateSnapshot }> {
  const filePath = getProjectStatePath(config);
  const existing = parseProjectState(await readOptionalUtf8(filePath));
  const activeTasksParam = readStringArray(params, "activeTasks");

  const snapshot: ProjectStateSnapshot = {
    stage: readString(params, "stage") ?? existing.stage,
    activeTasks: activeTasksParam ?? existing.activeTasks,
    summary: readString(params, "summary") ?? existing.summary,
  };

  await ensureStateDir(config);
  await writeFile(filePath, renderProjectState(config, snapshot), "utf8");
  return { filePath, snapshot };
}

async function writeTodo(
  config: NeigeConfig,
  params: Record<string, unknown>,
): Promise<{ filePath: string; items: TodoItem[] }> {
  const filePath = getTodoPath(config);
  const action = requireAction(params);
  const text = requireText(params, "text");
  const items = parseTodo(await readOptionalUtf8(filePath));
  const index = items.findIndex((item) => item.text === text);

  if (action === "upsert_todo") {
    const done = typeof params.done === "boolean" ? params.done : false;
    if (index >= 0) {
      items[index] = { text, done };
    } else {
      items.push({ text, done });
    }
  }

  if (action === "remove_todo" && index >= 0) {
    items.splice(index, 1);
  }

  await ensureStateDir(config);
  await writeFile(filePath, renderTodo(items), "utf8");
  return { filePath, items };
}

function toolResult(text: string, details: unknown) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

type WritebackToolOptions = {
  lockOptions?: Omit<LockOptions, "metadata">;
};

export function createNeigeWritebackTool(
  config: NeigeConfig,
  options?: WritebackToolOptions,
): PluginTool {
  return {
    name: "neige-state",
    label: "Neige State",
    description:
      "更新 Neige 的项目共享白板文件。支持写入 PROJECT_STATE.md 与 TODO.md。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: ["set_project_state", "upsert_todo", "remove_todo"],
        },
        stage: { type: "string" },
        activeTasks: {
          type: "array",
          items: { type: "string" },
        },
        summary: { type: "string" },
        text: { type: "string" },
        done: { type: "boolean" },
      },
      required: ["action"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = requireAction(params);
      await ensureStateDir(config);

      try {
        return await withDirectoryLock(
          getLockDir(config),
          async () => {
            if (action === "set_project_state") {
              const result = await writeProjectState(config, params);
              return toolResult(`已更新 ${result.filePath}`, {
                action,
                filePath: result.filePath,
                snapshot: result.snapshot,
              });
            }

            const result = await writeTodo(config, params);
            return toolResult(`已更新 ${result.filePath}`, {
              action,
              filePath: result.filePath,
              items: result.items,
            });
          },
          {
            ...options?.lockOptions,
            metadata: {
              callId: _id,
              action,
            },
          },
        );
      } catch (error) {
        if (error instanceof DirectoryLockTimeoutError) {
          return toolResult(`获取 Neige 写锁失败：${error.message}`, {
            action,
            lockDir: error.lockDir,
            lockInfo: error.lockInfo,
          });
        }

        throw error;
      }
    },
  };
}


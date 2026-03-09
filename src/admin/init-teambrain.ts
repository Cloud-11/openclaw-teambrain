import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

export type InitializeTeamBrainOptions = {
  brainRoot: string;
  teamId: string;
  projectId: string;
};

export type InitializeTeamBrainResult = {
  teamRoot: string;
  projectStateDir: string;
  createdFiles: string[];
};

function requireNonEmptyString(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`${fieldName} 不能为空`);
  }

  return trimmed;
}

async function writeFileIfMissing(
  filePath: string,
  content: string,
  createdFiles: string[],
): Promise<void> {
  try {
    await access(filePath, constants.F_OK);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }

    await writeFile(filePath, content, "utf8");
    createdFiles.push(filePath);
  }
}

function buildGlobalRulesTemplate(): string {
  return [
    "# 团队长期规则",
    "",
    "- 所有新代码在提交前都应完成基本验证。",
    "- 所有项目状态变化应同步到共享白板。",
    "",
  ].join("\n");
}

function buildProjectStateTemplate(projectId: string): string {
  return [
    `# 项目状态：${projectId}`,
    "",
    "## 当前阶段",
    "初始化",
    "",
    "## 活跃任务",
    "- 暂无",
    "",
    "## 最近更新",
    "项目已初始化。",
    "",
  ].join("\n");
}

function buildTodoTemplate(): string {
  return ["# TODO", "", ""].join("\n");
}

export async function initializeTeamBrain(
  options: InitializeTeamBrainOptions,
): Promise<InitializeTeamBrainResult> {
  const brainRoot = requireNonEmptyString(options.brainRoot, "brainRoot");
  const teamId = requireNonEmptyString(options.teamId, "teamId");
  const projectId = requireNonEmptyString(options.projectId, "projectId");

  const teamRoot = join(brainRoot, teamId);
  const configDir = join(teamRoot, "config");
  const profilesDir = join(configDir, "profiles");
  const memoryGlobalDir = join(teamRoot, "memory_global");
  const projectRoot = join(teamRoot, "projects", projectId);
  const projectStateDir = join(projectRoot, "state");
  const workspaceDir = join(projectRoot, "agents_workspace");
  const createdFiles: string[] = [];

  await mkdir(profilesDir, { recursive: true });
  await mkdir(memoryGlobalDir, { recursive: true });
  await mkdir(projectStateDir, { recursive: true });
  await mkdir(workspaceDir, { recursive: true });

  await writeFileIfMissing(
    join(memoryGlobalDir, "global_rules.md"),
    buildGlobalRulesTemplate(),
    createdFiles,
  );
  await writeFileIfMissing(
    join(projectStateDir, "PROJECT_STATE.md"),
    buildProjectStateTemplate(projectId),
    createdFiles,
  );
  await writeFileIfMissing(join(projectStateDir, "TODO.md"), buildTodoTemplate(), createdFiles);

  return {
    teamRoot,
    projectStateDir,
    createdFiles,
  };
}

import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

export type CheckNeigeHealthOptions = {
  brainRoot: string;
  teamId: string;
  projectId: string;
};

export type CheckNeigeHealthResult = {
  ok: boolean;
  missingDirectories: string[];
  missingFiles: string[];
  suggestions: string[];
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function checkNeigeHealth(
  options: CheckNeigeHealthOptions,
): Promise<CheckNeigeHealthResult> {
  const teamRoot = join(options.brainRoot, options.teamId);
  const projectRoot = join(teamRoot, "projects", options.projectId);

  const requiredDirectories = [
    join(teamRoot, "config"),
    join(teamRoot, "memory_global"),
    join(projectRoot, "state"),
    join(projectRoot, "agents_workspace"),
  ];

  const requiredFiles = [
    join(teamRoot, "memory_global", "global_rules.md"),
    join(projectRoot, "state", "PROJECT_STATE.md"),
    join(projectRoot, "state", "TODO.md"),
  ];

  const missingDirectories: string[] = [];
  const missingFiles: string[] = [];

  for (const dirPath of requiredDirectories) {
    if (!(await pathExists(dirPath))) {
      missingDirectories.push(dirPath);
    }
  }

  for (const filePath of requiredFiles) {
    if (!(await pathExists(filePath))) {
      missingFiles.push(filePath);
    }
  }

  const suggestions =
    missingDirectories.length > 0 || missingFiles.length > 0
      ? ["运行初始化工具补齐 Neige 目录和模板文件。"]
      : [];

  return {
    ok: missingDirectories.length === 0 && missingFiles.length === 0,
    missingDirectories,
    missingFiles,
    suggestions,
  };
}


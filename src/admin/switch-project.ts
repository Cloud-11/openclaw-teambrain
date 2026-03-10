import { join } from "node:path";
import { initializeNeige, type InitializeNeigeOptions } from "./init-neige.ts";

export type SwitchNeigeProjectOptions = InitializeNeigeOptions;

export type SwitchNeigeProjectResult = {
  teamRoot: string;
  projectRoot: string;
  projectStateDir: string;
  createdFiles: string[];
};

export async function switchNeigeProject(
  options: SwitchNeigeProjectOptions,
): Promise<SwitchNeigeProjectResult> {
  const result = await initializeNeige(options);
  const projectRoot = join(result.teamRoot, "projects", options.projectId.trim());

  return {
    teamRoot: result.teamRoot,
    projectRoot,
    projectStateDir: result.projectStateDir,
    createdFiles: result.createdFiles,
  };
}


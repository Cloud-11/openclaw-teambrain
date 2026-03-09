import { join } from "node:path";
import { initializeTeamBrain, type InitializeTeamBrainOptions } from "./init-teambrain.ts";

export type SwitchTeamBrainProjectOptions = InitializeTeamBrainOptions;

export type SwitchTeamBrainProjectResult = {
  teamRoot: string;
  projectRoot: string;
  projectStateDir: string;
  createdFiles: string[];
};

export async function switchTeamBrainProject(
  options: SwitchTeamBrainProjectOptions,
): Promise<SwitchTeamBrainProjectResult> {
  const result = await initializeTeamBrain(options);
  const projectRoot = join(result.teamRoot, "projects", options.projectId.trim());

  return {
    teamRoot: result.teamRoot,
    projectRoot,
    projectStateDir: result.projectStateDir,
    createdFiles: result.createdFiles,
  };
}

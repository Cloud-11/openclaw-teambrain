import { switchTeamBrainProject } from "../src/admin/switch-project.ts";
import { parseCliArgs, requireArg } from "./utils.ts";

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const result = await switchTeamBrainProject({
    brainRoot: requireArg(args, "brain-root"),
    teamId: requireArg(args, "team-id"),
    projectId: requireArg(args, "project-id"),
  });

  console.log(JSON.stringify(result, null, 2));
}

await main();

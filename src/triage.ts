export type NeigeScope =
  | "session-scope"
  | "adhoc-scope"
  | "project-scope"
  | "team-scope";

export type NeigeRoleId = "main" | "coder" | "qa" | "writer" | "ko" | "ops" | string;

export type NeigeTriageSignals = {
  isSimpleQuestion?: boolean;
  hasExplicitDeliverable?: boolean;
  shouldRetainRecord?: boolean;
  requiresTracking?: boolean;
  requiresSpecialistRole?: boolean;
  preferredRole?: NeigeRoleId;
  activeProjectId?: string;
  isNewProject?: boolean;
  affectsTeamRules?: boolean;
  affectsKnowledgeAssets?: boolean;
};

export type NeigeTriageInput = {
  request: string;
  signals: NeigeTriageSignals;
};

export type NeigeTriageResult = {
  scope: NeigeScope;
  shouldCreateTaskDraft: boolean;
  shouldProjectize: boolean;
  shouldCreateProject: boolean;
  shouldDispatch: boolean;
  recommendedRole: NeigeRoleId;
  reasons: string[];
};

function hasActiveProject(input: NeigeTriageSignals): boolean {
  return typeof input.activeProjectId === "string" && input.activeProjectId.trim() !== "";
}

function chooseTeamRole(signals: NeigeTriageSignals): NeigeRoleId {
  if (signals.affectsKnowledgeAssets) {
    return "ko";
  }

  return "main";
}

function chooseProjectRole(signals: NeigeTriageSignals): NeigeRoleId {
  if (signals.requiresSpecialistRole && signals.preferredRole) {
    return signals.preferredRole;
  }

  return "main";
}

export function triageNeigeRequest(input: NeigeTriageInput): NeigeTriageResult {
  const reasons: string[] = [];
  const signals = input.signals;

  if (signals.affectsTeamRules || signals.affectsKnowledgeAssets) {
    reasons.push("请求触及团队规则或长期知识资产");
    return {
      scope: "team-scope",
      shouldCreateTaskDraft: true,
      shouldProjectize: false,
      shouldCreateProject: false,
      shouldDispatch: true,
      recommendedRole: chooseTeamRole(signals),
      reasons,
    };
  }

  if (signals.isNewProject || (signals.requiresTracking && hasActiveProject(signals))) {
    reasons.push("请求需要进入正式项目追踪范围");
    if (signals.requiresSpecialistRole && signals.preferredRole) {
      reasons.push(`请求更适合派发给角色 ${signals.preferredRole}`);
    }

    return {
      scope: "project-scope",
      shouldCreateTaskDraft: true,
      shouldProjectize: true,
      shouldCreateProject: Boolean(signals.isNewProject),
      shouldDispatch: Boolean(
        signals.requiresSpecialistRole && signals.preferredRole && !signals.isNewProject,
      ),
      recommendedRole: chooseProjectRole(signals),
      reasons,
    };
  }

  if (signals.hasExplicitDeliverable && signals.shouldRetainRecord) {
    reasons.push("请求有明确交付物，且值得留痕，但不需要正式项目追踪");
    return {
      scope: "adhoc-scope",
      shouldCreateTaskDraft: true,
      shouldProjectize: false,
      shouldCreateProject: false,
      shouldDispatch: false,
      recommendedRole: "main",
      reasons,
    };
  }

  reasons.push("请求适合在当前会话中直接完成");
  return {
    scope: "session-scope",
    shouldCreateTaskDraft: false,
    shouldProjectize: false,
    shouldCreateProject: false,
    shouldDispatch: false,
    recommendedRole: "main",
    reasons,
  };
}

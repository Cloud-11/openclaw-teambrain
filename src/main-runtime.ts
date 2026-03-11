import type { NeigeConfig } from "./config.ts";
import { refreshPortfolioBoard, type PortfolioBoardSnapshot } from "./portfolio-board.ts";
import {
  attachSessionRefToTask,
  createSessionRef,
  type SessionRefKind,
  upsertSessionTaskIndex,
} from "./session-refs.ts";
import {
  createTaskDraft,
  finalizeTaskDraft,
  type FinalizeTaskDraftResult,
  type TaskDraft,
} from "./task-draft.ts";
import {
  triageNeigeRequest,
  type NeigeTriageInput,
  type NeigeTriageResult,
  type NeigeTriageSignals,
} from "./triage.ts";

export type NeigeMainSessionInput = {
  sessionKey: string;
  agentId: string;
  roleId: string;
  kind: SessionRefKind;
  purpose: string;
  createdAt?: string;
  endedAt?: string | null;
};

export type NeigeMainIntakeInput = {
  action: "intake";
  request: string;
  signals: NeigeTriageSignals;
  taskOwner?: string;
  definitionOfDone?: string[];
  constraints?: string[];
  risks?: string[];
  nextAction?: string;
  session?: NeigeMainSessionInput;
};

export type NeigeMainPortfolioInput = {
  action: "portfolio";
};

export type NeigeMainActionInput = NeigeMainIntakeInput | NeigeMainPortfolioInput;

export type NeigeMainSessionRefResult = {
  taskSessionsPath: string;
  sessionIndexPath: string;
};

export type NeigeMainResult =
  | {
      mode: "session-response";
      summary: string;
      triage: NeigeTriageResult;
      taskDraft?: undefined;
      taskCard?: undefined;
      sessionRef?: undefined;
      portfolio?: undefined;
    }
  | {
      mode: "task-created";
      summary: string;
      triage: NeigeTriageResult;
      taskDraft: TaskDraft;
      taskCard: FinalizeTaskDraftResult;
      sessionRef?: NeigeMainSessionRefResult;
      portfolio?: undefined;
    }
  | {
      mode: "portfolio-refreshed";
      summary: string;
      portfolio: PortfolioBoardSnapshot;
      triage?: undefined;
      taskDraft?: undefined;
      taskCard?: undefined;
      sessionRef?: undefined;
    };

function requireNonEmptyRequest(request: string): string {
  const normalized = request.trim();
  if (normalized === "") {
    throw new Error("request required");
  }

  return normalized;
}

function buildDefinitionOfDone(input: NeigeMainIntakeInput, triage: NeigeTriageResult): string[] {
  const provided =
    input.definitionOfDone
      ?.map((item) => item.trim())
      .filter(Boolean) ?? [];

  if (provided.length > 0) {
    return provided;
  }

  if (triage.scope === "project-scope") {
    return ["交付物已完成", "结果已写回状态层"];
  }

  if (triage.scope === "team-scope") {
    return ["团队规则或知识资产已更新", "结果已写回状态层"];
  }

  return ["形成可复用结果", "结果已写回状态层"];
}

function resolveTaskOwner(input: NeigeMainIntakeInput, triage: NeigeTriageResult): string {
  return input.taskOwner?.trim() || triage.recommendedRole || "main";
}

function buildTaskDraftInput(input: NeigeMainIntakeInput, triage: NeigeTriageResult): TaskDraft {
  return createTaskDraft({
    request: input.request,
    scope: triage.scope,
    projectId: input.signals.activeProjectId,
    owner: "main",
    recommendedRole: triage.recommendedRole,
    triageReasons: triage.reasons,
  });
}

async function maybeAttachSessionRef(
  config: NeigeConfig,
  input: NeigeMainIntakeInput,
  taskCard: FinalizeTaskDraftResult,
  taskScope: string,
  taskOwner: string,
): Promise<NeigeMainSessionRefResult | undefined> {
  if (!input.session) {
    return undefined;
  }

  const sessionRef = createSessionRef({
    sessionKey: input.session.sessionKey,
    agentId: input.session.agentId,
    roleId: input.session.roleId,
    kind: input.session.kind,
    linkedTaskId: taskCard.taskId,
    purpose: input.session.purpose,
    taskOwner,
    taskScope,
    createdAt: input.session.createdAt,
    endedAt: input.session.endedAt,
  });

  const taskSessionResult = await attachSessionRefToTask(config, {
    projectId: taskCard.stateProjectId,
    taskId: taskCard.taskId,
    sessionRef,
  });
  const sessionIndexResult = await upsertSessionTaskIndex(config, {
    projectId: taskCard.stateProjectId,
    taskId: taskCard.taskId,
    sessionRef,
  });

  return {
    taskSessionsPath: taskSessionResult.filePath,
    sessionIndexPath: sessionIndexResult.filePath,
  };
}

export async function runNeigeMainAction(
  config: NeigeConfig,
  input: NeigeMainActionInput,
): Promise<NeigeMainResult> {
  if (input.action === "portfolio") {
    const portfolio = await refreshPortfolioBoard(config);
    return {
      mode: "portfolio-refreshed",
      summary: `已刷新 portfolio board，共 ${portfolio.summary.projectCount} 个项目。`,
      portfolio,
    };
  }

  const triageInput: NeigeTriageInput = {
    request: requireNonEmptyRequest(input.request),
    signals: input.signals,
  };
  const triage = triageNeigeRequest(triageInput);

  if (!triage.shouldCreateTaskDraft) {
    return {
      mode: "session-response",
      summary: `请求保持在当前会话处理，scope=${triage.scope}。`,
      triage,
    };
  }

  const taskDraft = buildTaskDraftInput(input, triage);
  const taskOwner = resolveTaskOwner(input, triage);
  const taskCard = await finalizeTaskDraft(config, taskDraft, {
    owner: taskOwner,
    definitionOfDone: buildDefinitionOfDone(input, triage),
    constraints: input.constraints,
    risks: input.risks,
    nextAction: input.nextAction,
  });
  const sessionRef = await maybeAttachSessionRef(config, input, taskCard, triage.scope, taskOwner);

  return {
    mode: "task-created",
    summary: `已创建 ${taskCard.taskId}，scope=${triage.scope}。`,
    triage,
    taskDraft,
    taskCard,
    sessionRef,
  };
}

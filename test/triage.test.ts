import { describe, expect, it } from "vitest";
import { triageNeigeRequest } from "../src/triage.ts";

describe("triageNeigeRequest", () => {
  it("会把简单问答判定为 session-scope，并保持在当前会话", () => {
    const result = triageNeigeRequest({
      request: "帮我快速总结一下这两个方案的差别",
      signals: {
        isSimpleQuestion: true,
      },
    });

    expect(result.scope).toBe("session-scope");
    expect(result.shouldCreateTaskDraft).toBe(false);
    expect(result.shouldProjectize).toBe(false);
    expect(result.shouldDispatch).toBe(false);
    expect(result.recommendedRole).toBe("main");
  });

  it("会把值得留痕但不成项目的事务判定为 adhoc-scope", () => {
    const result = triageNeigeRequest({
      request: "帮我整理一份临时资料清单，后面可能会用到",
      signals: {
        hasExplicitDeliverable: true,
        shouldRetainRecord: true,
        requiresTracking: false,
      },
    });

    expect(result.scope).toBe("adhoc-scope");
    expect(result.shouldCreateTaskDraft).toBe(true);
    expect(result.shouldProjectize).toBe(false);
    expect(result.shouldDispatch).toBe(false);
    expect(result.recommendedRole).toBe("main");
  });

  it("会把正式项目任务判定为 project-scope，并建议派发给专家", () => {
    const result = triageNeigeRequest({
      request: "在当前项目里实现初始化工具，并交给 coder 去做",
      signals: {
        hasExplicitDeliverable: true,
        requiresTracking: true,
        activeProjectId: "sandbox",
        requiresSpecialistRole: true,
        preferredRole: "coder",
      },
    });

    expect(result.scope).toBe("project-scope");
    expect(result.shouldCreateTaskDraft).toBe(true);
    expect(result.shouldProjectize).toBe(true);
    expect(result.shouldDispatch).toBe(true);
    expect(result.recommendedRole).toBe("coder");
  });

  it("会把新项目请求判定为 project-scope，并建议先立项而不是立刻派发", () => {
    const result = triageNeigeRequest({
      request: "我们开始一个新项目，叫 Snowfall",
      signals: {
        hasExplicitDeliverable: true,
        requiresTracking: true,
        isNewProject: true,
      },
    });

    expect(result.scope).toBe("project-scope");
    expect(result.shouldCreateTaskDraft).toBe(true);
    expect(result.shouldProjectize).toBe(true);
    expect(result.shouldCreateProject).toBe(true);
    expect(result.shouldDispatch).toBe(false);
    expect(result.recommendedRole).toBe("main");
  });

  it("会把规则/技能类请求判定为 team-scope", () => {
    const result = triageNeigeRequest({
      request: "把这次经验升级成团队规则并整理成 skill 候选",
      signals: {
        affectsTeamRules: true,
        affectsKnowledgeAssets: true,
      },
    });

    expect(result.scope).toBe("team-scope");
    expect(result.shouldCreateTaskDraft).toBe(true);
    expect(result.shouldProjectize).toBe(false);
    expect(result.shouldDispatch).toBe(true);
    expect(result.recommendedRole).toBe("ko");
  });
});

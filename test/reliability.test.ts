import { describe, expect, it } from "vitest";
import { evaluateReliabilityGuard } from "../src/reliability.ts";

describe("reliability guard", () => {
  it("会在 breaker 打开时拦截请求", () => {
    const result = evaluateReliabilityGuard({
      breakerOpen: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("breaker-open");
  });

  it("会在超出 timeout budget 时拦截请求", () => {
    const result = evaluateReliabilityGuard({
      elapsedMs: 1200,
      timeoutMs: 1000,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("timeout-exceeded");
  });

  it("会在超出 retry budget 时拦截请求", () => {
    const result = evaluateReliabilityGuard({
      retryCount: 3,
      retryBudget: 2,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("retry-budget-exceeded");
  });

  it("会在 handoff 深度超限时拦截请求", () => {
    const result = evaluateReliabilityGuard({
      handoffDepth: 4,
      maxHandoffDepth: 3,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("handoff-depth-exceeded");
  });

  it("会在 active children 超限时拦截请求", () => {
    const result = evaluateReliabilityGuard({
      activeChildren: 5,
      maxActiveChildren: 4,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("active-children-exceeded");
  });

  it("会在所有预算范围内放行请求", () => {
    const result = evaluateReliabilityGuard({
      retryCount: 1,
      retryBudget: 2,
      handoffDepth: 1,
      maxHandoffDepth: 3,
      activeChildren: 1,
      maxActiveChildren: 2,
      elapsedMs: 400,
      timeoutMs: 1000,
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ok");
  });
});

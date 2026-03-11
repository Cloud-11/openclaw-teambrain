export type NeigeReliabilityInput = {
  breakerOpen?: boolean;
  retryCount?: number;
  retryBudget?: number;
  handoffDepth?: number;
  maxHandoffDepth?: number;
  activeChildren?: number;
  maxActiveChildren?: number;
  elapsedMs?: number;
  timeoutMs?: number;
};

export type NeigeReliabilityGuardCode =
  | "ok"
  | "breaker-open"
  | "timeout-exceeded"
  | "retry-budget-exceeded"
  | "handoff-depth-exceeded"
  | "active-children-exceeded";

export type NeigeReliabilityGuardResult = {
  allowed: boolean;
  code: NeigeReliabilityGuardCode;
  reason: string;
};

function normalizeCount(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

export function evaluateReliabilityGuard(
  input?: NeigeReliabilityInput,
): NeigeReliabilityGuardResult {
  if (!input) {
    return {
      allowed: true,
      code: "ok",
      reason: "未提供可靠性约束，按默认允许处理。",
    };
  }

  if (input.breakerOpen) {
    return {
      allowed: false,
      code: "breaker-open",
      reason: "可靠性 breaker 已打开，当前请求被暂停。",
    };
  }

  const elapsedMs = normalizeCount(input.elapsedMs);
  const timeoutMs = normalizeCount(input.timeoutMs);
  if (elapsedMs !== undefined && timeoutMs !== undefined && elapsedMs > timeoutMs) {
    return {
      allowed: false,
      code: "timeout-exceeded",
      reason: "已超出 timeout budget。",
    };
  }

  const retryCount = normalizeCount(input.retryCount);
  const retryBudget = normalizeCount(input.retryBudget);
  if (retryCount !== undefined && retryBudget !== undefined && retryCount > retryBudget) {
    return {
      allowed: false,
      code: "retry-budget-exceeded",
      reason: "已超出 retry budget。",
    };
  }

  const handoffDepth = normalizeCount(input.handoffDepth);
  const maxHandoffDepth = normalizeCount(input.maxHandoffDepth);
  if (
    handoffDepth !== undefined &&
    maxHandoffDepth !== undefined &&
    handoffDepth > maxHandoffDepth
  ) {
    return {
      allowed: false,
      code: "handoff-depth-exceeded",
      reason: "已超出 handoff 深度限制。",
    };
  }

  const activeChildren = normalizeCount(input.activeChildren);
  const maxActiveChildren = normalizeCount(input.maxActiveChildren);
  if (
    activeChildren !== undefined &&
    maxActiveChildren !== undefined &&
    activeChildren > maxActiveChildren
  ) {
    return {
      allowed: false,
      code: "active-children-exceeded",
      reason: "已超出 active children 上限。",
    };
  }

  return {
    allowed: true,
    code: "ok",
    reason: "当前请求仍在可靠性预算范围内。",
  };
}

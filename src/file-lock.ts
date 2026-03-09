import { mkdir, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

type LockOptions = {
  retryMs?: number;
  timeoutMs?: number;
};

const DEFAULT_RETRY_MS = 20;
const DEFAULT_TIMEOUT_MS = 5000;

function readErrorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

async function acquireDirectoryLock(lockDir: string, options?: LockOptions): Promise<void> {
  const retryMs = options?.retryMs ?? DEFAULT_RETRY_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  while (true) {
    try {
      await mkdir(lockDir);
      return;
    } catch (error) {
      const code = readErrorCode(error);

      if (code !== "EEXIST") {
        throw error;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`获取 TeamBrain 写锁超时：${lockDir}`);
      }

      await delay(retryMs);
    }
  }
}

async function releaseDirectoryLock(lockDir: string): Promise<void> {
  await rm(lockDir, { recursive: true, force: true });
}

export async function withDirectoryLock<T>(
  lockDir: string,
  task: () => Promise<T>,
  options?: LockOptions,
): Promise<T> {
  await acquireDirectoryLock(lockDir, options);

  try {
    return await task();
  } finally {
    await releaseDirectoryLock(lockDir);
  }
}

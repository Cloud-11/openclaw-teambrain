import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export type LockMetadata = {
  callId?: string;
  action?: string;
  acquiredAt?: string;
};

export type LockOptions = {
  retryMs?: number;
  timeoutMs?: number;
  metadata?: LockMetadata;
};

const DEFAULT_RETRY_MS = 20;
const DEFAULT_TIMEOUT_MS = 5000;
const LOCK_META_FILE = ".lock-meta.json";

function readErrorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

async function readLockMetadata(lockDir: string): Promise<LockMetadata | undefined> {
  try {
    const content = await readFile(`${lockDir}/${LOCK_META_FILE}`, "utf8");
    const parsed = JSON.parse(content) as LockMetadata;
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch (error) {
    const code = readErrorCode(error);
    if (code === "ENOENT") {
      return undefined;
    }

    return undefined;
  }
}

async function writeLockMetadata(lockDir: string, metadata?: LockMetadata): Promise<void> {
  const payload: LockMetadata = {
    acquiredAt: new Date().toISOString(),
    ...metadata,
  };

  await writeFile(`${lockDir}/${LOCK_META_FILE}`, JSON.stringify(payload, null, 2), "utf8");
}

function formatLockMetadata(metadata?: LockMetadata): string {
  if (!metadata) {
    return "";
  }

  const parts = [
    metadata.callId ? `callId=${metadata.callId}` : undefined,
    metadata.action ? `action=${metadata.action}` : undefined,
    metadata.acquiredAt ? `acquiredAt=${metadata.acquiredAt}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? `；占用信息：${parts.join(", ")}` : "";
}

export class DirectoryLockTimeoutError extends Error {
  readonly lockDir: string;
  readonly lockInfo?: LockMetadata;

  constructor(lockDir: string, lockInfo?: LockMetadata) {
    super(`获取 TeamBrain 写锁超时：${lockDir}${formatLockMetadata(lockInfo)}`);
    this.name = "DirectoryLockTimeoutError";
    this.lockDir = lockDir;
    this.lockInfo = lockInfo;
  }
}

async function acquireDirectoryLock(lockDir: string, options?: LockOptions): Promise<void> {
  const retryMs = options?.retryMs ?? DEFAULT_RETRY_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  while (true) {
    try {
      await mkdir(lockDir);
      await writeLockMetadata(lockDir, options?.metadata);
      return;
    } catch (error) {
      const code = readErrorCode(error);

      if (code !== "EEXIST") {
        throw error;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new DirectoryLockTimeoutError(lockDir, await readLockMetadata(lockDir));
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

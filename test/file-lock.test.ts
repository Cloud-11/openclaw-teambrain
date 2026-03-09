import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withDirectoryLock } from "../src/file-lock.ts";

describe("withDirectoryLock", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("锁超时时会在错误信息中带出锁元数据诊断", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-file-lock-"));
    tempDirs.push(root);

    const lockDir = join(root, ".teambrain.lock");
    await mkdir(lockDir, { recursive: true });
    await writeFile(
      join(lockDir, ".lock-meta.json"),
      JSON.stringify(
        {
          callId: "call-stuck",
          action: "upsert_todo",
          acquiredAt: "2026-03-09T00:00:00.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );

    let error: Error | undefined;
    try {
      await withDirectoryLock(
        lockDir,
        async () => "ok",
        {
          retryMs: 10,
          timeoutMs: 40,
        },
      );
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain("call-stuck");
    expect(error?.message).toContain("upsert_todo");
  });

  it("获取锁后会写入锁元数据文件", async () => {
    const root = await mkdtemp(join(tmpdir(), "teambrain-file-lock-meta-"));
    tempDirs.push(root);

    const lockDir = join(root, ".teambrain.lock");
    let snapshot = "";

    await withDirectoryLock(
      lockDir,
      async () => {
        snapshot = await readFile(join(lockDir, ".lock-meta.json"), "utf8");
      },
      {
        retryMs: 10,
        timeoutMs: 100,
        metadata: {
          callId: "call-1",
          action: "set_project_state",
        },
      },
    );

    expect(snapshot).toContain("call-1");
    expect(snapshot).toContain("set_project_state");
  });
});

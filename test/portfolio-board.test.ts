import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeNeigeConfig } from "../src/config.ts";
import { createNeigePortfolioTool } from "../src/portfolio-board.ts";

async function writeUtf8(filePath: string, content: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

describe("portfolio board tool", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("neige-portfolio 会汇总多个项目状态并生成 PORTFOLIO_BOARD.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-portfolio-tool-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/projects/alpha/state/PROJECT_STATE.md"),
      [
        "# 项目状态：alpha",
        "",
        "## 当前阶段",
        "开发中",
        "",
        "## 活跃任务",
        "- 实现登录",
        "- 接口联调",
        "",
        "## 阻塞事项",
        "- 缺少测试账号",
        "",
      ].join("\n"),
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/alpha/state/TODO.md"),
      ["# TODO", "", "- [ ] 补 smoke 测试", "- [x] 建立脚手架", ""].join("\n"),
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/beta/state/PROJECT_STATE.md"),
      [
        "# 项目状态：beta",
        "",
        "## 当前阶段",
        "验证中",
        "",
        "## 活跃任务",
        "- 跑回归测试",
        "",
      ].join("\n"),
    );

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "alpha",
    });

    const tool = createNeigePortfolioTool(config);
    const result = await tool.execute("call-1", {
      action: "refresh",
    });

    const details = result.details as {
      filePath: string;
      projectCount: number;
      blockedProjectCount: number;
      activeTaskCount: number;
    };
    const board = await readFile(details.filePath, "utf8");

    expect(details.projectCount).toBe(2);
    expect(details.blockedProjectCount).toBe(1);
    expect(details.activeTaskCount).toBe(3);
    expect(board).toContain("# Portfolio Board");
    expect(board).toContain("## 汇总");
    expect(board).toContain("- 项目数: 2");
    expect(board).toContain("- 阻塞项目数: 1");
    expect(board).toContain("## 项目：alpha");
    expect(board).toContain("- 当前阶段: 开发中");
    expect(board).toContain("- 活跃任务: 实现登录；接口联调");
    expect(board).toContain("- 阻塞事项: 缺少测试账号");
    expect(board).toContain("- 未完成 TODO: 补 smoke 测试");
    expect(board).toContain("## 项目：beta");
    expect(result.content[0]?.text).toContain("已生成组合汇报");
  });

  it("会忽略 _portfolio 项目并在无状态文件时跳过目录", async () => {
    const root = await mkdtemp(join(tmpdir(), "neige-portfolio-ignore-"));
    tempDirs.push(root);

    await writeUtf8(
      join(root, "my-dev-team/projects/gamma/state/PROJECT_STATE.md"),
      ["# 项目状态：gamma", "", "## 当前阶段", "规划中", ""].join("\n"),
    );
    await writeUtf8(
      join(root, "my-dev-team/projects/_portfolio/state/PROJECT_STATE.md"),
      ["# 项目状态：_portfolio", "", "## 当前阶段", "系统文件", ""].join("\n"),
    );
    await writeUtf8(join(root, "my-dev-team/projects/empty/README.md"), "placeholder");

    const config = normalizeNeigeConfig({
      brainRoot: root,
      teamId: "my-dev-team",
      projectId: "gamma",
    });

    const tool = createNeigePortfolioTool(config);
    const result = await tool.execute("call-2", {
      action: "refresh",
    });
    const details = result.details as {
      filePath: string;
      projectCount: number;
    };
    const board = await readFile(details.filePath, "utf8");

    expect(details.projectCount).toBe(1);
    expect(board).toContain("## 项目：gamma");
    expect(board).not.toContain("_portfolio");
    expect(board).not.toContain("empty");
  });
});

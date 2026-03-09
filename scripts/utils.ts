export function parseCliArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`命令参数 ${token} 缺少值`);
    }

    result[key] = value;
    index += 1;
  }

  return result;
}

export function requireArg(args: Record<string, string>, key: string): string {
  const value = args[key];
  if (!value || value.trim() === "") {
    throw new Error(`缺少必填参数 --${key}`);
  }

  return value.trim();
}

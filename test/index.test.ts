import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigLoadError, loadConfig } from "../src";
import { FIXTURES_DIR } from "./constants";

describe("loadConfig", () => {
  it("should load config correctly", async () => {
    const { config, filepath } = await loadConfig<{ name: string }>({
      name: "name1",
      cwd: FIXTURES_DIR,
    });
    expect(config).toBeDefined();
    expect(filepath).toBe(path.join(FIXTURES_DIR, "name1.ts"));
    expect(config.name).toBe("name1");
  });

  it("should respect extensions priority", async () => {
    const { config, filepath } = await loadConfig<{ name: string }>({
      name: "name1",
      cwd: FIXTURES_DIR,
      extensions: [".json", ".ts"],
    });
    expect(filepath).toBe(path.join(FIXTURES_DIR, "name1.json"));
    expect(config.name).toBe("name1");
  });

  it("should throw error for non-existent config", async () => {
    await expect(
      loadConfig<{ name: string }>({
        name: "nonexistent",
        cwd: FIXTURES_DIR,
      }),
    ).rejects.toThrow(ConfigLoadError);
  });

  it("should load JSON config correctly", async () => {
    const { config, filepath } = await loadConfig<{ name: string }>({
      name: "name1",
      cwd: FIXTURES_DIR,
      extensions: [".json"],
    });
    expect(filepath).toBe(path.join(FIXTURES_DIR, "name1.json"));
    expect(config.name).toBe("name1");
  });

  it("should find config in parent directory", async () => {
    const { config, filepath } = await loadConfig<{ name: string }>({
      name: "parentConfig",
      cwd: path.join(FIXTURES_DIR, "subdir"),
    });
    expect(filepath).toBe(path.join(FIXTURES_DIR, "parentConfig.ts"));
    expect(config.name).toBe("parent");
  });

  it("should respect maxDepth option", async () => {
    await expect(
      loadConfig<{ name: string }>({
        name: "parentConfig",
        cwd: path.join(FIXTURES_DIR, "subdir", "deep"),
        maxDepth: 1,
      }),
    ).rejects.toThrow(ConfigLoadError);
  });

  it("should handle function exports", async () => {
    const { config, filepath } = await loadConfig<{ name: string }>({
      name: "functionConfig",
      cwd: FIXTURES_DIR,
    });
    expect(filepath).toBe(path.join(FIXTURES_DIR, "functionConfig.ts"));
    expect(config.name).toBe("function");
  });

  it("should handle async exports", async () => {
    const { config, filepath } = await loadConfig<{ name: string }>({
      name: "asyncConfig",
      cwd: FIXTURES_DIR,
    });
    expect(filepath).toBe(path.join(FIXTURES_DIR, "asyncConfig.ts"));
    expect(config.name).toBe("async");
  });

  it("should work with string name parameter", async () => {
    const { config, filepath } = await loadConfig<{ name: string }>(
      "name1",
      [".ts"],
      { cwd: FIXTURES_DIR },
    );
    expect(filepath).toBe(path.join(FIXTURES_DIR, "name1.ts"));
    expect(config.name).toBe("name1");
  });
});

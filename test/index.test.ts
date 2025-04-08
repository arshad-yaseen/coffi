import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src";
import { FIXTURES_DIR } from "./constants";

describe("loadConfig", () => {
    it("should load config correctly", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
        });
        expect(config).toBeDefined();
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.ts"));
        expect(config?.name).toBe("config");
    });

    it("path and name should be null for non-existent config", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "nonexistent",
            cwd: FIXTURES_DIR,
        });
        expect(config).toBeNull();
        expect(filepath).toBeNull();
    });

    it("should respect extensions priority", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
            extensions: [".json", ".ts"],
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.json"));
        expect(config?.name).toBe("config");
    });

    it("should load JSON config correctly", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
            extensions: [".json"],
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.json"));
        expect(config?.name).toBe("config");
    });

    it("should find config in parent directory", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "parentConfig",
            cwd: path.join(FIXTURES_DIR, "subdir"),
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "parentConfig.ts"));
        expect(config?.name).toBe("parent");
    });

    it("should respect maxDepth option", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "parentConfig",
            cwd: path.join(FIXTURES_DIR, "subdir", "deep"),
            maxDepth: 1,
        });
        expect(config).toBeNull();
        expect(filepath).toBeNull();
    });

    it("should handle function exports", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "functionConfig",
            cwd: FIXTURES_DIR,
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "functionConfig.ts"));
        expect(config?.name).toBe("function");
    });

    it("should handle async exports", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "asyncConfig",
            cwd: FIXTURES_DIR,
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "asyncConfig.ts"));
        expect(config?.name).toBe("async");
    });

    it("should work with string name parameter", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>(
            "config",
            [".ts"],
            { cwd: FIXTURES_DIR },
        );
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.ts"));
        expect(config?.name).toBe("config");
    });

    it("should load .mts config correctly", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
            extensions: [".mts"],
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.mts"));
        expect(config?.name).toBe("mts");
    });

    it("should load .cts config correctly", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
            extensions: [".cts"],
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.cts"));
        expect(config?.name).toBe("cts");
    });

    it("should load .js config correctly", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
            extensions: [".js"],
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.js"));
        expect(config?.name).toBe("js");
    });

    it("should load .mjs config correctly", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
            extensions: [".mjs"],
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.mjs"));
        expect(config?.name).toBe("mjs");
    });

    it("should load .cjs config correctly", async () => {
        const { config, filepath } = await loadConfig<{ name: string }>({
            name: "config",
            cwd: FIXTURES_DIR,
            extensions: [".cjs"],
        });
        expect(filepath).toBe(path.join(FIXTURES_DIR, "config.cjs"));
        expect(config?.name).toBe("cjs");
    });
});

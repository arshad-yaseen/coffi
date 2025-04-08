import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_EXTENSIONS } from "./defaults";
import { logger } from "./logger";
import type { LoadConfigOptions, LoadConfigResult } from "./types";

export * from "./types";

function _exists(filepath: string): boolean {
    try {
        return existsSync(filepath);
    } catch {
        return false;
    }
}

async function parseConfigFile<T>(filepath: string): Promise<T | null> {
    try {
        if (!_exists(filepath)) {
            return null;
        }

        const ext = filepath.slice(filepath.lastIndexOf(".")).toLowerCase();

        if (ext === ".json") {
            const file = readFileSync(filepath, "utf-8");
            return JSON.parse(file) as T;
        }

        const module = await import(filepath);
        let config = module.default || module;

        if (typeof config === "function") {
            config = config();
        }

        if (config instanceof Promise) {
            return config as unknown as T;
        }

        return config as T;
    } catch (error) {
        return null;
    }
}

async function loadConfigInternal<T>(
    name: string,
    extensions: string[],
    cwd: string,
    maxDepth: number,
    preferredPath: string | undefined,
): Promise<LoadConfigResult<T>> {
    if (preferredPath) {
        const config = await parseConfigFile<T>(preferredPath);
        if (config !== null) {
            return { config, filepath: preferredPath };
        }
        logger.warn(
            `Preferred path "${preferredPath}" not found or invalid, searching for ${name} files instead.`,
        );
    }

    let currentDir = cwd;
    let currentDepth = 0;

    while (currentDepth < maxDepth) {
        for (const ext of extensions) {
            const filepath = join(currentDir, `${name}${ext}`);

            if (_exists(filepath)) {
                const config = await parseConfigFile<T>(filepath);
                if (config !== null) {
                    return { config, filepath };
                }
            }
        }

        const parentDir = dirname(currentDir);

        if (parentDir === currentDir) {
            break;
        }

        currentDir = parentDir;
        currentDepth++;
    }

    return { config: null, filepath: null };
}

export async function loadConfig<T = unknown>(
    nameOrOptions: string | LoadConfigOptions,
    extensions: string[] = DEFAULT_EXTENSIONS,
    options: Omit<LoadConfigOptions, "name" | "extensions"> = {},
): Promise<LoadConfigResult<T>> {
    if (typeof nameOrOptions === "string") {
        const name = nameOrOptions;
        const { cwd = process.cwd(), maxDepth = 10, preferredPath } = options;
        return loadConfigInternal<T>(
            name,
            extensions,
            cwd,
            maxDepth,
            preferredPath,
        );
    }

    const {
        name,
        extensions: exts = DEFAULT_EXTENSIONS,
        cwd = process.cwd(),
        maxDepth = 10,
        preferredPath,
    } = nameOrOptions;
    return loadConfigInternal<T>(name, exts, cwd, maxDepth, preferredPath);
}

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { logger } from "./logger";

export type Extention =
    | ".ts"
    | ".mts"
    | ".cts"
    | ".js"
    | ".mjs"
    | ".cjs"
    | ".json";

const DEFAULT_EXTENSIONS: Extention[] = [
    ".ts",
    ".mts",
    ".cts",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
];

/**
 * Options for loading a configuration file.
 */
export interface LoadConfigOptions {
    /**
     * The name of the configuration file without extension.
     */
    name: string;

    /**
     * An array of file extensions to look for, in order of priority.
     * Defaults to [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"]
     */
    extensions?: Extention[];

    /**
     * The current working directory to start searching from.
     * Defaults to process.cwd()
     */
    cwd?: string;

    /**
     * The maximum depth to search up the directory tree.
     * Defaults to 10.
     */
    maxDepth?: number;

    /**
     * The preferred path to the configuration file.
     * If provided, directly load the config from this path after checking package.json.
     */
    preferredPath?: string;

    /**
     * The property name in package.json to extract the configuration from.
     * If provided, this takes precedence over all other configuration sources.
     */
    packageJsonProperty?: string;
}

/**
 * Result returned from loading a configuration file.
 */
export interface LoadConfigResult<T> {
    /**
     * The loaded configuration object or null if no configuration file was found.
     */
    config: T | null;

    /**
     * The full path to the loaded configuration file or null if no configuration file was found.
     */
    filepath: string | null;
}

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

/**
 * Finds the nearest package.json file by searching up the directory tree from cwd.
 * @param cwd The starting directory.
 * @param maxDepth The maximum number of parent directories to search.
 * @returns The path to package.json or null if not found.
 */
function findPackageJson(cwd: string, maxDepth: number): string | null {
    let currentDir = cwd;
    let currentDepth = 0;

    while (currentDepth < maxDepth) {
        const packageJsonPath = join(currentDir, "package.json");
        if (_exists(packageJsonPath)) {
            return packageJsonPath;
        }
        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
        currentDepth++;
    }
    return null;
}

async function loadConfigInternal<T>(
    name: string,
    extensions: string[],
    cwd: string,
    maxDepth: number,
    preferredPath: string | undefined,
    packageJsonProperty: string | undefined,
): Promise<LoadConfigResult<T>> {
    if (packageJsonProperty) {
        const packageJsonPath = findPackageJson(cwd, maxDepth);
        if (packageJsonPath) {
            const packageJson =
                await parseConfigFile<Record<string, unknown>>(packageJsonPath);
            if (
                packageJson &&
                typeof packageJson === "object" &&
                packageJsonProperty in packageJson
            ) {
                return {
                    config: packageJson[packageJsonProperty] as T,
                    filepath: packageJsonPath,
                };
            }
        }
    }

    if (preferredPath) {
        const resolvedPath = resolve(cwd, preferredPath);
        const config = await parseConfigFile<T>(resolvedPath);
        if (config !== null) {
            return { config, filepath: resolvedPath };
        }
        logger.warn(
            `Preferred path "${preferredPath}" not found or invalid, searching for ${name} files instead.`,
        );
    }

    let currentDir = cwd;
    let currentDepth = 0;

    while (currentDepth < maxDepth) {
        try {
            const files = readdirSync(currentDir);
            const fileSet = new Set(files);

            for (const ext of extensions) {
                const filename = `${name}${ext}`;
                if (fileSet.has(filename)) {
                    const filepath = join(currentDir, filename);
                    const config = await parseConfigFile<T>(filepath);
                    if (config !== null) {
                        return { config, filepath };
                    }
                }
            }
        } catch (error) {}

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
        const {
            cwd = process.cwd(),
            maxDepth = 10,
            preferredPath,
            packageJsonProperty,
        } = options;
        return loadConfigInternal<T>(
            name,
            extensions,
            cwd,
            maxDepth,
            preferredPath,
            packageJsonProperty,
        );
    }

    const {
        name,
        extensions: exts = DEFAULT_EXTENSIONS,
        cwd = process.cwd(),
        maxDepth = 10,
        preferredPath,
        packageJsonProperty,
    } = nameOrOptions;
    return loadConfigInternal<T>(
        name,
        exts,
        cwd,
        maxDepth,
        preferredPath,
        packageJsonProperty,
    );
}

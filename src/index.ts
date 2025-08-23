import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { logger } from "./logger";
import { cleanJson } from "./utils";

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

export interface LoadConfigOptions {
    name: string;
    extensions?: Extention[];
    cwd?: string;
    maxDepth?: number;
    preferredPath?: string;
    packageJsonProperty?: string;
}

export interface LoadConfigResult<T> {
    config: T | null;
    filepath: string | null;
}

interface CacheEntry<T> {
    config: T | null;
    filepath: string | null;
    mtime: number;
}

const cache = new Map<string, CacheEntry<any>>();

function _exists(filepath: string): boolean {
    try {
        return existsSync(filepath);
    } catch {
        return false;
    }
}

function getCacheKey(
    name: string,
    extensions: string[],
    cwd: string,
    maxDepth: number,
    preferredPath: string | undefined,
    packageJsonProperty: string | undefined,
): string {
    return JSON.stringify({
        name,
        extensions,
        cwd,
        maxDepth,
        preferredPath,
        packageJsonProperty,
    });
}

function getFileMtime(filepath: string): number {
    try {
        return statSync(filepath).mtimeMs;
    } catch {
        return 0;
    }
}

function isCacheValid<T>(cacheEntry: CacheEntry<T>): boolean {
    if (!cacheEntry.filepath) {
        return true;
    }
    const currentMtime = getFileMtime(cacheEntry.filepath);
    return currentMtime === cacheEntry.mtime;
}

async function parseConfigFile<T>(filepath: string): Promise<T | null> {
    try {
        if (!_exists(filepath)) {
            return null;
        }
        const ext = filepath.slice(filepath.lastIndexOf(".")).toLowerCase();
        if (ext === ".json") {
            const file = await readFile(filepath, "utf-8");
            const stripped = cleanJson(file);
            return JSON.parse(stripped) as T;
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
        logger.error(
            `Failed to parse config file: ${parseErrorMessage(error)}`,
        );
        return null;
    }
}

function parseErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

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
    const cacheKey = getCacheKey(
        name,
        extensions,
        cwd,
        maxDepth,
        preferredPath,
        packageJsonProperty,
    );
    const cached = cache.get(cacheKey);

    if (cached && isCacheValid(cached)) {
        return { config: cached.config, filepath: cached.filepath };
    }

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
                const result = {
                    config: packageJson[packageJsonProperty] as T,
                    filepath: packageJsonPath,
                };
                cache.set(cacheKey, {
                    ...result,
                    mtime: getFileMtime(packageJsonPath),
                });
                return result;
            }
        }
    }

    if (preferredPath) {
        const resolvedPath = resolve(cwd, preferredPath);
        const config = await parseConfigFile<T>(resolvedPath);
        if (config !== null) {
            const result = { config, filepath: resolvedPath };
            cache.set(cacheKey, {
                ...result,
                mtime: getFileMtime(resolvedPath),
            });
            return result;
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
                        const result = { config, filepath };
                        cache.set(cacheKey, {
                            ...result,
                            mtime: getFileMtime(filepath),
                        });
                        return result;
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

    const result = { config: null, filepath: null };
    cache.set(cacheKey, { ...result, mtime: 0 });
    return result;
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

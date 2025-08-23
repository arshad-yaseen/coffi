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
    useCache?: boolean;
}

export interface LoadConfigResult<T> {
    config: T | null;
    filepath: string | null;
}

interface CacheEntry<T> {
    config: T;
    mtime: number;
    filepath: string;
}

class ConfigCache {
    public cache = new Map<string, CacheEntry<unknown>>();

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        try {
            const stats = statSync(entry.filepath);
            if (stats.mtimeMs === entry.mtime) {
                return entry.config as T;
            }
            this.cache.delete(key);
            return null;
        } catch {
            this.cache.delete(key);
            return null;
        }
    }

    set<T>(key: string, config: T, filepath: string): void {
        try {
            const stats = statSync(filepath);
            this.cache.set(key, {
                config,
                mtime: stats.mtimeMs,
                filepath,
            });
        } catch {
            logger.warn(
                `Could not cache config for ${filepath}: unable to get file stats`,
            );
        }
    }

    clear(): void {
        this.cache.clear();
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    size(): number {
        return this.cache.size;
    }

    static generateKey(
        name: string,
        extensions: string[],
        cwd: string,
        maxDepth: number,
        preferredPath: string | undefined,
        packageJsonProperty: string | undefined,
    ): string {
        const params = {
            name,
            extensions: extensions.sort().join(","),
            cwd,
            maxDepth,
            preferredPath: preferredPath || "",
            packageJsonProperty: packageJsonProperty || "",
        };
        return JSON.stringify(params);
    }
}

const configCache = new ConfigCache();

export { configCache };

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
    useCache = true,
): Promise<LoadConfigResult<T>> {
    const cacheKey = ConfigCache.generateKey(
        name,
        extensions,
        cwd,
        maxDepth,
        preferredPath,
        packageJsonProperty,
    );

    if (useCache) {
        const cachedConfig = configCache.get<T>(cacheKey);
        if (cachedConfig !== null) {
            logger.debug(`Config loaded from cache for key: ${cacheKey}`);
            const cachedEntry = configCache.cache.get(cacheKey);
            return {
                config: cachedConfig,
                filepath: cachedEntry?.filepath || null,
            };
        }
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
                if (useCache && result.config !== null) {
                    configCache.set(cacheKey, result.config, packageJsonPath);
                }
                return result;
            }
        }
    }

    if (preferredPath) {
        const resolvedPath = resolve(cwd, preferredPath);
        const config = await parseConfigFile<T>(resolvedPath);
        if (config !== null) {
            const result = { config, filepath: resolvedPath };
            if (useCache) {
                configCache.set(cacheKey, config, resolvedPath);
            }
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
                        if (useCache) {
                            configCache.set(cacheKey, config, filepath);
                        }
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
            useCache = true,
        } = options;
        return loadConfigInternal<T>(
            name,
            extensions,
            cwd,
            maxDepth,
            preferredPath,
            packageJsonProperty,
            useCache,
        );
    }
    const {
        name,
        extensions: exts = DEFAULT_EXTENSIONS,
        cwd = process.cwd(),
        maxDepth = 10,
        preferredPath,
        packageJsonProperty,
        useCache = true,
    } = nameOrOptions;
    return loadConfigInternal<T>(
        name,
        exts,
        cwd,
        maxDepth,
        preferredPath,
        packageJsonProperty,
        useCache,
    );
}

export function clearConfigCache(): void {
    configCache.clear();
    logger.debug("Configuration cache cleared");
}

export function getCacheStats(): {
    size: number;
    keys: string[];
} {
    return {
        size: configCache.size(),
        keys: Array.from(configCache.cache.keys()),
    };
}

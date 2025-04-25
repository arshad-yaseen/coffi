import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
    } catch (error) {
        logger.debug(`Error checking if file exists at ${filepath}: ${error}`);
        return false;
    }
}

async function parseConfigFile<T>(filepath: string): Promise<T | null> {
    try {
        // Ensure we have an absolute path
        const absolutePath = isAbsolute(filepath)
            ? filepath
            : resolve(filepath);

        if (!_exists(absolutePath)) {
            logger.debug(`File does not exist: ${absolutePath}`);
            return null;
        }

        const ext = extname(absolutePath).toLowerCase();

        if (ext === ".json") {
            try {
                const file = readFileSync(absolutePath, "utf-8");
                return JSON.parse(file) as T;
            } catch (error) {
                logger.debug(
                    `Error reading/parsing JSON file ${absolutePath}: ${error}`,
                );
                return null;
            }
        }

        try {
            // The URL conversion ensures compatibility with ESM
            const fileUrl = pathToFileURL(absolutePath).href;
            const module = await import(fileUrl);
            let config = module.default || module;

            if (typeof config === "function") {
                try {
                    config = config();
                } catch (error) {
                    logger.debug(
                        `Error executing config function from ${absolutePath}: ${error}`,
                    );
                    return null;
                }
            }

            if (config instanceof Promise) {
                try {
                    return (await config) as unknown as T;
                } catch (error) {
                    logger.debug(
                        `Error resolving config promise from ${absolutePath}: ${error}`,
                    );
                    return null;
                }
            }

            return config as T;
        } catch (error) {
            logger.debug(`Error importing module ${absolutePath}: ${error}`);
            return null;
        }
    } catch (error) {
        logger.debug(
            `Unexpected error parsing config file ${filepath}: ${error}`,
        );
        return null;
    }
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
    // Check package.json first if specified
    if (packageJsonProperty) {
        const packageJsonPath = findPackageJson(cwd, maxDepth);
        if (packageJsonPath) {
            logger.debug(
                `Found package.json at ${packageJsonPath}, checking for ${packageJsonProperty}`,
            );
            const packageJson =
                await parseConfigFile<Record<string, unknown>>(packageJsonPath);
            if (
                packageJson &&
                typeof packageJson === "object" &&
                packageJsonProperty in packageJson
            ) {
                logger.debug(
                    `Using configuration from package.json ${packageJsonProperty}`,
                );
                return {
                    config: packageJson[packageJsonProperty] as T,
                    filepath: packageJsonPath,
                };
            }
        }
    }

    // Check preferred path if specified
    if (preferredPath) {
        try {
            const resolvedPath = resolve(cwd, preferredPath);
            logger.debug(`Checking preferred path: ${resolvedPath}`);

            // First try the exact path
            let config = await parseConfigFile<T>(resolvedPath);
            let finalPath = resolvedPath;

            // If not found and no extension is provided, try with extensions
            if (config === null && !extname(resolvedPath)) {
                logger.debug(
                    "No file extension in preferred path, trying with extensions",
                );
                for (const ext of extensions) {
                    const pathWithExt = `${resolvedPath}${ext}`;
                    logger.debug(`Trying with extension: ${pathWithExt}`);
                    config = await parseConfigFile<T>(pathWithExt);
                    if (config !== null) {
                        logger.debug(`Found config at ${pathWithExt}`);
                        finalPath = pathWithExt;
                        break;
                    }
                }
            }

            if (config !== null) {
                logger.debug(`Successfully loaded config from ${finalPath}`);
                return { config, filepath: finalPath };
            }

            logger.warn(
                `Preferred path "${preferredPath}" not found or invalid, searching for ${name} files instead.`,
            );
        } catch (error) {
            logger.warn(
                `Error processing preferred path "${preferredPath}": ${error}. Searching for ${name} files instead.`,
            );
        }
    }

    // Search up the directory tree for config files
    logger.debug(`Searching for ${name} config files starting from ${cwd}`);
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
                    logger.debug(`Found potential config file: ${filepath}`);
                    const config = await parseConfigFile<T>(filepath);
                    if (config !== null) {
                        logger.debug(
                            `Successfully loaded config from ${filepath}`,
                        );
                        return { config, filepath };
                    }
                }
            }
        } catch (error) {
            logger.debug(`Error reading directory ${currentDir}: ${error}`);
        }

        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            logger.debug("Reached root directory, ending search");
            break;
        }
        currentDir = parentDir;
        currentDepth++;
    }

    logger.debug(
        `No config files found after searching ${currentDepth} directories up from ${cwd}`,
    );
    return { config: null, filepath: null };
}

/**
 * Load a configuration file.
 *
 * This function searches for a configuration file starting from the current working directory
 * and moving up the directory tree until it finds a matching file or reaches the maximum depth.
 */
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

        logger.debug(`Loading config for "${name}" from ${cwd}`);
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

    logger.debug(
        `Loading config for "${name}" from ${cwd} with custom options`,
    );
    return loadConfigInternal<T>(
        name,
        exts,
        cwd,
        maxDepth,
        preferredPath,
        packageJsonProperty,
    );
}

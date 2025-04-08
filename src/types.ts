export type Extention =
    | ".ts"
    | ".mts"
    | ".cts"
    | ".js"
    | ".mjs"
    | ".cjs"
    | ".json";

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
     * Defaults to [".ts", ".js", ".json"]
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

/**
 * Error thrown when a configuration file cannot be loaded.
 */
export class ConfigLoadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigLoadError";
    }
}

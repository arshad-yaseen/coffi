import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_EXTENSIONS } from "./defaults";
import {
  ConfigLoadError,
  type LoadConfigOptions,
  type LoadConfigResult,
} from "./types";
import { parseErrorMessage } from "./utils";

export * from "./types";

function _exists(filepath: string): boolean {
  try {
    return existsSync(filepath);
  } catch {
    return false;
  }
}

async function loadConfigInternal<T>(
  name: string,
  extensions: string[],
  cwd: string,
  maxDepth: number,
): Promise<LoadConfigResult<T>> {
  let currentDir = cwd;
  let currentDepth = 0;

  while (currentDepth < maxDepth) {
    for (const ext of extensions) {
      const filepath = join(currentDir, `${name}${ext}`);

      if (_exists(filepath)) {
        try {
          let config: T;

          if (ext === ".json") {
            const file = readFileSync(filepath, "utf-8");
            config = JSON.parse(file) as T;
          } else {
            const module = await import(`${filepath}?t=${Date.now()}`);
            config = module.default || module;

            if (typeof config === "function") {
              config = config();
            }

            if (config instanceof Promise) {
              config = await config;
            }
          }

          return { config, filepath };
        } catch (error) {
          throw new ConfigLoadError(
            `Failed to load config from ${filepath}: ${parseErrorMessage(
              error,
            )}`,
          );
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

  throw new ConfigLoadError(
    `Could not find config file '${name}' with extensions [${extensions.join(
      ", ",
    )}] within ${maxDepth} directories`,
  );
}

export async function loadConfig<T = unknown>(
  nameOrOptions: string | LoadConfigOptions,
  extensions: string[] = DEFAULT_EXTENSIONS,
  options: Omit<LoadConfigOptions, "name" | "extensions"> = {},
): Promise<LoadConfigResult<T>> {
  if (typeof nameOrOptions === "string") {
    const name = nameOrOptions;
    const { cwd = process.cwd(), maxDepth = 10 } = options;
    return loadConfigInternal<T>(name, extensions, cwd, maxDepth);
  }

  const {
    name,
    extensions: exts = DEFAULT_EXTENSIONS,
    cwd = process.cwd(),
    maxDepth = 10,
  } = nameOrOptions;
  return loadConfigInternal<T>(name, exts, cwd, maxDepth);
}

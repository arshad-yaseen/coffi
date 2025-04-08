# coffi

[![npm version](https://img.shields.io/npm/v/coffi.svg?style=flat-square)](https://www.npmjs.com/package/coffi)
[![npm downloads](https://img.shields.io/npm/dm/coffi.svg?style=flat-square)](https://www.npmjs.com/package/coffi)

⚡️ A fast, lightweight, easy-to-use, configuration files loader 📄

## Installation

```bash
npm install coffi
```

## Usage

### Basic Usage

```typescript
import { loadConfig } from "coffi";

// Loads config from the first matching file extension (see priority list below)
const { config, filepath } = await loadConfig("app.config");

// Or specify custom extensions to search for (in priority order)
const { config } = await loadConfig("app.config", [".json"]);
```

### File Priority

The loader checks files in this order:

1. `.ts` files
2. `.mts` files
3. `.cts` files
4. `.js` files
5. `.mjs` files
6. `.cjs` files
7. `.json` files

You can customize this order using the `extensions` option.

### With Options

```typescript
const { config } = await loadConfig({
  name: "database.config",
  extensions: [".js", ".json", ".ts"],
  cwd: path.join(__dirname, "config"),
  maxDepth: 1, // (set to 1 to search only in current directory)
});
```

### Error Handling

```typescript
import { loadConfig, ConfigLoadError } from "coffi";

try {
  const { config } = await loadConfig("app.config");
} catch (error) {
  if (error instanceof ConfigLoadError) {
    console.error("Config not found:", error.message);
  }
}
```

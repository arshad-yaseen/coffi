# conffig

[![npm version](https://img.shields.io/npm/v/conffig.svg?style=flat-square)](https://www.npmjs.com/package/conffig)
[![npm downloads](https://img.shields.io/npm/dm/conffig.svg?style=flat-square)](https://www.npmjs.com/package/conffig)

⚡️ A fast, easy-to-use, configuration files loader 📄

## Installation

```bash
npm install conffig
```

## Quick Start

```typescript
import { loadConfig } from "conffig";

// Load your config file
const { config } = await loadConfig("app.config");
```

## Usage

### Basic Usage

```typescript
// Loads app.config.ts, app.config.js, or app.config.json
const { config, filepath } = await loadConfig("app.config");
```

### File Priority

The loader checks files in this order:

1. `.ts` files
2. `.js` files
3. `.json` files

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
import { loadConfig, ConfigLoadError } from "conffig";

try {
  const { config } = await loadConfig("app.config");
} catch (error) {
  if (error instanceof ConfigLoadError) {
    console.error("Config not found:", error.message);
  }
}
```

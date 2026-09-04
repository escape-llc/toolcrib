# toolcrib-mcp

A local MCP (Model Context Protocol) server that reads an already-vendored
`toolcrib` install's `ai-docs/` content and exposes it to AI coding agents
as callable tools — `list_components`, `get_component`, `search_components`,
and more — instead of relying on an agent to read those files directly.

It ships **zero vendored content of its own**. It only ever reads whatever's
already sitting in the `./toolcrib/` folder it's pointed at, so it can never
describe a version newer than what's actually in your project.

This is purely additive: `toolcrib init`/`merge`/`doctor` and the static
`ai-docs/` files work exactly as they always have, with or without this
installed. Nothing here replaces them.

## Setup

Add it to your MCP host's config, pointed at your project's vendored
`toolcrib/` folder:

```json
{
  "mcpServers": {
    "toolcrib": {
      "command": "npx",
      "args": ["toolcrib-mcp", "--root", "./toolcrib"]
    }
  }
}
```

- **Claude Code**: project-level `.mcp.json` at your repo root.
- **Cursor**: `.cursor/mcp.json`.
- **Claude Desktop**: `claude_desktop_config.json` (see Claude Desktop's own
  docs for its location on your OS).

Omit `--root` to auto-detect: it walks upward from the current directory
looking for `toolcrib/.toolcrib-lock.json`.

## Tools

| Tool | What it returns |
|---|---|
| `get_install_info` | The exact vendored version and directory path this server is serving, plus `compatibilityWarning` (`null`, or a message) if that version is outside the range this server release has actually been verified against — see `src/lib/compatibility.js`. |
| `list_categories` | Every component category. |
| `list_components` | Component names + one-line descriptions, optionally filtered by category. |
| `get_component` | Full detail for one component — props, types, defaults, required flags, slots, constraints. |
| `search_components` | Fuzzy search across name/description/category — use this when you don't know the exact component name. |
| `list_examples` | The worked examples available for non-obvious mechanisms (event bus sticky replay, router integration, etc.). |
| `get_example` | One worked example's full content. |
| `get_core_doc` | `CORE.md`, whole or one section. |
| `get_event_channels` | The event bus's channel/payload reference and helper methods, or one channel by name. |
| `get_theme_system` | The theme system *reference* (CSS variable names/roles, supported harmonies, theme slices) and the z-index scale. This is documentation, not a live resolver — it does not compute actual CSS values for a given theme config. |

## Development

```
npm install
npm test              # unit tests, in-process, no subprocess spawned
node integration-test/run.mjs   # real subprocess + real MCP client, against this repo's own ai-docs/
```

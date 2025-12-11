<div align="center">

# opencode-beads

**Comprehensive beads (bd) issue tracker integration for OpenCode**

[![npm version](https://img.shields.io/npm/v/@simonwjackson/opencode-beads?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@simonwjackson/opencode-beads)
[![npm downloads](https://img.shields.io/npm/dm/@simonwjackson/opencode-beads?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@simonwjackson/opencode-beads)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-f9f1e1?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-8B5CF6?style=flat-square)](https://opencode.ai/)

---

*36 tools for managing issues, dependencies, epics, and more with the [beads](https://github.com/steveyegge/beads) issue tracker.*

[Installation](#installation) •
[Tools](#tools) •
[Usage](#usage) •
[Contributing](#contributing)

![Demo](demo.gif)

</div>

---

## Overview

opencode-beads provides a comprehensive set of tools for the beads (bd) git-native issue tracker, giving AI assistants full control over issue management with first-class dependency support.

### Key Features

- **36 Tools** — Complete coverage of beads functionality
- **Dependency Management** — First-class support for issue dependencies and blocking detection
- **Bulk Operations** — Update, close, or reopen multiple issues at once
- **Epic Support** — Organize issues into epics for better project management
- **AI Integration** — Dedicated `prime` command for AI-optimized context
- **JSON Output** — Structured output for reliable parsing

---

## Requirements

| Dependency | Version | Required | Notes |
|------------|---------|----------|-------|
| [OpenCode](https://opencode.ai/) | `>=1.0.0` | Yes | Plugin host environment |
| [beads (bd)](https://github.com/steveyegge/beads) | `0.1.x` | Yes | Tested version; must be available in PATH |
| [Bun](https://bun.sh/) | `>=1.0.0` | Yes | Runtime environment |
| TypeScript | `>=5.0.0` | Dev only | For building from source |

> **Note:** This plugin has only been tested with the JSONL backend. SQLite backend support is untested and may not work as expected.

---

## Installation

### Via OpenCode Config

Add the plugin to your OpenCode configuration — OpenCode handles installation automatically.

**Project-level** (`./opencode.json`):
```json
{
  "plugin": ["@simonwjackson/opencode-beads@latest"]
}
```

**Global** (`~/.config/opencode/opencode.json`):
```json
{
  "plugin": ["@simonwjackson/opencode-beads@latest"]
}
```

---

## Tools

### Core Issue Operations (7 tools)

| Tool | Description |
|------|-------------|
| `bd_list` | List issues with filters (status, label, priority, epic, assignee) |
| `bd_show` | Show detailed issue information |
| `bd_create` | Create new issues with dependencies |
| `bd_update` | Update issue fields |
| `bd_close` | Close one or more issues |
| `bd_reopen` | Reopen closed issues |
| `bd_delete_issue` | Delete issues and clean up references |

### Workflow (2 tools)

| Tool | Description |
|------|-------------|
| `bd_ready` | Show issues ready to work on (no blocking deps) |
| `bd_blocked` | Show issues blocked by dependencies |

### Search & Query (3 tools)

| Tool | Description |
|------|-------------|
| `bd_search` | Text search across titles and bodies |
| `bd_count` | Count issues matching filters |
| `bd_stale` | Find issues not updated recently |

### Comments (2 tools)

| Tool | Description |
|------|-------------|
| `bd_comment` | Add a comment to an issue |
| `bd_comments` | View comments on an issue |

### Labels (3 tools)

| Tool | Description |
|------|-------------|
| `bd_label_add` | Add a label to an issue |
| `bd_label_remove` | Remove a label from an issue |
| `bd_labels` | List all labels in the database |

### Dependencies (3 tools)

| Tool | Description |
|------|-------------|
| `bd_dep_add` | Add a dependency between issues |
| `bd_dep_remove` | Remove a dependency |
| `bd_deps` | List dependencies for an issue |

### Epics (3 tools)

| Tool | Description |
|------|-------------|
| `bd_epic_create` | Create a new epic |
| `bd_epics` | List all epics |
| `bd_epic_show` | Show epic details with child issues |

### Database & Sync (6 tools)

| Tool | Description |
|------|-------------|
| `bd_status` | Show database overview with counts |
| `bd_stats` | Show detailed statistics |
| `bd_sync` | Synchronize with git remote |
| `bd_info` | Show database and daemon information |
| `bd_validate` | Run database health checks |
| `bd_doctor` | Diagnose installation issues |

### Templates (2 tools)

| Tool | Description |
|------|-------------|
| `bd_templates` | List available templates |
| `bd_create_from_template` | Create issue from template |

### Maintenance (4 tools)

| Tool | Description |
|------|-------------|
| `bd_cleanup` | Delete old closed issues |
| `bd_compact` | Compact closed issues preserving git history |
| `bd_duplicates` | Find potentially duplicate issues |
| `bd_repair_deps` | Fix orphaned dependency references |

### AI Integration (1 tool)

| Tool | Description |
|------|-------------|
| `bd_prime` | Output AI-optimized workflow context |

---

## Usage

### Basic Workflow

```
User: Show me issues that are ready to work on
AI: [Uses bd_ready tool]

User: Create a new issue for implementing dark mode
AI: [Uses bd_create with title "Implement dark mode"]

User: This issue depends on issue abc123
AI: [Uses bd_dep_add to create dependency]

User: Mark issue xyz789 as complete
AI: [Uses bd_close tool]
```

### Dependency Management

The plugin excels at managing issue dependencies:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Dependency Workflow                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  bd_ready → Find issues with no blockers                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  bd_blocked → Find issues waiting on dependencies               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  bd_deps → View dependency graph for any issue                  │
└─────────────────────────────────────────────────────────────────┘
```

### Epic Organization

Group related issues into epics:

1. Create an epic: `bd_epic_create`
2. Assign issues to epic: `bd_update` with `epic` parameter
3. View epic progress: `bd_epic_show`

---

## How It Works

All tools execute the `bd` CLI command with appropriate flags and return JSON output for reliable parsing.

```typescript
// Example: bd_list implementation
const proc = Bun.spawn(["bd", "list", "--json", "--status", "open"])
const output = await new Response(proc.stdout).text()
return output
```

### Error Handling

Tools return structured error messages when commands fail:

```
Error: Issue not found: abc123
Error: Dependency would create a cycle
Error: .envrc is blocked (run `direnv allow` to fix)
```

---

## Troubleshooting

### Common Issues

**bd command not found**
```bash
# Verify beads is installed
which bd

# Check if bd is in PATH
echo $PATH
```

**No issues returned**
```bash
# Verify beads database exists
bd status

# Initialize if needed
bd init
```

**Permission errors**
```bash
# Check database directory permissions
ls -la .beads/
```

---

## Contributing

Contributions are welcome. Please read our contributing guidelines before submitting a pull request.

```bash
# Clone the repository
git clone https://github.com/simonwjackson/opencode-beads.git
cd opencode-beads

# Install dependencies
bun install

# Build
bun run build

# Type check
bun run typecheck
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-f9f1e1?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh/)

---

Made with care by [@simonwjackson](https://github.com/simonwjackson)

</div>

// Context documentation loader

export const BEADS_WORKFLOW_RULES = `
## TASK TRACKING RULES (READ FIRST)

**YOU MUST use \`bd\` (beads) for ALL task/issue tracking in this project.**

### MANDATORY FIRST STEP - BEFORE ANY WORK

**STOP. Before writing ANY code, reading files for implementation, or making changes:**

1. \`bd ready --json\` - Check for ready work first
2. \`bd create "task title" -t task -p 2 --json\` - Create the issue FIRST
3. \`bd update <id> --status in_progress --json\` - Mark it in progress
4. ONLY THEN start implementation

**This is NON-NEGOTIABLE. No exceptions. Create the bd issue BEFORE you start working.**

### PROHIBITED - Do NOT do these:

- **NEVER use the TodoWrite tool** - it creates markdown TODOs which are forbidden
- **NEVER create markdown TODO lists** or \`- [ ]\` task syntax in any file
- **NEVER create TODO.md, TASKS.md**, or similar tracking files
- **NEVER use external issue trackers**
- **NEVER start implementation without first creating a bd issue**

### REQUIRED - Do these instead:

- \`bd ready --json\` - Check for ready work
- \`bd create "title" -t task -p 2 --json\` - Create issues
- \`bd update <id> --status in_progress --json\` - Claim work
- \`bd close <id> --reason "Done" --json\` - Complete work

---

## bd Quick Reference

### Issue Types
\`bug\` | \`feature\` | \`task\` | \`epic\` | \`chore\`

### Priorities
\`0\` Critical | \`1\` High | \`2\` Medium | \`3\` Low | \`4\` Backlog

### Workflow
1. \`bd ready\` - Find unblocked work
2. \`bd update <id> --status in_progress\` - Claim it
3. Work on it
4. \`bd close <id> --reason "Done"\` - Complete it
5. Commit \`.beads/issues.jsonl\` with code changes
`

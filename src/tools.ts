import { tool } from "@opencode-ai/plugin/tool"

/**
 * Beads (bd) Issue Tracker Tools
 *
 * Comprehensive tooling for the bd issue tracker with first-class dependency support.
 * These tools provide a better UX than raw bash commands.
 *
 * Tools are organized into categories:
 * - Core Issue Operations: list, show, create, update, close, reopen, delete
 * - Workflow: ready, blocked
 * - Search & Query: search, count, stale
 * - Comments: comment, comments
 * - Labels: label_add, label_remove, labels
 * - Dependencies: dep_add, dep_remove, deps
 * - Epics: epic_create, epics, epic_show
 * - Database & Sync: status, stats, sync, info, validate, doctor
 * - Templates: templates, create_from_template
 * - Maintenance: cleanup, compact, duplicates, repair_deps
 * - AI Integration: prime
 */

// ============================================================================
// Helper function for consistent command execution
// ============================================================================

/**
 * Execute a bd command and return the output or error
 */
async function runBdCommand(
  args: string[],
  options: { successMessage?: string } = {}
): Promise<string> {
  const proc = Bun.spawn(["bd", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const output = await new Response(proc.stdout).text()
  const error = await new Response(proc.stderr).text()
  await proc.exited

  if (error && proc.exitCode !== 0) {
    return `Error: ${error}`
  }
  return output || options.successMessage || ""
}

// ============================================================================
// Core Issue Operations
// ============================================================================

/**
 * List issues from beads with optional filters.
 * Supports filtering by status, label, priority, epic, and assignee.
 */
export const bd_list = tool({
  description:
    "List issues from beads. Supports filtering by status, label, priority, and more.",
  args: {
    status: tool.schema
      .enum(["open", "closed", "in_progress", "all"])
      .optional()
      .describe("Filter by status (default: open)"),
    label: tool.schema.string().optional().describe("Filter by label"),
    priority: tool.schema
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("Filter by priority"),
    limit: tool.schema
      .number()
      .optional()
      .describe("Maximum number of issues to return"),
    epic: tool.schema.string().optional().describe("Filter by epic ID"),
    assignee: tool.schema.string().optional().describe("Filter by assignee"),
  },
  async execute(args) {
    const flags: string[] = ["--json"]
    if (args.status && args.status !== "all") flags.push(`--status`, args.status)
    if (args.label) flags.push(`--label`, args.label)
    if (args.priority) flags.push(`--priority`, args.priority)
    if (args.limit) flags.push(`--limit`, String(args.limit))
    if (args.epic) flags.push(`--epic`, args.epic)
    if (args.assignee) flags.push(`--assignee`, args.assignee)

    return runBdCommand(["list", ...flags], { successMessage: "No issues found" })
  },
})

/**
 * Show detailed information about a specific issue.
 * Returns JSON with all issue fields including dependencies.
 */
export const bd_show = tool({
  description: "Show detailed information about a specific issue.",
  args: {
    id: tool.schema.string().describe("Issue ID to show"),
  },
  async execute(args) {
    return runBdCommand(["show", args.id, "--json"])
  },
})

/**
 * Create a new issue in beads.
 * Supports setting title, body, priority, labels, epic, assignee, and dependencies.
 */
export const bd_create = tool({
  description: "Create a new issue in beads.",
  args: {
    title: tool.schema.string().describe("Issue title"),
    body: tool.schema.string().optional().describe("Issue body/description"),
    priority: tool.schema
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("Issue priority"),
    labels: tool.schema
      .string()
      .optional()
      .describe("Comma-separated labels to add"),
    epic: tool.schema.string().optional().describe("Epic ID to assign to"),
    assignee: tool.schema.string().optional().describe("Assignee name"),
    depends_on: tool.schema
      .string()
      .optional()
      .describe("Comma-separated issue IDs this depends on"),
  },
  async execute(args) {
    const flags: string[] = ["--title", args.title]
    if (args.body) flags.push("--body", args.body)
    if (args.priority) flags.push("--priority", args.priority)
    if (args.labels) {
      for (const label of args.labels.split(",")) {
        flags.push("--label", label.trim())
      }
    }
    if (args.epic) flags.push("--epic", args.epic)
    if (args.assignee) flags.push("--assignee", args.assignee)
    if (args.depends_on) {
      for (const dep of args.depends_on.split(",")) {
        flags.push("--depends-on", dep.trim())
      }
    }

    return runBdCommand(["create", ...flags], { successMessage: "Issue created" })
  },
})

/**
 * Update one or more issues.
 * Supports updating status, title, priority, assignee, and epic.
 */
export const bd_update = tool({
  description: "Update one or more issues.",
  args: {
    ids: tool.schema
      .string()
      .describe("Issue ID(s) to update (comma-separated for multiple)"),
    status: tool.schema
      .enum(["open", "in_progress", "closed"])
      .optional()
      .describe("New status"),
    title: tool.schema.string().optional().describe("New title"),
    priority: tool.schema
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("New priority"),
    assignee: tool.schema.string().optional().describe("New assignee"),
    epic: tool.schema.string().optional().describe("Epic ID to assign to"),
  },
  async execute(args) {
    const ids = args.ids.split(",").map((id) => id.trim())
    const flags: string[] = []
    if (args.status) flags.push("--status", args.status)
    if (args.title) flags.push("--title", args.title)
    if (args.priority) flags.push("--priority", args.priority)
    if (args.assignee) flags.push("--assignee", args.assignee)
    if (args.epic) flags.push("--epic", args.epic)

    return runBdCommand(["update", ...ids, ...flags], {
      successMessage: "Issue(s) updated",
    })
  },
})

/**
 * Close one or more issues.
 * Accepts comma-separated IDs for bulk operations.
 */
export const bd_close = tool({
  description: "Close one or more issues.",
  args: {
    ids: tool.schema
      .string()
      .describe("Issue ID(s) to close (comma-separated for multiple)"),
  },
  async execute(args) {
    const ids = args.ids.split(",").map((id) => id.trim())
    return runBdCommand(["close", ...ids], { successMessage: "Issue(s) closed" })
  },
})

/**
 * Reopen one or more closed issues.
 * Accepts comma-separated IDs for bulk operations.
 */
export const bd_reopen = tool({
  description: "Reopen one or more closed issues.",
  args: {
    ids: tool.schema
      .string()
      .describe("Issue ID(s) to reopen (comma-separated for multiple)"),
  },
  async execute(args) {
    const ids = args.ids.split(",").map((id) => id.trim())
    return runBdCommand(["reopen", ...ids], { successMessage: "Issue(s) reopened" })
  },
})

/**
 * Delete one or more issues and clean up references.
 * This permanently removes issues from the database.
 */
export const bd_delete_issue = tool({
  description: "Delete one or more issues and clean up references.",
  args: {
    ids: tool.schema
      .string()
      .describe("Issue ID(s) to delete (comma-separated for multiple)"),
  },
  async execute(args) {
    const ids = args.ids.split(",").map((id) => id.trim())
    return runBdCommand(["delete", ...ids], { successMessage: "Issue(s) deleted" })
  },
})

// ============================================================================
// Workflow
// ============================================================================

/**
 * Show issues that are ready to work on.
 * Returns open or in-progress issues with no blocking dependencies.
 */
export const bd_ready = tool({
  description:
    "Show issues that are ready to work on (open or in-progress with no blocking dependencies).",
  args: {
    limit: tool.schema
      .number()
      .optional()
      .describe("Maximum number of issues to return"),
  },
  async execute(args) {
    const flags: string[] = ["--json"]
    if (args.limit) flags.push(`--limit`, String(args.limit))

    return runBdCommand(["ready", ...flags], { successMessage: "No ready issues" })
  },
})

/**
 * Show issues that are blocked by dependencies.
 * These issues cannot be worked on until their dependencies are resolved.
 */
export const bd_blocked = tool({
  description: "Show issues that are blocked by dependencies.",
  args: {
    limit: tool.schema
      .number()
      .optional()
      .describe("Maximum number of issues to return"),
  },
  async execute(args) {
    const flags: string[] = ["--json"]
    if (args.limit) flags.push(`--limit`, String(args.limit))

    return runBdCommand(["blocked", ...flags], { successMessage: "No blocked issues" })
  },
})

// ============================================================================
// Search & Query
// ============================================================================

/**
 * Search issues by text query.
 * Searches across titles and bodies.
 */
export const bd_search = tool({
  description: "Search issues by text query across titles and bodies.",
  args: {
    query: tool.schema.string().describe("Search query text"),
    limit: tool.schema
      .number()
      .optional()
      .describe("Maximum number of results"),
  },
  async execute(args) {
    const flags: string[] = ["--json"]
    if (args.limit) flags.push(`--limit`, String(args.limit))

    return runBdCommand(["search", args.query, ...flags], {
      successMessage: "No matching issues",
    })
  },
})

/**
 * Count issues matching filters.
 * Returns the number of matching issues.
 */
export const bd_count = tool({
  description: "Count issues matching filters.",
  args: {
    status: tool.schema
      .enum(["open", "closed", "in_progress", "all"])
      .optional()
      .describe("Filter by status"),
    label: tool.schema.string().optional().describe("Filter by label"),
    priority: tool.schema
      .enum(["critical", "high", "medium", "low"])
      .optional()
      .describe("Filter by priority"),
  },
  async execute(args) {
    const flags: string[] = []
    if (args.status && args.status !== "all") flags.push(`--status`, args.status)
    if (args.label) flags.push(`--label`, args.label)
    if (args.priority) flags.push(`--priority`, args.priority)

    const result = await runBdCommand(["count", ...flags])
    return result.trim()
  },
})

/**
 * Show stale issues that haven't been updated recently.
 * Useful for identifying issues that may need attention.
 */
export const bd_stale = tool({
  description: "Show stale issues (not updated recently).",
  args: {
    days: tool.schema
      .number()
      .optional()
      .describe("Number of days to consider stale (default: 7)"),
    limit: tool.schema
      .number()
      .optional()
      .describe("Maximum number of issues to return"),
  },
  async execute(args) {
    const flags: string[] = ["--json"]
    if (args.days) flags.push(`--days`, String(args.days))
    if (args.limit) flags.push(`--limit`, String(args.limit))

    return runBdCommand(["stale", ...flags], { successMessage: "No stale issues" })
  },
})

// ============================================================================
// Comments
// ============================================================================

/**
 * Add a comment to an issue.
 * Comments are timestamped and stored with the issue.
 */
export const bd_comment = tool({
  description: "Add a comment to an issue.",
  args: {
    id: tool.schema.string().describe("Issue ID to comment on"),
    body: tool.schema.string().describe("Comment text"),
  },
  async execute(args) {
    return runBdCommand(["comment", args.id, "--body", args.body], {
      successMessage: "Comment added",
    })
  },
})

/**
 * View comments on an issue.
 * Returns all comments in JSON format.
 */
export const bd_comments = tool({
  description: "View comments on an issue.",
  args: {
    id: tool.schema.string().describe("Issue ID to view comments for"),
  },
  async execute(args) {
    return runBdCommand(["comments", args.id, "--json"], {
      successMessage: "No comments",
    })
  },
})

// ============================================================================
// Labels
// ============================================================================

/**
 * Add a label to an issue.
 * Labels can be used for categorization and filtering.
 */
export const bd_label_add = tool({
  description: "Add a label to an issue.",
  args: {
    id: tool.schema.string().describe("Issue ID"),
    label: tool.schema.string().describe("Label to add"),
  },
  async execute(args) {
    return runBdCommand(["label", "add", args.id, args.label], {
      successMessage: "Label added",
    })
  },
})

/**
 * Remove a label from an issue.
 */
export const bd_label_remove = tool({
  description: "Remove a label from an issue.",
  args: {
    id: tool.schema.string().describe("Issue ID"),
    label: tool.schema.string().describe("Label to remove"),
  },
  async execute(args) {
    return runBdCommand(["label", "remove", args.id, args.label], {
      successMessage: "Label removed",
    })
  },
})

/**
 * List all labels used in the database.
 * Returns unique labels across all issues.
 */
export const bd_labels = tool({
  description: "List all labels used in the database.",
  args: {},
  async execute() {
    return runBdCommand(["label", "list", "--json"], { successMessage: "No labels" })
  },
})

// ============================================================================
// Dependencies
// ============================================================================

/**
 * Add a dependency between issues.
 * Issue A depends on issue B means A cannot be completed until B is done.
 */
export const bd_dep_add = tool({
  description: "Add a dependency (issue A depends on issue B).",
  args: {
    id: tool.schema.string().describe("Issue ID that has the dependency"),
    depends_on: tool.schema
      .string()
      .describe("Issue ID that must be completed first"),
  },
  async execute(args) {
    return runBdCommand(["dep", "add", args.id, args.depends_on], {
      successMessage: "Dependency added",
    })
  },
})

/**
 * Remove a dependency between issues.
 */
export const bd_dep_remove = tool({
  description: "Remove a dependency between issues.",
  args: {
    id: tool.schema.string().describe("Issue ID that has the dependency"),
    depends_on: tool.schema
      .string()
      .describe("Issue ID to remove from dependencies"),
  },
  async execute(args) {
    return runBdCommand(["dep", "remove", args.id, args.depends_on], {
      successMessage: "Dependency removed",
    })
  },
})

/**
 * List dependencies for an issue.
 * Shows both what the issue depends on and what depends on it.
 */
export const bd_deps = tool({
  description: "List dependencies for an issue.",
  args: {
    id: tool.schema.string().describe("Issue ID to show dependencies for"),
  },
  async execute(args) {
    return runBdCommand(["dep", "list", args.id, "--json"], {
      successMessage: "No dependencies",
    })
  },
})

// ============================================================================
// Epics
// ============================================================================

/**
 * Create a new epic to group related issues.
 * Epics are high-level containers for organizing issues.
 */
export const bd_epic_create = tool({
  description: "Create a new epic to group related issues.",
  args: {
    title: tool.schema.string().describe("Epic title"),
    body: tool.schema.string().optional().describe("Epic description"),
  },
  async execute(args) {
    const flags: string[] = ["--title", args.title]
    if (args.body) flags.push("--body", args.body)

    return runBdCommand(["epic", "create", ...flags], {
      successMessage: "Epic created",
    })
  },
})

/**
 * List all epics.
 * Optionally filter by status.
 */
export const bd_epics = tool({
  description: "List all epics.",
  args: {
    status: tool.schema
      .enum(["open", "closed", "all"])
      .optional()
      .describe("Filter by status"),
  },
  async execute(args) {
    const flags: string[] = ["--json"]
    if (args.status && args.status !== "all") flags.push(`--status`, args.status)

    return runBdCommand(["epic", "list", ...flags], { successMessage: "No epics" })
  },
})

/**
 * Show epic details including child issues.
 * Returns the epic with all associated issues.
 */
export const bd_epic_show = tool({
  description: "Show epic details including child issues.",
  args: {
    id: tool.schema.string().describe("Epic ID"),
  },
  async execute(args) {
    return runBdCommand(["epic", "show", args.id, "--json"])
  },
})

// ============================================================================
// Database & Sync
// ============================================================================

/**
 * Show issue database overview.
 * Returns counts by status and other summary information.
 */
export const bd_status = tool({
  description: "Show issue database overview with counts by status.",
  args: {},
  async execute() {
    return runBdCommand(["status", "--json"])
  },
})

/**
 * Show detailed statistics about issues.
 * Includes breakdowns by priority, labels, and more.
 */
export const bd_stats = tool({
  description: "Show detailed statistics about issues.",
  args: {},
  async execute() {
    return runBdCommand(["stats", "--json"])
  },
})

/**
 * Synchronize issues with git remote.
 * Pushes and pulls issue changes.
 */
export const bd_sync = tool({
  description: "Synchronize issues with git remote.",
  args: {},
  async execute() {
    return runBdCommand(["sync"], { successMessage: "Sync completed" })
  },
})

/**
 * Show database and daemon information.
 * Returns paths, daemon status, and configuration.
 */
export const bd_info = tool({
  description: "Show database and daemon information.",
  args: {},
  async execute() {
    return runBdCommand(["info", "--json"])
  },
})

/**
 * Run comprehensive database health checks.
 * Validates data integrity and reports any issues.
 */
export const bd_validate = tool({
  description: "Run comprehensive database health checks.",
  args: {},
  async execute() {
    return runBdCommand(["validate", "--json"])
  },
})

/**
 * Check beads installation health and diagnose issues.
 * Useful for troubleshooting setup problems.
 */
export const bd_doctor = tool({
  description: "Check beads installation health and diagnose issues.",
  args: {},
  async execute() {
    return runBdCommand(["doctor"])
  },
})

// ============================================================================
// Templates
// ============================================================================

/**
 * List available issue templates.
 * Templates provide pre-configured issue structures.
 */
export const bd_templates = tool({
  description: "List available issue templates.",
  args: {},
  async execute() {
    return runBdCommand(["template", "list", "--json"], {
      successMessage: "No templates",
    })
  },
})

/**
 * Create an issue from a template.
 * Templates can have variables that are substituted at creation time.
 */
export const bd_create_from_template = tool({
  description: "Create an issue from a template.",
  args: {
    template: tool.schema.string().describe("Template name"),
    title: tool.schema.string().describe("Issue title"),
    variables: tool.schema
      .string()
      .optional()
      .describe("Template variables as key=value pairs, comma-separated"),
  },
  async execute(args) {
    const flags: string[] = ["--template", args.template, "--title", args.title]
    if (args.variables) {
      for (const v of args.variables.split(",")) {
        flags.push("--var", v.trim())
      }
    }

    return runBdCommand(["create", ...flags], {
      successMessage: "Issue created from template",
    })
  },
})

// ============================================================================
// Maintenance
// ============================================================================

/**
 * Delete closed issues from database to free up space.
 * Optionally only cleanup issues closed before a certain date.
 */
export const bd_cleanup = tool({
  description: "Delete closed issues from database to free up space.",
  args: {
    older_than: tool.schema
      .number()
      .optional()
      .describe("Only cleanup issues closed more than N days ago"),
  },
  async execute(args) {
    const flags: string[] = []
    if (args.older_than) flags.push(`--older-than`, String(args.older_than))

    return runBdCommand(["cleanup", ...flags], { successMessage: "Cleanup completed" })
  },
})

/**
 * Compact old closed issues to save space.
 * Preserves history in git while reducing database size.
 */
export const bd_compact = tool({
  description:
    "Compact old closed issues to save space while preserving history in git.",
  args: {
    older_than: tool.schema
      .number()
      .optional()
      .describe("Only compact issues closed more than N days ago"),
  },
  async execute(args) {
    const flags: string[] = []
    if (args.older_than) flags.push(`--older-than`, String(args.older_than))

    return runBdCommand(["compact", ...flags], { successMessage: "Compact completed" })
  },
})

/**
 * Find potentially duplicate issues.
 * Uses similarity matching to identify duplicates.
 */
export const bd_duplicates = tool({
  description: "Find potentially duplicate issues.",
  args: {
    threshold: tool.schema
      .number()
      .optional()
      .describe("Similarity threshold 0-100 (default: 80)"),
  },
  async execute(args) {
    const flags: string[] = ["--json"]
    if (args.threshold) flags.push(`--threshold`, String(args.threshold))

    return runBdCommand(["duplicates", ...flags], {
      successMessage: "No duplicates found",
    })
  },
})

/**
 * Find and fix orphaned dependency references.
 * Dependencies can become orphaned when issues are deleted.
 */
export const bd_repair_deps = tool({
  description: "Find and fix orphaned dependency references.",
  args: {
    fix: tool.schema
      .boolean()
      .optional()
      .describe("Actually fix the issues (default: dry-run)"),
  },
  async execute(args) {
    const flags: string[] = []
    if (args.fix) flags.push("--fix")

    return runBdCommand(["repair-deps", ...flags], {
      successMessage: "No orphaned dependencies",
    })
  },
})

// ============================================================================
// AI Integration
// ============================================================================

/**
 * Output AI-optimized workflow context.
 * Provides a summary of the current beads state for AI assistants.
 */
export const bd_prime = tool({
  description:
    "Output AI-optimized workflow context for understanding the current beads state.",
  args: {},
  async execute() {
    return runBdCommand(["prime"])
  },
})

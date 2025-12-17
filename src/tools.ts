import { tool } from "@opencode-ai/plugin/tool";

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
// Types
// ============================================================================

/**
 * Shell command builder type (matches Bun's shell API pattern)
 */
type ShellCommand = {
	quiet: () => ShellCommand;
	cwd: (dir: string) => ShellCommand;
	text: () => Promise<string>;
	nothrow: () => ShellCommand;
};

/**
 * Shell executor function type (Bun's $ template literal)
 */
export type ShellExecutor = (
	strings: TemplateStringsArray,
	...values: unknown[]
) => ShellCommand;

/**
 * Function to run bd commands
 */
export type BdRunner = (
	args: readonly string[],
	options?: { successMessage?: string },
) => Promise<string>;

/**
 * Create a bd command runner using the provided shell executor
 */
export function createBdRunner(shell: ShellExecutor, cwd: string): BdRunner {
	return async (
		args: readonly string[],
		options: { successMessage?: string } = {},
	): Promise<string> => {
		try {
			// Build the command string with proper escaping
			const cmdArgs = args.map((arg) => {
				// Escape special characters in arguments
				if (arg.includes(" ") || arg.includes('"') || arg.includes("'")) {
					return `"${arg.replace(/"/g, '\\"')}"`;
				}
				return arg;
			});
			const cmdString = ["bd", ...cmdArgs].join(" ");

			// Use sh -c to execute the command string properly
			// Bun's $ template treats interpolated values as single arguments,
			// so we need sh -c to parse the full command string
			const result = await shell`sh -c ${cmdString}`.cwd(cwd).nothrow().text();

			return result || options.successMessage || "";
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return `Error: ${message}`;
		}
	};
}

// ============================================================================
// Tool Factories - Core Issue Operations
// ============================================================================

export const createBdList = (runBd: BdRunner) =>
	tool({
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
			const flags: string[] = ["--json"];
			if (args.status && args.status !== "all")
				flags.push("--status", args.status);
			if (args.label) flags.push("--label", args.label);
			if (args.priority) flags.push("--priority", args.priority);
			if (args.limit) flags.push("--limit", String(args.limit));
			if (args.epic) flags.push("--epic", args.epic);
			if (args.assignee) flags.push("--assignee", args.assignee);

			return runBd(["list", ...flags], { successMessage: "No issues found" });
		},
	});

export const createBdShow = (runBd: BdRunner) =>
	tool({
		description: "Show detailed information about a specific issue.",
		args: {
			id: tool.schema.string().describe("Issue ID to show"),
		},
		async execute(args) {
			return runBd(["show", args.id, "--json"]);
		},
	});

/**
 * Map human-readable priority names to bd's P0-P4 format
 */
const priorityMap: Record<string, string> = {
	critical: "P0",
	high: "P1",
	medium: "P2",
	low: "P3",
};

export const createBdCreate = (runBd: BdRunner) =>
	tool({
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
			// Title is positional, description uses -d flag
			const flags: string[] = [];
			if (args.body) flags.push("-d", args.body);
			if (args.priority) {
				const mappedPriority = priorityMap[args.priority] ?? "P2";
				flags.push("--priority", mappedPriority);
			}
			if (args.labels) {
				for (const label of args.labels.split(",")) {
					flags.push("--label", label.trim());
				}
			}
			if (args.epic) flags.push("--epic", args.epic);
			if (args.assignee) flags.push("-a", args.assignee);
			if (args.depends_on) {
				for (const dep of args.depends_on.split(",")) {
					flags.push("--deps", dep.trim());
				}
			}

			return runBd(["create", args.title, ...flags], {
				successMessage: "Issue created",
			});
		},
	});

export const createBdUpdate = (runBd: BdRunner) =>
	tool({
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
			const ids = args.ids.split(",").map((id) => id.trim());
			const flags: string[] = [];
			if (args.status) flags.push("--status", args.status);
			if (args.title) flags.push("--title", args.title);
			if (args.priority) {
				const mappedPriority = priorityMap[args.priority] ?? "P2";
				flags.push("--priority", mappedPriority);
			}
			if (args.assignee) flags.push("-a", args.assignee);
			if (args.epic) flags.push("--epic", args.epic);

			return runBd(["update", ...ids, ...flags], {
				successMessage: "Issue(s) updated",
			});
		},
	});

export const createBdClose = (runBd: BdRunner) =>
	tool({
		description: "Close one or more issues.",
		args: {
			ids: tool.schema
				.string()
				.describe("Issue ID(s) to close (comma-separated for multiple)"),
		},
		async execute(args) {
			const ids = args.ids.split(",").map((id) => id.trim());
			return runBd(["close", ...ids], { successMessage: "Issue(s) closed" });
		},
	});

export const createBdReopen = (runBd: BdRunner) =>
	tool({
		description: "Reopen one or more closed issues.",
		args: {
			ids: tool.schema
				.string()
				.describe("Issue ID(s) to reopen (comma-separated for multiple)"),
		},
		async execute(args) {
			const ids = args.ids.split(",").map((id) => id.trim());
			return runBd(["reopen", ...ids], { successMessage: "Issue(s) reopened" });
		},
	});

export const createBdDeleteIssue = (runBd: BdRunner) =>
	tool({
		description: "Delete one or more issues and clean up references.",
		args: {
			ids: tool.schema
				.string()
				.describe("Issue ID(s) to delete (comma-separated for multiple)"),
		},
		async execute(args) {
			const ids = args.ids.split(",").map((id) => id.trim());
			return runBd(["delete", ...ids, "--force"], {
				successMessage: "Issue(s) deleted",
			});
		},
	});

// ============================================================================
// Tool Factories - Workflow
// ============================================================================

export const createBdReady = (runBd: BdRunner) =>
	tool({
		description:
			"Show issues that are ready to work on (open or in-progress with no blocking dependencies).",
		args: {
			limit: tool.schema
				.number()
				.optional()
				.describe("Maximum number of issues to return"),
		},
		async execute(args) {
			const flags: string[] = ["--json"];
			if (args.limit) flags.push("--limit", String(args.limit));

			return runBd(["ready", ...flags], { successMessage: "No ready issues" });
		},
	});

export const createBdBlocked = (runBd: BdRunner) =>
	tool({
		description: "Show issues that are blocked by dependencies.",
		args: {
			limit: tool.schema
				.number()
				.optional()
				.describe("Maximum number of issues to return"),
		},
		async execute(args) {
			const flags: string[] = ["--json"];
			if (args.limit) flags.push("--limit", String(args.limit));

			return runBd(["blocked", ...flags], {
				successMessage: "No blocked issues",
			});
		},
	});

// ============================================================================
// Tool Factories - Search & Query
// ============================================================================

export const createBdSearch = (runBd: BdRunner) =>
	tool({
		description: "Search issues by text query across titles and bodies.",
		args: {
			query: tool.schema.string().describe("Search query text"),
			limit: tool.schema
				.number()
				.optional()
				.describe("Maximum number of results"),
		},
		async execute(args) {
			const flags: string[] = ["--json"];
			if (args.limit) flags.push("--limit", String(args.limit));

			return runBd(["search", args.query, ...flags], {
				successMessage: "No matching issues",
			});
		},
	});

export const createBdCount = (runBd: BdRunner) =>
	tool({
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
			const flags: string[] = [];
			if (args.status && args.status !== "all")
				flags.push("--status", args.status);
			if (args.label) flags.push("--label", args.label);
			if (args.priority) flags.push("--priority", args.priority);

			const result = await runBd(["count", ...flags]);
			return result.trim();
		},
	});

export const createBdStale = (runBd: BdRunner) =>
	tool({
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
			const flags: string[] = ["--json"];
			if (args.days) flags.push("--days", String(args.days));
			if (args.limit) flags.push("--limit", String(args.limit));

			return runBd(["stale", ...flags], { successMessage: "No stale issues" });
		},
	});

// ============================================================================
// Tool Factories - Comments
// ============================================================================

export const createBdComment = (runBd: BdRunner) =>
	tool({
		description: "Add a comment to an issue.",
		args: {
			id: tool.schema.string().describe("Issue ID to comment on"),
			body: tool.schema.string().describe("Comment text"),
		},
		async execute(args) {
			return runBd(["comment", args.id, "--body", args.body], {
				successMessage: "Comment added",
			});
		},
	});

export const createBdComments = (runBd: BdRunner) =>
	tool({
		description: "View comments on an issue.",
		args: {
			id: tool.schema.string().describe("Issue ID to view comments for"),
		},
		async execute(args) {
			return runBd(["comments", args.id, "--json"], {
				successMessage: "No comments",
			});
		},
	});

// ============================================================================
// Tool Factories - Labels
// ============================================================================

export const createBdLabelAdd = (runBd: BdRunner) =>
	tool({
		description: "Add a label to an issue.",
		args: {
			id: tool.schema.string().describe("Issue ID"),
			label: tool.schema.string().describe("Label to add"),
		},
		async execute(args) {
			return runBd(["label", "add", args.id, args.label], {
				successMessage: "Label added",
			});
		},
	});

export const createBdLabelRemove = (runBd: BdRunner) =>
	tool({
		description: "Remove a label from an issue.",
		args: {
			id: tool.schema.string().describe("Issue ID"),
			label: tool.schema.string().describe("Label to remove"),
		},
		async execute(args) {
			return runBd(["label", "remove", args.id, args.label], {
				successMessage: "Label removed",
			});
		},
	});

export const createBdLabels = (runBd: BdRunner) =>
	tool({
		description: "List all labels used in the database.",
		args: {},
		async execute() {
			return runBd(["label", "list-all", "--json"], {
				successMessage: "No labels",
			});
		},
	});

// ============================================================================
// Tool Factories - Dependencies
// ============================================================================

export const createBdDepAdd = (runBd: BdRunner) =>
	tool({
		description: "Add a dependency (issue A depends on issue B).",
		args: {
			id: tool.schema.string().describe("Issue ID that has the dependency"),
			depends_on: tool.schema
				.string()
				.describe("Issue ID that must be completed first"),
		},
		async execute(args) {
			return runBd(["dep", "add", args.id, args.depends_on], {
				successMessage: "Dependency added",
			});
		},
	});

export const createBdDepRemove = (runBd: BdRunner) =>
	tool({
		description: "Remove a dependency between issues.",
		args: {
			id: tool.schema.string().describe("Issue ID that has the dependency"),
			depends_on: tool.schema
				.string()
				.describe("Issue ID to remove from dependencies"),
		},
		async execute(args) {
			return runBd(["dep", "remove", args.id, args.depends_on], {
				successMessage: "Dependency removed",
			});
		},
	});

export const createBdDeps = (runBd: BdRunner) =>
	tool({
		description: "List dependencies for an issue.",
		args: {
			id: tool.schema.string().describe("Issue ID to show dependencies for"),
		},
		async execute(args) {
			return runBd(["dep", "tree", args.id], {
				successMessage: "No dependencies",
			});
		},
	});

// ============================================================================
// Tool Factories - Epics
// ============================================================================

export const createBdEpicCreate = (runBd: BdRunner) =>
	tool({
		description: "Create a new epic to group related issues.",
		args: {
			title: tool.schema.string().describe("Epic title"),
			body: tool.schema.string().optional().describe("Epic description"),
		},
		async execute(args) {
			// Epics are issues with --type epic
			const flags: string[] = ["--type", "epic"];
			if (args.body) flags.push("--body", args.body);

			return runBd(["create", args.title, ...flags], {
				successMessage: "Epic created",
			});
		},
	});

export const createBdEpics = (runBd: BdRunner) =>
	tool({
		description: "List all epics.",
		args: {
			status: tool.schema
				.enum(["open", "closed", "all"])
				.optional()
				.describe("Filter by status"),
		},
		async execute(args) {
			// Epics are issues with type=epic
			const flags: string[] = ["--type", "epic", "--json"];
			if (args.status && args.status !== "all")
				flags.push("--status", args.status);

			return runBd(["list", ...flags], { successMessage: "No epics" });
		},
	});

export const createBdEpicShow = (runBd: BdRunner) =>
	tool({
		description: "Show epic details including child issues.",
		args: {
			id: tool.schema.string().describe("Epic ID"),
		},
		async execute(args) {
			// Use show command which displays dependents (child issues)
			return runBd(["show", args.id, "--json"]);
		},
	});

// ============================================================================
// Tool Factories - Database & Sync
// ============================================================================

export const createBdStatus = (runBd: BdRunner) =>
	tool({
		description: "Show issue database overview with counts by status.",
		args: {},
		async execute() {
			return runBd(["status", "--json"]);
		},
	});

export const createBdStats = (runBd: BdRunner) =>
	tool({
		description: "Show detailed statistics about issues.",
		args: {},
		async execute() {
			return runBd(["stats", "--json"]);
		},
	});

export const createBdSync = (runBd: BdRunner) =>
	tool({
		description: "Synchronize issues with git remote.",
		args: {},
		async execute() {
			return runBd(["sync"], { successMessage: "Sync completed" });
		},
	});

export const createBdInfo = (runBd: BdRunner) =>
	tool({
		description: "Show database and daemon information.",
		args: {},
		async execute() {
			return runBd(["info", "--json"]);
		},
	});

export const createBdValidate = (runBd: BdRunner) =>
	tool({
		description: "Run comprehensive database health checks.",
		args: {},
		async execute() {
			return runBd(["validate", "--json"]);
		},
	});

export const createBdDoctor = (runBd: BdRunner) =>
	tool({
		description: "Check beads installation health and diagnose issues.",
		args: {},
		async execute() {
			return runBd(["doctor"]);
		},
	});

// ============================================================================
// Tool Factories - Templates
// ============================================================================

export const createBdTemplates = (runBd: BdRunner) =>
	tool({
		description: "List available issue templates.",
		args: {},
		async execute() {
			return runBd(["template", "list", "--json"], {
				successMessage: "No templates",
			});
		},
	});

export const createBdCreateFromTemplate = (runBd: BdRunner) =>
	tool({
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
			const flags: string[] = [
				"--template",
				args.template,
				"--title",
				args.title,
			];
			if (args.variables) {
				for (const v of args.variables.split(",")) {
					flags.push("--var", v.trim());
				}
			}

			return runBd(["create", ...flags], {
				successMessage: "Issue created from template",
			});
		},
	});

// ============================================================================
// Tool Factories - Maintenance
// ============================================================================

export const createBdCleanup = (runBd: BdRunner) =>
	tool({
		description: "Delete closed issues from database to free up space.",
		args: {
			older_than: tool.schema
				.number()
				.optional()
				.describe("Only cleanup issues closed more than N days ago"),
		},
		async execute(args) {
			const flags: string[] = [];
			if (args.older_than) flags.push("--older-than", String(args.older_than));

			return runBd(["cleanup", ...flags], {
				successMessage: "Cleanup completed",
			});
		},
	});

export const createBdCompact = (runBd: BdRunner) =>
	tool({
		description:
			"Compact old closed issues to save space while preserving history in git.",
		args: {
			older_than: tool.schema
				.number()
				.optional()
				.describe("Only compact issues closed more than N days ago"),
		},
		async execute(args) {
			const flags: string[] = [];
			if (args.older_than) flags.push("--older-than", String(args.older_than));

			return runBd(["compact", ...flags], {
				successMessage: "Compact completed",
			});
		},
	});

export const createBdDuplicates = (runBd: BdRunner) =>
	tool({
		description: "Find potentially duplicate issues.",
		args: {
			threshold: tool.schema
				.number()
				.optional()
				.describe("Similarity threshold 0-100 (default: 80)"),
		},
		async execute(args) {
			const flags: string[] = ["--json"];
			if (args.threshold) flags.push("--threshold", String(args.threshold));

			return runBd(["duplicates", ...flags], {
				successMessage: "No duplicates found",
			});
		},
	});

export const createBdRepairDeps = (runBd: BdRunner) =>
	tool({
		description: "Find and fix orphaned dependency references.",
		args: {
			fix: tool.schema
				.boolean()
				.optional()
				.describe("Actually fix the issues (default: dry-run)"),
		},
		async execute(args) {
			const flags: string[] = [];
			if (args.fix) flags.push("--fix");

			return runBd(["repair-deps", ...flags], {
				successMessage: "No orphaned dependencies",
			});
		},
	});

// ============================================================================
// Tool Factories - AI Integration
// ============================================================================

export const createBdPrime = (runBd: BdRunner) =>
	tool({
		description:
			"Output AI-optimized workflow context for understanding the current beads state.",
		args: {},
		async execute() {
			return runBd(["prime"]);
		},
	});

// ============================================================================
// All Tool Factories Export
// ============================================================================

/**
 * Create all beads tools using the provided bd runner
 */
export function createAllTools(runBd: BdRunner) {
	return {
		bd_list: createBdList(runBd),
		bd_show: createBdShow(runBd),
		bd_create: createBdCreate(runBd),
		bd_update: createBdUpdate(runBd),
		bd_close: createBdClose(runBd),
		bd_reopen: createBdReopen(runBd),
		bd_delete_issue: createBdDeleteIssue(runBd),
		bd_ready: createBdReady(runBd),
		bd_blocked: createBdBlocked(runBd),
		bd_search: createBdSearch(runBd),
		bd_count: createBdCount(runBd),
		bd_stale: createBdStale(runBd),
		bd_comment: createBdComment(runBd),
		bd_comments: createBdComments(runBd),
		bd_label_add: createBdLabelAdd(runBd),
		bd_label_remove: createBdLabelRemove(runBd),
		bd_labels: createBdLabels(runBd),
		bd_dep_add: createBdDepAdd(runBd),
		bd_dep_remove: createBdDepRemove(runBd),
		bd_deps: createBdDeps(runBd),
		bd_epic_create: createBdEpicCreate(runBd),
		bd_epics: createBdEpics(runBd),
		bd_epic_show: createBdEpicShow(runBd),
		bd_status: createBdStatus(runBd),
		bd_stats: createBdStats(runBd),
		bd_sync: createBdSync(runBd),
		bd_info: createBdInfo(runBd),
		bd_validate: createBdValidate(runBd),
		bd_doctor: createBdDoctor(runBd),
		bd_templates: createBdTemplates(runBd),
		bd_create_from_template: createBdCreateFromTemplate(runBd),
		bd_cleanup: createBdCleanup(runBd),
		bd_compact: createBdCompact(runBd),
		bd_duplicates: createBdDuplicates(runBd),
		bd_repair_deps: createBdRepairDeps(runBd),
		bd_prime: createBdPrime(runBd),
	};
}

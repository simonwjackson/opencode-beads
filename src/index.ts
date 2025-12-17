/**
 * OpenCode Beads Plugin
 *
 * A comprehensive plugin for the beads (bd) issue tracker.
 * Provides 36 tools for managing issues, dependencies, epics, and more.
 *
 * The plugin automatically:
 * - Provides bd_* tools for issue management
 * - Injects context on session start when .beads directory exists
 * - Warns when todowrite is used (suggests using beads instead)
 *
 * Exports:
 * - BeadsPlugin: Main plugin with tools + guard (recommended)
 * - BeadsGuardPlugin: Guard-only plugin (for custom setups)
 */

import type { Plugin } from "@opencode-ai/plugin";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createAllTools, createBdRunner, type ShellExecutor } from "./tools.js";

// Re-export utilities only (NOT BeadsGuardPlugin to prevent double-loading)
// BeadsGuardPlugin functionality is now integrated into BeadsPlugin
// For standalone guard use: import { BeadsGuardPlugin } from "@simonwjackson/opencode-beads/guard"
export { hasBeadsDirectory, hasBeadsIssues } from "./guard/index.js";

// ============================================================================
// Toast Configuration
// ============================================================================

type ToastVariant = "success" | "info" | "warning" | "error";
type ToastConfig = { message: string; variant: ToastVariant };

/**
 * Try to parse issue ID from bd command output (JSON or plain text)
 */
const parseIssueId = (result: string): string | null => {
	try {
		const parsed: unknown = JSON.parse(result);
		if (typeof parsed === "object" && parsed !== null && "id" in parsed) {
			const obj = parsed as { id: unknown };
			if (typeof obj.id === "string") return obj.id;
		}
	} catch {
		// Try to extract ID from plain text (e.g., "Created issue abc123")
		const match = result.match(/([a-f0-9]{6,})/i);
		if (match) return match[1];
	}
	return null;
};

/**
 * Count items in a comma-separated string
 */
const countIds = (ids: unknown): number => {
	if (typeof ids !== "string") return 0;
	return ids.split(",").filter((id) => id.trim()).length;
};

/**
 * Format count with plural/singular
 */
const pluralize = (
	count: number,
	singular: string,
	plural?: string,
): string => {
	return count === 1 ? singular : (plural ?? `${singular}s`);
};

/**
 * Get toast configuration for a tool execution
 */
const getToastConfig = (
	tool: string,
	args: Record<string, unknown>,
	result: string,
): ToastConfig | null => {
	// Skip read-only operations (no toast needed)
	const readOnlyTools = new Set([
		"bd_list",
		"bd_show",
		"bd_search",
		"bd_count",
		"bd_stale",
		"bd_comments",
		"bd_labels",
		"bd_deps",
		"bd_epics",
		"bd_epic_show",
		"bd_status",
		"bd_stats",
		"bd_info",
		"bd_templates",
		"bd_duplicates",
		"bd_ready",
		"bd_blocked",
		"bd_prime",
	]);

	if (readOnlyTools.has(tool)) return null;

	// Tool-specific toast configurations
	const configs: Record<string, () => ToastConfig> = {
		// Core Issue Operations
		bd_create: () => {
			const id = parseIssueId(result);
			return {
				message: `Issue created${id ? `: ${id}` : ""}`,
				variant: "success",
			};
		},
		bd_update: () => {
			const count = countIds(args.ids);
			return {
				message: `${count} ${pluralize(count, "issue")} updated`,
				variant: "success",
			};
		},
		bd_close: () => {
			const count = countIds(args.ids);
			return {
				message: `${count} ${pluralize(count, "issue")} closed`,
				variant: "success",
			};
		},
		bd_reopen: () => {
			const count = countIds(args.ids);
			return {
				message: `${count} ${pluralize(count, "issue")} reopened`,
				variant: "success",
			};
		},
		bd_delete_issue: () => {
			const count = countIds(args.ids);
			return {
				message: `${count} ${pluralize(count, "issue")} deleted`,
				variant: "success",
			};
		},

		// Comments
		bd_comment: () => ({
			message: `Comment added to ${args.id}`,
			variant: "success",
		}),

		// Labels
		bd_label_add: () => ({
			message: `Label "${args.label}" added to ${args.id}`,
			variant: "success",
		}),
		bd_label_remove: () => ({
			message: `Label "${args.label}" removed from ${args.id}`,
			variant: "success",
		}),

		// Dependencies
		bd_dep_add: () => ({
			message: `Dependency added: ${args.id} → ${args.depends_on}`,
			variant: "success",
		}),
		bd_dep_remove: () => ({
			message: `Dependency removed: ${args.id} → ${args.depends_on}`,
			variant: "success",
		}),

		// Epics
		bd_epic_create: () => {
			const title = typeof args.title === "string" ? args.title : "";
			const shortTitle = title.length > 30 ? `${title.slice(0, 30)}...` : title;
			return {
				message: `Epic created: ${shortTitle}`,
				variant: "success",
			};
		},

		// Database & Sync
		bd_sync: () => ({
			message: "Beads synced with remote",
			variant: "info",
		}),
		bd_validate: () => ({
			message: "Database validation complete",
			variant: "info",
		}),
		bd_doctor: () => ({
			message: "Health check complete",
			variant: "info",
		}),

		// Templates
		bd_create_from_template: () => {
			const id = parseIssueId(result);
			return {
				message: `Issue created from template${id ? `: ${id}` : ""}`,
				variant: "success",
			};
		},

		// Maintenance
		bd_cleanup: () => ({
			message: "Cleanup completed",
			variant: "info",
		}),
		bd_compact: () => ({
			message: "Database compacted",
			variant: "info",
		}),
		bd_repair_deps: () => ({
			message: args.fix ? "Dependencies repaired" : "Dependency check complete",
			variant: "info",
		}),
	};

	return configs[tool]?.() ?? null;
};

// ============================================================================
// Guard Configuration
// ============================================================================

/**
 * Context message injected when beads is detected
 */
const BEADS_CONTEXT = `
<system-reminder>
## Issue Tracking with Beads

This project uses **beads** for issue tracking. The \`.beads\` directory contains the issue database.

### Required Behavior:
1. **Use bd_* tools** for all task management instead of the todowrite tool
2. **Check existing issues** with \`bd_list\` before creating new work
3. **Update issue status** as you work (open → in_progress → closed)
4. **Link related issues** with dependencies when appropriate

### Quick Reference:
- \`bd_list\` - List issues (filter by status, priority, label)
- \`bd_ready\` - Show issues ready to work on (no blockers)
- \`bd_create\` - Create new issue
- \`bd_update\` - Update issue (status, priority, assignee)
- \`bd_close\` - Close completed issues
- \`bd_show\` - View issue details
- \`bd_epics\` - List epics
- \`bd_search\` - Search issues by text

### Workflow:
1. Start session → \`bd_ready\` to see what's actionable
2. Pick an issue → \`bd_update\` status to in_progress
3. Complete work → \`bd_close\` the issue
4. New task needed? → \`bd_create\` (not todowrite!)

**Do NOT use the todowrite tool** - use beads (bd_*) tools instead.
</system-reminder>
`.trim();

/**
 * Warning shown when todowrite is used
 */
const TODOWRITE_WARNING =
	"This project uses beads for issue tracking. Consider using bd_create instead of todowrite.";

/**
 * Type guard for session.created event
 */
type SessionCreatedEvent = {
	type: "session.created";
	properties: {
		info: {
			id: string;
		};
	};
};

const isSessionCreatedEvent = (
	event: unknown,
): event is SessionCreatedEvent => {
	if (typeof event !== "object" || event === null) return false;
	const e = event as Record<string, unknown>;
	if (e.type !== "session.created") return false;
	if (typeof e.properties !== "object" || e.properties === null) return false;
	const props = e.properties as Record<string, unknown>;
	if (typeof props.info !== "object" || props.info === null) return false;
	const info = props.info as Record<string, unknown>;
	return typeof info.id === "string";
};

// ============================================================================
// Plugin Definition
// ============================================================================

export const BeadsPlugin: Plugin = async ({ client, $, directory }) => {
	// Cast $ to our ShellExecutor type (it's Bun's shell API)
	const shell = $ as unknown as ShellExecutor;

	// Validate directory is a string (defensive check for plugin API issues)
	if (typeof directory !== "string") {
		console.error(
			"[BeadsPlugin] directory is not a string:",
			typeof directory,
			directory,
		);
		return {};
	}

	// Create the bd runner with the shell executor and working directory
	const runBd = createBdRunner(shell, directory);

	// Create all tools using the runner
	const tools = createAllTools(runBd);

	// Check if beads is initialized in this project
	const beadsPath = join(directory, ".beads");
	const beadsExists = existsSync(beadsPath);

	// Track sessions we've already injected context into
	const injectedSessions = new Set<string>();

	return {
		tool: tools,

		event: async ({ event }) => {
			// Only inject context if beads exists
			if (!beadsExists) return;

			// Inject context when a new session is created
			if (isSessionCreatedEvent(event)) {
				const sessionId = event.properties.info.id;

				// Avoid duplicate injections
				if (injectedSessions.has(sessionId)) return;
				injectedSessions.add(sessionId);

				try {
					// Inject beads context without triggering AI response
					await client.session.prompt({
						path: { id: sessionId },
						body: {
							noReply: true,
							parts: [{ type: "text", text: BEADS_CONTEXT }],
						},
					});

					// Show a toast to the user
					await client.tui.showToast({
						body: {
							message: "Beads detected - use bd_* tools for task management",
							variant: "info",
						},
					});
				} catch (error) {
					// Silently fail - don't break the session
					console.error("[BeadsPlugin] Failed to inject context:", error);
				}
			}
		},

		"tool.execute.before": async (input) => {
			// Warn when todowrite is used in a beads project
			if (input.tool === "todowrite" && beadsExists) {
				try {
					await client.tui.showToast({
						body: {
							message: TODOWRITE_WARNING,
							variant: "warning",
						},
					});
				} catch {
					// Silently fail
				}
			}
		},

		"tool.execute.after": async (input, output) => {
			// Handle bd_* tools
			if (input.tool.startsWith("bd_")) {
				const result = typeof output.output === "string" ? output.output : "";

				// Check for errors first
				if (result.startsWith("Error:")) {
					await client.tui.showToast({
						body: {
							message: result.slice(0, 100), // Truncate long errors
							variant: "error",
						},
					});
					return;
				}

				// Get toast config for this tool - args come from metadata
				const metadata = output.metadata as Record<string, unknown> | undefined;
				const args = (metadata?.args ?? {}) as Record<string, unknown>;
				const toastConfig = getToastConfig(input.tool, args, result);

				if (toastConfig) {
					await client.tui.showToast({
						body: toastConfig,
					});
				}
			}

			// After todowrite, remind about beads
			if (input.tool === "todowrite" && beadsExists) {
				if (typeof output.output === "string") {
					output.output = `${output.output}\n\n💡 Tip: This project uses beads for issue tracking. Consider using bd_create for persistent task management.`;
				}
			}
		},
	};
};

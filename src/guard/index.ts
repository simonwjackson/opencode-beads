/**
 * BeadsGuardPlugin
 *
 * Enforces beads usage when a .beads directory exists in the project.
 * - Injects context on session creation reminding to use beads
 * - Intercepts todowrite tool calls and suggests using beads instead
 * - Shows toast notifications for guidance
 */

import type { Plugin } from "@opencode-ai/plugin";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
 * Message shown when todowrite is intercepted
 */
const TODOWRITE_WARNING =
	"This project uses beads for issue tracking. Consider using bd_create instead of todowrite for persistent task management.";

/**
 * Check if beads is initialized in the directory
 */
const hasBeadsDirectory = (directory: unknown): boolean => {
	if (typeof directory !== "string") {
		console.error("[BeadsGuard] directory is not a string:", typeof directory, directory);
		return false;
	}
	const beadsPath = join(directory, ".beads");
	return existsSync(beadsPath);
};

/**
 * Check if beads has any issues (not just initialized)
 */
const hasBeadsIssues = (directory: unknown): boolean => {
	if (typeof directory !== "string") {
		return false;
	}
	const issuesPath = join(directory, ".beads", "issues.jsonl");
	if (!existsSync(issuesPath)) return false;

	try {
		const content = readFileSync(issuesPath, "utf-8");
		return content.trim().length > 0;
	} catch {
		return false;
	}
};

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

/**
 * BeadsGuardPlugin - Enforces beads usage in projects with .beads directory
 */
export const BeadsGuardPlugin: Plugin = async ({ client, directory }) => {
	const beadsExists = hasBeadsDirectory(directory);

	if (!beadsExists) {
		// No beads directory, plugin does nothing
		return {};
	}

	// Track sessions we've already injected context into
	const injectedSessions = new Set<string>();

	return {
		event: async ({ event }) => {
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
					console.error("[BeadsGuard] Failed to inject context:", error);
				}
			}
		},

		"tool.execute.before": async (input) => {
			// Intercept todowrite calls and warn about beads
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
			// After todowrite, remind about beads
			if (input.tool === "todowrite" && beadsExists) {
				// Modify output to include reminder
				if (typeof output.output === "string") {
					output.output = `${output.output}\n\n💡 Tip: This project uses beads for issue tracking. Consider using bd_create for persistent task management.`;
				}
			}
		},
	};
};

// Re-export for convenience
export { hasBeadsDirectory, hasBeadsIssues };

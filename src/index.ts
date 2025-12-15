/**
 * OpenCode Beads Plugin
 *
 * A comprehensive plugin for the beads (bd) issue tracker.
 * Provides 36 tools for managing issues, dependencies, epics, and more.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { createAllTools, createBdRunner, type ShellExecutor } from "./tools.js";

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
// Plugin Definition
// ============================================================================

export const BeadsPlugin: Plugin = async ({ client, $, directory }) => {
	// Cast $ to our ShellExecutor type (it's Bun's shell API)
	const shell = $ as unknown as ShellExecutor;

	// Create the bd runner with the shell executor and working directory
	const runBd = createBdRunner(shell, directory);

	// Create all tools using the runner
	const tools = createAllTools(runBd);

	return {
		tool: tools,

		"tool.execute.after": async (input, output) => {
			// Only handle bd_* tools from this plugin
			if (!input.tool.startsWith("bd_")) return;

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
		},
	};
};

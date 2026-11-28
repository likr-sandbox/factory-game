// WebMCP Panel UI - Pure TypeScript, ZERO Phaser dependencies
import type { WebMcpHandle } from "../webmcp/types";

/**
 * Mounts the collapsible Japanese WebMCP status and real-time call log panel.
 * @param container - The container element to mount the panel into
 * @param handle - The WebMCP handle for status and log subscription
 * @returns Unsubscribe/cleanup function
 */
export function mountWebMcpPanel(container: HTMLElement, handle: WebMcpHandle): () => void {
  const doc = container.ownerDocument;

  // Create panel wrapper
  const panel = doc.createElement("div");
  panel.className = "webmcp-panel";

  // Header with title and toggle
  const header = doc.createElement("div");
  header.className = "webmcp-panel-header";

  const title = doc.createElement("span");
  title.className = "webmcp-panel-title";
  title.textContent = "WebMCP 連携";

  const toggleBtn = doc.createElement("button");
  toggleBtn.className = "webmcp-panel-toggle";
  toggleBtn.textContent = "折りたたみ";
  toggleBtn.setAttribute("aria-expanded", "true");

  header.appendChild(title);
  header.appendChild(toggleBtn);
  panel.appendChild(header);

  // Content area (status + log list)
  const content = doc.createElement("div");
  content.className = "webmcp-panel-content";

  // Compact status badge for collapsed view
  const badge = doc.createElement("span");
  badge.className = "webmcp-panel-badge";
  badge.textContent = handle.detected ? "接続済み" : "手動";

  // Status text (full description shown when expanded)
  const status = doc.createElement("div");
  status.className = "webmcp-panel-status";
  updateStatus();

  // Log list container
  const logList = doc.createElement("ul");
  logList.className = "webmcp-panel-log-list";

  content.appendChild(badge);
  content.appendChild(status);
  content.appendChild(logList);
  panel.appendChild(content);

  // Initial render of existing logs
  renderLogs(handle.getLogs());

  // Toggle collapse/expand
  let isExpanded = false;
  content.style.display = "none";
  toggleBtn.textContent = "展開";
  toggleBtn.setAttribute("aria-expanded", "false");
  panel.classList.add("collapsed");
  toggleBtn.addEventListener("click", () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
      content.style.display = "";
      toggleBtn.textContent = "折りたたみ";
      toggleBtn.setAttribute("aria-expanded", "true");
      panel.classList.remove("collapsed");
    } else {
      content.style.display = "none";
      toggleBtn.textContent = "展開";
      toggleBtn.setAttribute("aria-expanded", "false");
      panel.classList.add("collapsed");
    }
  });

  // Subscribe to real-time log updates
  const unsubscribe = handle.subscribe((entry) => {
    addLogEntry(entry);
  });

  // Append panel to container
  container.appendChild(panel);

  /**
   * Update status badge based on handle.detected state
   */
  function updateStatus(): void {
    if (handle.detected) {
      status.textContent = `WebMCP 接続済み (${handle.source})`;
    } else {
      status.textContent = "WebMCP 未検出（手動プレイモード）";
    }
  }

  /**
   * Render all existing log entries
   */
  function renderLogs(entries: readonly unknown[]): void {
    logList.innerHTML = "";
    for (const entry of entries) {
      // Type assertion based on ToolCallLogEntry structure
      const typedEntry = entry as {
        id: number;
        timestamp: string;
        toolName: string;
        success: boolean;
        durationMs: number;
        resultSummary: string;
      };
      addLogEntryInternal(typedEntry);
    }
  }

  /**
   * Add a new log entry to the list
   */
  function addLogEntry(entry: unknown): void {
    const typedEntry = entry as {
      id: number;
      timestamp: string;
      toolName: string;
      success: boolean;
      durationMs: number;
      resultSummary: string;
    };
    addLogEntryInternal(typedEntry);
  }

  /**
   * Internal helper to create and append a log entry element
   */
  function addLogEntryInternal(entry: {
    id: number;
    timestamp: string;
    toolName: string;
    success: boolean;
    durationMs: number;
    resultSummary: string;
  }): void {
    const li = doc.createElement("li");
    li.className = "webmcp-log-entry";

    const time = doc.createElement("span");
    time.className = "webmcp-log-time";
    time.textContent = formatTimestamp(entry.timestamp);

    const tool = doc.createElement("span");
    tool.className = "webmcp-log-tool";
    tool.textContent = entry.toolName;

    const statusSpan = doc.createElement("span");
    statusSpan.className = "webmcp-log-status";
    statusSpan.textContent = entry.success ? "成功" : "失敗";

    const duration = doc.createElement("span");
    duration.className = "webmcp-log-duration";
    duration.textContent = `${Math.round(entry.durationMs)}ms`;

    const summary = doc.createElement("span");
    summary.className = "webmcp-log-summary";
    summary.textContent = entry.resultSummary;

    li.appendChild(time);
    li.appendChild(tool);
    li.appendChild(statusSpan);
    li.appendChild(duration);
    li.appendChild(summary);

    logList.appendChild(li);
  }

  /**
   * Format ISO timestamp to readable Japanese format
   */
  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString("ja-JP", { hour12: false });
  }

  // Cleanup function
  return () => {
    unsubscribe();
    if (panel.parentNode === container) {
      container.removeChild(panel);
    }
  };
}

import { isTempUploadId, TobyFlowCanvasAdapter } from "@/lib/canvas/tobyflow-adapter";
import { useWorkflowEditorStore } from "@/stores/canvas/use-workflow-editor-store";
import type { CanvasConnection, CanvasNodeData } from "@/types/canvas";

export type PreflightResult = {
    ok: boolean;
    skipped?: boolean;
    error?: string;
    warnings?: string[];
};

type ExportNode = Record<string, unknown> & {
    node_id?: string;
    node_type?: string;
    node_name?: string;
    enabled?: boolean;
    ref_file_ids?: string;
    ref_thumbnails?: Record<string, string>;
    ref_file_names?: Record<string, string>;
    provider?: string;
    use_ai?: boolean;
};

type ProviderStatus = {
    ready?: boolean;
    error?: string;
    tabId?: number;
    cloudflareChallenge?: boolean;
};

function extensionWindow() {
    return window as Window & {
        ApiBaseConfig?: {
            shouldUseRemoteApi?: () => boolean;
            isExtensionOnly?: () => boolean;
            isLocalDev?: () => boolean;
        };
        I18n?: { t?: (key: string, fallback?: string) => string };
        ProviderMeta?: { getName?: (key: string) => string };
        customDialog?: {
            confirm?: (msg: string, opts?: Record<string, unknown>) => Promise<boolean>;
            alert?: (msg: string, opts?: Record<string, unknown>) => void;
        };
        MessageBridge?: {
            checkTilesExist?: (ids: string[]) => Promise<{ missing?: string[] } | null>;
            stopExecution?: () => Promise<void>;
        };
        workflowExecutor?: {
            isRunning?: boolean;
            shouldStop?: boolean;
            stop?: (broadcast?: boolean) => void;
        };
        WorkflowExecutor?: { clearCrossContextRunning?: () => Promise<void> };
        ChatGPTSession?: {
            ensureReady?: (opts?: Record<string, unknown>) => Promise<{ ready?: boolean; error?: string; tabId?: number }>;
            ensureTabActive?: (opts?: Record<string, unknown>) => Promise<unknown>;
            _ready?: boolean;
            _lastCheck?: number;
        };
        GrokSession?: {
            ensureReady?: (opts?: Record<string, unknown>) => Promise<{ ready?: boolean; error?: string; tabId?: number }>;
            ensureTabActive?: (opts?: Record<string, unknown>) => Promise<unknown>;
            checkStatus?: () => Promise<{ loggedIn?: boolean; cloudflareChallenge?: boolean }>;
            _ready?: boolean;
            _lastCheck?: number;
        };
        GeminiSession?: {
            ensureReady?: (opts?: Record<string, unknown>) => Promise<{ ready?: boolean; error?: string; tabId?: number }>;
        };
        reuploadMissingFiles?: (refStr: string, thumbMap: Record<string, string>, a?: unknown, fileNames?: Record<string, string>) => Promise<string>;
        _currentProjectId?: string;
        chrome?: {
            runtime?: {
                sendMessage: (msg: Record<string, unknown>, cb?: (r: unknown) => void) => void;
                lastError?: { message?: string };
            };
        };
        showNotification?: (msg: string, type?: string, duration?: number) => void;
    };
}

export function exportNodesForExecution(nodes: CanvasNodeData[], connections: CanvasConnection[]): ExportNode[] {
    const { nodes: exportNodes } = TobyFlowCanvasAdapter.canvasToSaveExport(
        { nodes, connections },
        {
            wf_id: useWorkflowEditorStore.getState().workflowId || undefined,
            wf_name: useWorkflowEditorStore.getState().workflowName || "Workflow",
            workflowBase: useWorkflowEditorStore.getState().workflowBase || undefined,
            legacyMode: useWorkflowEditorStore.getState().legacyMode,
        },
    );
    return exportNodes.filter((n) => n.node_type !== "note" && n.node_type !== "start") as ExportNode[];
}

function collectProviders(nodes: ExportNode[]) {
    const providers = new Set<string>();
    for (const node of nodes) {
        if (node.enabled === false) continue;
        const nodeType = node.node_type as string;
        if (nodeType === "image" || nodeType === "generate") providers.add("flow");
        else if (nodeType === "chatgpt") providers.add((node.provider as string) || "chatgpt");
        else if (nodeType === "grok") providers.add("grok");
        else if (nodeType === "prompt" && node.use_ai === true) providers.add((node.provider as string) || "chatgpt");
    }
    return providers;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

function providerLabel(provider: string) {
    const win = extensionWindow();
    const PM = win.ProviderMeta;
    const labels: Record<string, string> = {
        flow: PM?.getName?.("flow") || "Google Flow",
        chatgpt: PM?.getName?.("chatgpt") || "ChatGPT",
        grok: PM?.getName?.("grok") || "Grok",
        gemini: PM?.getName?.("gemini") || "Gemini",
    };
    return labels[provider] || provider;
}

function sendBg(action: string, extra: Record<string, unknown> = {}, timeoutMs = 8000): Promise<Record<string, unknown> | null> {
    const win = extensionWindow();
    return withTimeout(
        new Promise<Record<string, unknown> | null>((resolve) => {
            try {
                win.chrome?.runtime?.sendMessage?.({ action, ...extra }, (r) => {
                    if (win.chrome?.runtime?.lastError) {
                        resolve(null);
                        return;
                    }
                    resolve((r as Record<string, unknown>) || null);
                });
            } catch {
                resolve(null);
            }
        }),
        timeoutMs,
        null,
    );
}

/**
 * Check status only — KHÔNG tạo tab mới (createIfMissing: false).
 * Dùng cho poll / hiển thị badge.
 */
async function checkProviderStatus(provider: string): Promise<ProviderStatus> {
    const win = extensionWindow();
    try {
        if (provider === "flow") {
            const resp = await sendBg("checkFlowTabOpen", {}, 3000);
            return {
                ready: Boolean(resp?.isOpen),
                tabId: typeof resp?.tabId === "number" ? resp.tabId : undefined,
                error: resp?.isOpen ? undefined : "NO_TAB",
            };
        }
        if (provider === "chatgpt") {
            if (!win.ChatGPTSession?.ensureReady) return { ready: false, error: "SESSION_NOT_FOUND" };
            const result = await withTimeout(
                win.ChatGPTSession.ensureReady({ createIfMissing: false, activate: false, silent: true }).catch(() => ({ ready: false, error: "CHECK_FAILED" })),
                6000,
                { ready: false, error: "CHECK_TIMEOUT" },
            );
            return { ready: result?.ready === true, tabId: result?.tabId, error: result?.ready ? undefined : result?.error };
        }
        if (provider === "grok") {
            if (!win.GrokSession?.ensureReady) return { ready: false, error: "SESSION_NOT_FOUND" };
            // Prefer checkStatus if available (Cloudflare detect)
            if (win.GrokSession.checkStatus) {
                const status = await withTimeout(
                    win.GrokSession.checkStatus().catch(() => ({ loggedIn: false })),
                    6000,
                    { loggedIn: false },
                );
                if (status?.cloudflareChallenge) {
                    return { ready: false, error: "CLOUDFLARE", cloudflareChallenge: true };
                }
                if (status?.loggedIn) return { ready: true };
            }
            const result = await withTimeout(
                win.GrokSession.ensureReady({ createIfMissing: false, activate: false, silent: true }).catch(() => ({ ready: false, error: "CHECK_FAILED" })),
                6000,
                { ready: false, error: "CHECK_TIMEOUT" },
            );
            return { ready: result?.ready === true, tabId: result?.tabId, error: result?.ready ? undefined : result?.error };
        }
        if (provider === "gemini") {
            if (!win.GeminiSession?.ensureReady) return { ready: false, error: "SESSION_NOT_FOUND" };
            const result = await withTimeout(
                win.GeminiSession.ensureReady({ createIfMissing: false, activate: false, silent: true }).catch(() => ({ ready: false, error: "CHECK_FAILED" })),
                6000,
                { ready: false, error: "CHECK_TIMEOUT" },
            );
            return { ready: result?.ready === true, tabId: result?.tabId, error: result?.ready ? undefined : result?.error };
        }
    } catch (err) {
        return { ready: false, error: err instanceof Error ? err.message : "CHECK_ERROR" };
    }
    return { ready: false, error: "UNKNOWN_PROVIDER" };
}

/**
 * Mở / kích hoạt tab provider — logic giống WorkflowEditor + WorkflowExecutor.
 * createIfMissing: true → tự mở chatgpt.com / flow / grok nếu chưa có.
 */
async function activateProvider(provider: string): Promise<ProviderStatus> {
    const win = extensionWindow();
    console.log("[TobyFlowPreflight] activating provider:", provider);
    try {
        if (provider === "flow") {
            // ensureFlowTabActive: tìm tab Flow hoặc mở mới + active
            const resp = await sendBg("ensureFlowTabActive", {}, 12000);
            const open = await sendBg("checkFlowTabOpen", {}, 3000);
            return {
                ready: Boolean(open?.isOpen || resp?.ok || resp?.success || resp?.tabId),
                tabId: (open?.tabId as number) || (resp?.tabId as number) || undefined,
                error: open?.isOpen ? undefined : "NO_TAB",
            };
        }
        if (provider === "chatgpt" && win.ChatGPTSession?.ensureReady) {
            // Default ensureReady: createIfMissing=true, activate=true → mở tab chatgpt.com
            const result = await withTimeout(win.ChatGPTSession.ensureReady({ createIfMissing: true, activate: true, focusWindow: false, silent: true }), 20000, { ready: false, error: "OPEN_TIMEOUT" });
            // Optional: navigate homepage (nếu có)
            try {
                await win.ChatGPTSession.ensureTabActive?.({ forceRefresh: false, focusWindow: false });
            } catch {
                /* ignore */
            }
            return { ready: result?.ready === true, tabId: result?.tabId, error: result?.ready ? undefined : result?.error };
        }
        if (provider === "grok" && win.GrokSession?.ensureReady) {
            const result = await withTimeout(win.GrokSession.ensureReady({ createIfMissing: true, activate: true, focusWindow: false, silent: true }), 20000, { ready: false, error: "OPEN_TIMEOUT" });
            try {
                if (win.GrokSession.ensureTabActive) {
                    await win.GrokSession.ensureTabActive({ forceRefresh: true, focusWindow: false });
                    win.GrokSession._ready = false;
                    win.GrokSession._lastCheck = 0;
                }
            } catch {
                /* ignore */
            }
            return { ready: result?.ready === true, tabId: result?.tabId, error: result?.ready ? undefined : result?.error };
        }
        if (provider === "gemini" && win.GeminiSession?.ensureReady) {
            const result = await withTimeout(win.GeminiSession.ensureReady({ createIfMissing: true, activate: true, focusWindow: false, silent: true }), 20000, { ready: false, error: "OPEN_TIMEOUT" });
            return { ready: result?.ready === true, tabId: result?.tabId, error: result?.ready ? undefined : result?.error };
        }
        return { ready: false, error: "SESSION_NOT_FOUND" };
    } catch (err) {
        console.warn("[TobyFlowPreflight] activate failed:", provider, err);
        return { ready: false, error: err instanceof Error ? err.message : "ACTIVATE_ERROR" };
    }
}

/**
 * Modal preflight giống WorkflowEditor._preflightCheck:
 * - Auto-open tab chưa sẵn sàng
 * - Poll status realtime
 * - User bấm "Chạy" / "Hủy"
 */
function showProviderPreflightModal(providers: Set<string>, initialStatus: Record<string, ProviderStatus>): Promise<PreflightResult> {
    const win = extensionWindow();
    const t = (key: string, fallback: string) => win.I18n?.t?.(key, fallback) || fallback;

    return new Promise<PreflightResult>((resolve) => {
        // Inject minimal styles (popup infinite-canvas không load tobyflow.css)
        const styleId = "tobyflow-preflight-styles";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
              .tf-preflight-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font-family:system-ui,-apple-system,sans-serif}
              .tf-preflight-modal{background:#1c1c1f;color:#f5f5f4;border:1px solid #333;border-radius:12px;min-width:340px;max-width:92vw;box-shadow:0 16px 48px rgba(0,0,0,.45);overflow:hidden}
              .tf-preflight-header{padding:14px 16px;border-bottom:1px solid #2a2a2e;font-weight:600;font-size:14px}
              .tf-preflight-body{padding:14px 16px;display:flex;flex-direction:column;gap:8px}
              .tf-preflight-hint{font-size:12px;color:#a1a1aa;margin:0 0 4px}
              .tf-preflight-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:8px;background:#252528;font-size:13px}
              .tf-preflight-row.is-ready{border:1px solid rgba(34,197,94,.35)}
              .tf-preflight-row.is-warn{border:1px solid rgba(245,158,11,.35)}
              .tf-preflight-row.is-check{border:1px solid rgba(161,161,170,.25)}
              .tf-preflight-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #2a2a2e}
              .tf-preflight-btn{border:0;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer}
              .tf-preflight-btn.secondary{background:#2a2a2e;color:#e4e4e7}
              .tf-preflight-btn.primary{background:#d3b525;color:#111}
              .tf-preflight-btn:disabled{opacity:.5;cursor:not-allowed}
              @keyframes tf-spin{to{transform:rotate(360deg)}}
              .tf-spin{animation:tf-spin 1s linear infinite;display:inline-block}
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement("div");
        overlay.className = "tf-preflight-overlay";
        overlay.innerHTML = `
          <div class="tf-preflight-modal" role="dialog" aria-modal="true">
            <div class="tf-preflight-header">${t("workflow.preflightTitle", "Kiểm tra AI Provider")}</div>
            <div class="tf-preflight-body">
              <p class="tf-preflight-hint">Đang mở tab provider nếu chưa có (ChatGPT / Flow / Grok)…</p>
              <div id="tfPreflightStatus"></div>
            </div>
            <div class="tf-preflight-footer">
              <button type="button" class="tf-preflight-btn secondary" id="tfPreflightCancel">${t("common.cancel", "Hủy")}</button>
              <button type="button" class="tf-preflight-btn primary" id="tfPreflightRun">${t("workflow.preflightContinue", "Chạy")}</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const statusEl = overlay.querySelector("#tfPreflightStatus") as HTMLElement;
        const runBtn = overlay.querySelector("#tfPreflightRun") as HTMLButtonElement;
        const cancelBtn = overlay.querySelector("#tfPreflightCancel") as HTMLButtonElement;
        const providerStatus: Record<string, ProviderStatus> = { ...initialStatus };
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        let done = false;
        let allReady = false;

        const statusTextOf = (st?: ProviderStatus) => {
            if (!st) return t("common.checking", "Đang kiểm tra…");
            if (st.ready) return t("common.ready", "Sẵn sàng");
            if (st.error === "NOT_LOGGED_IN") return t("gen.providerStatusLogin", "Chưa đăng nhập");
            if (st.error === "NO_TAB" || st.error === "EDITOR_NOT_FOUND") return t("workflow.providerNoTab", "Đang mở tab…");
            if (st.error === "CLOUDFLARE" || st.cloudflareChallenge) return t("gen.providerStatusCloudflare", "Chờ Cloudflare…");
            if (st.error === "OPEN_TIMEOUT" || st.error === "CHECK_TIMEOUT") return "Đang mở / chờ…";
            if (st.error === "SESSION_NOT_FOUND") return "Session chưa load";
            return st.error || t("gen.providerStatusLogin", "Chưa sẵn sàng");
        };

        const renderStatus = () => {
            let html = "";
            for (const provider of providers) {
                const st = providerStatus[provider];
                const label = providerLabel(provider);
                let rowClass = "is-check";
                let icon = `<span class="tf-spin">⟳</span>`;
                if (st?.ready) {
                    rowClass = "is-ready";
                    icon = "✓";
                } else if (st && st.ready === false) {
                    rowClass = "is-warn";
                    icon = "⚠";
                }
                html += `<div class="tf-preflight-row ${rowClass}">
                  <span>${icon} ${label}</span>
                  <span>${statusTextOf(st)}</span>
                </div>`;
            }
            statusEl.innerHTML = html;
            allReady = [...providers].every((p) => providerStatus[p]?.ready);
            runBtn.textContent = allReady ? t("common.run", "Chạy") : t("workflow.runAnyway", "Vẫn chạy");
        };

        const pollStatus = async () => {
            for (const provider of providers) {
                if (!providerStatus[provider]?.ready) {
                    providerStatus[provider] = await checkProviderStatus(provider);
                }
            }
            renderStatus();
            if (allReady && pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        };

        const cleanup = () => {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
            overlay.remove();
        };

        cancelBtn.addEventListener("click", () => {
            if (done) return;
            done = true;
            cleanup();
            resolve({ ok: false, skipped: true, error: "preflight_cancelled" });
        });

        runBtn.addEventListener("click", () => {
            if (done) return;
            done = true;
            runBtn.disabled = true;
            cleanup();
            const warnings = [...providers].filter((p) => !providerStatus[p]?.ready).map((p) => `${providerLabel(p)} chưa sẵn sàng`);
            resolve({ ok: true, warnings: warnings.length ? warnings : undefined });
        });

        renderStatus();
        pollTimer = setInterval(() => {
            void pollStatus();
        }, 2000);
        // kick poll ngay
        void pollStatus();
    });
}

async function checkRefFilesExist(nodes: ExportNode[]) {
    const win = extensionWindow();
    if (!win.MessageBridge?.checkTilesExist) return null;

    const nodesWithRefs: { data: ExportNode; ids: string[] }[] = [];
    for (const data of nodes) {
        if (data.enabled === false) continue;
        const refStr = (data.ref_file_ids as string) || "";
        const ids = refStr
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && !isTempUploadId(s));
        if (ids.length) nodesWithRefs.push({ data, ids });
    }
    if (!nodesWithRefs.length) return null;

    const allRefIds = [...new Set(nodesWithRefs.flatMap((item) => item.ids))];
    try {
        const result = await withTimeout(win.MessageBridge.checkTilesExist(allRefIds), 2500, null);
        const missing = result?.missing || [];
        if (!missing.length) return null;

        if (typeof win.reuploadMissingFiles === "function") {
            for (const { data } of nodesWithRefs) {
                const refStr = (data.ref_file_ids as string) || "";
                const updated = await win.reuploadMissingFiles(refStr, data.ref_thumbnails || {}, null, data.ref_file_names || {});
                if (updated && updated !== refStr) {
                    data.ref_file_ids = updated;
                }
            }
            const recheck = await withTimeout(win.MessageBridge.checkTilesExist(allRefIds), 2500, null);
            if (!recheck?.missing?.length) return null;
        }

        return `Thiếu ${missing.length} ảnh tham chiếu trên Flow. Hãy mở Flow và kiểm tra lại ref images.`;
    } catch {
        return null;
    }
}

/**
 * Preflight trước khi run — port từ WorkflowEditor._preflightCheck (labs.toby.vn copy):
 * 1) Collect providers từ nodes
 * 2) Check status (không mở tab)
 * 3) Provider chưa ready → ensureReady({createIfMissing:true}) / ensureFlowTabActive
 * 4) Modal + poll status → user bấm Chạy
 */
export async function runWorkflowPreflight(nodes: CanvasNodeData[], connections: CanvasConnection[], options: { singleNodeId?: string } = {}): Promise<PreflightResult> {
    const win = extensionWindow();
    const store = useWorkflowEditorStore.getState();

    const activeUploads = store.countActiveUploads();
    if (activeUploads > 0) {
        win.customDialog?.alert?.(`Đang upload ${activeUploads} ảnh tham chiếu. Hãy đợi upload xong trước khi chạy.`, {
            type: "warning",
            title: "Đang upload",
        });
        return { ok: false, error: "uploads_pending" };
    }

    let exportNodes = exportNodesForExecution(nodes, connections);
    if (options.singleNodeId) {
        exportNodes = exportNodes.filter((n) => n.node_id === options.singleNodeId);
        if (!exportNodes.length) {
            return { ok: false, error: "node_not_found" };
        }
    }

    if (!exportNodes.length) {
        win.customDialog?.alert?.("Workflow chưa có node nào để chạy.", { type: "warning" });
        return { ok: false, error: "no_nodes" };
    }

    const hasTempRefs = exportNodes.some((n) => {
        const ids = ((n.ref_file_ids as string) || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        return ids.some((id) => isTempUploadId(id));
    });
    if (hasTempRefs) {
        win.customDialog?.alert?.("Còn ảnh tham chiếu đang upload (temp ID). Hãy đợi upload hoàn tất.", { type: "warning" });
        return { ok: false, error: "temp_refs" };
    }

    // Project gate — skip khi extension-only
    const extensionOnly = win.ApiBaseConfig?.shouldUseRemoteApi?.() === false || win.ApiBaseConfig?.isExtensionOnly?.() === true;
    if (!extensionOnly && !win._currentProjectId) {
        const proceed = await win.customDialog?.confirm?.("Chưa chọn project context. Workflow có thể không chạy đúng. Vẫn tiếp tục?", {
            type: "warning",
            title: "Thiếu project",
        });
        if (!proceed) return { ok: false, skipped: true, error: "no_project" };
    }

    const missingRefs = await checkRefFilesExist(exportNodes);
    if (missingRefs) {
        win.customDialog?.alert?.(missingRefs, { type: "warning", title: "Thiếu ảnh tham chiếu" });
        return { ok: false, error: "missing_refs" };
    }

    const providers = collectProviders(exportNodes);
    console.log("[TobyFlowPreflight] providers used:", [...providers]);
    if (providers.size === 0) return { ok: true };

    // 1) Initial status check (không mở tab)
    const providerStatus: Record<string, ProviderStatus> = {};
    for (const provider of providers) {
        providerStatus[provider] = await checkProviderStatus(provider);
    }
    console.log("[TobyFlowPreflight] initial status:", providerStatus);

    // 2) Auto-open / activate providers chưa sẵn sàng (giống WorkflowEditor line 13760+)
    const notReady = [...providers].filter((p) => !providerStatus[p]?.ready);
    console.log("[TobyFlowPreflight] activating providers:", notReady);
    if (notReady.length) {
        win.showNotification?.(`Đang mở tab: ${notReady.map(providerLabel).join(", ")}…`, "info", 3000);
        // AWAIT từng provider — ensureReady(createIfMissing:true) mở chatgpt.com / flow / …
        await Promise.all(
            notReady.map(async (provider) => {
                const activated = await activateProvider(provider);
                // Re-check sau activate
                const recheck = await checkProviderStatus(provider);
                providerStatus[provider] = {
                    ...activated,
                    ...recheck,
                    // nếu activate mở tab thành công nhưng login chưa xong → keep error
                    ready: recheck.ready === true,
                    tabId: recheck.tabId || activated.tabId,
                    error: recheck.ready ? undefined : recheck.error || activated.error,
                };
            }),
        );
        console.log("[TobyFlowPreflight] status after activate:", providerStatus);
    }

    // 3) Modal + poll (luôn show để user xác nhận — giống labs.toby.vn)
    return showProviderPreflightModal(providers, providerStatus);
}

export async function stopTobyFlowExecution() {
    const win = extensionWindow();
    if (!win.workflowExecutor?.isRunning && !useWorkflowEditorStore.getState().isExecuting) {
        return { ok: false as const, error: "not_running" };
    }

    try {
        if (win.workflowExecutor?.stop) {
            win.workflowExecutor.stop(true);
        } else if (win.workflowExecutor) {
            win.workflowExecutor.shouldStop = true;
            win.workflowExecutor.isRunning = false;
        }
        await win.MessageBridge?.stopExecution?.().catch(() => undefined);
        await win.WorkflowExecutor?.clearCrossContextRunning?.().catch(() => undefined);
    } catch (error) {
        console.warn("[TobyFlowExecution] stop failed:", error);
    }

    const store = useWorkflowEditorStore.getState();
    store.setExecuting(false);
    store.setExecutionProgress?.(null);
    store.setCurrentRunningNode(null);
    return { ok: true as const };
}

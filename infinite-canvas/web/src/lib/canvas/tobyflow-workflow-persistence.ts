import { TobyFlowCanvasAdapter, type TobyFlowConnection, type TobyFlowNode, type TobyFlowWorkflow } from "@/lib/canvas/tobyflow-adapter";
import { runWorkflowPreflight } from "@/lib/canvas/tobyflow-execution-control";
import { useWorkflowEditorStore } from "@/stores/canvas/use-workflow-editor-store";
import { EditorMode, type CanvasConnection, type CanvasNodeData } from "@/types/canvas";

type StorageManager = {
    saveWorkflowFull: (workflow: Record<string, unknown>, nodes: Record<string, unknown>[], edges: Record<string, unknown>[]) => Promise<TobyFlowWorkflow>;
    getWorkflow?: (wfId: string) => Promise<TobyFlowWorkflow | null>;
};

type WorkflowExecutor = {
    isRunning?: boolean;
    shouldStop?: boolean;
    currentWorkflow?: TobyFlowWorkflow | null;
    execute?: (wfId: string) => Promise<void>;
    executeSingleNode?: (wfId: string, nodeId: string) => Promise<void>;
    reset?: (wfId: string) => Promise<void>;
    stop?: (broadcast?: boolean) => void;
    getCrossContextRunning?: () => Promise<{ wf_id?: string; wf_name?: string } | null>;
    clearCrossContextRunning?: () => Promise<void>;
};

type FeatureGate = {
    canUse?: (key: string) => boolean;
    canCreateWorkflowAsync?: () => Promise<boolean>;
    checkQuota?: (key: string) => { allowed?: boolean; limit?: number | string; used?: number };
    checkGlobalQuotaWarning?: (scope: string) => { exhausted?: boolean };
    showLoginPrompt?: (msg: string) => void;
};

type CustomDialog = {
    confirm?: (msg: string, opts?: Record<string, unknown>) => Promise<boolean>;
    alert?: (msg: string, opts?: Record<string, unknown>) => void;
};

type WorkflowExportHelper = {
    buildExportData?: (name: string, description: unknown, workflow: Record<string, unknown>, nodes: Record<string, unknown>[], edges: Record<string, unknown>[]) => unknown;
    buildExportFilename?: (name: string) => string;
    downloadJson?: (data: unknown, filename: string) => void;
};

type SaveTemplateModal = {
    show?: (workflowData: Record<string, unknown>) => Promise<{ success?: boolean; template?: { id?: string; name?: string; description?: string } } | null>;
};

function extensionWindow() {
    return window as Window & {
        storageManager?: StorageManager;
        workflowExecutor?: WorkflowExecutor;
        WorkflowExecutor?: WorkflowExecutor;
        featureGate?: FeatureGate & {
            canManageWorkflowTemplates?: () => boolean;
            showModuleBlockedDialog?: (key: string) => void;
            setPendingWorkflowRun?: () => void;
            checkGlobalQuotaWarning?: (scope: string) => { exhausted?: boolean };
        };
        customDialog?: CustomDialog;
        CustomDialog?: CustomDialog;
        authManager?: {
            isLoggedIn?: () => boolean;
            _apiCall?: (method: string, path: string, body?: unknown) => Promise<{ template?: Record<string, unknown> }>;
        };
        showNotification?: (msg: string, type?: string) => void;
        WorkflowExportHelper?: WorkflowExportHelper;
        ShareWorkflowModal?: { show?: (wfId: string) => void };
        SaveTemplateModal?: SaveTemplateModal;
        MessageBridge?: { stopExecution?: () => Promise<void> };
        ApiBaseConfig?: { get?: () => string };
        workflowTemplateList?: {
            _copyTemplateToWorkflow?: (templateId: string | number, templateObj?: Record<string, unknown> | null) => Promise<void>;
        };
        openUpgradeModal?: () => void;
        chrome?: {
            runtime?: {
                id?: string;
                lastError?: { message?: string };
                sendMessage: (msg: Record<string, unknown>, cb?: (response: unknown) => void) => void;
            };
        };
    };
}

function convertNodesToTemplateFormat(nodes: Record<string, unknown>[]) {
    return nodes.map((node) => {
        let refImgUrls: string[] = [];
        if (Array.isArray(node.ref_img_urls) && node.ref_img_urls.length > 0) {
            refImgUrls = node.ref_img_urls as string[];
        } else if (node.ref_thumbnails && typeof node.ref_thumbnails === "object") {
            for (const value of Object.values(node.ref_thumbnails as Record<string, unknown>)) {
                const url = typeof value === "string" ? value : (value as { thumbnail?: string })?.thumbnail;
                if (url && !url.startsWith("data:")) refImgUrls.push(url);
            }
        }

        const data: Record<string, unknown> = {
            node_name: node.node_name || "",
            label: node.node_name || node.node_type || "",
            prompt: node.prompt || "",
            model: node.model || "",
            ratio: node.ratio || "1:1",
            quantity: node.quantity || 1,
            enabled: node.enabled !== false,
            media_type: node.media_type || "Image",
            gen_type: node.gen_type || "flow",
            ref_img_urls: refImgUrls,
            result_img_url: node.result_img_url || "",
        };

        const copyFields = [
            "slug",
            "slug_auto",
            "prompt_mode",
            "ref_mode",
            "ref_file_names",
            "auto_download",
            "retry_on_fail",
            "style_weight",
            "quality",
            "negative_prompt",
            "seed",
            "cfg_scale",
            "steps",
            "video_duration",
            "video_fps",
            "aspect_ratio",
            "node_zoom",
            "system_prompt",
            "temperature",
            "max_tokens",
            "angle_preset_id",
            "angle_preset_name",
            "angle_preset_json",
            "angle_rotation",
            "angle_tilt",
            "angle_zoom",
            "angle_ratio",
            "angle_built_prompt",
            "download_resolution",
            "video_download_resolution",
            "download_folder",
            "download_file_template",
            "download_collect_all",
            "delay_seconds",
            "note_text",
            "telegram_chat_id",
            "telegram_send_mode",
            "telegram_message",
            "telegram_caption",
            "provider",
            "prompt_source",
            "multi_prompt",
            "enhance",
            "enhance_model",
            "timeout_sec",
            "timeout_ms",
            "use_fallback_prefix",
            "max_ref_images",
            "grok_mode",
            "grok_duration",
            "grok_resolution",
            "grok_image_quality",
            "video_input_type",
            "frame_1_source",
            "frame_1_file_name",
            "frame_1_thumbnail",
            "frame_2_source",
            "frame_2_file_name",
            "frame_2_thumbnail",
            "prompts_json",
        ];

        for (const field of copyFields) {
            if (node[field] !== undefined) data[field] = node[field];
        }

        return {
            id: node.node_id,
            type: node.node_type,
            name: node.node_name || node.node_type,
            position: { x: node.pos_x || 100, y: node.pos_y || 100 },
            enabled: node.enabled !== false,
            data,
        };
    });
}

function convertEdgesToTemplateFormat(edges: Record<string, unknown>[]) {
    return edges
        .map((edge) => ({
            id: edge.edge_id || `edge_${String(edge.source_node_id || edge.source)}_${String(edge.target_node_id || edge.target)}`,
            source: edge.source_node_id || edge.source_node || edge.source,
            target: edge.target_node_id || edge.target_node || edge.target,
            sourceHandle: edge.source_handle || edge.output_class || "output_1",
            targetHandle: edge.target_handle || edge.input_class || "input_1",
            sourcePort: edge.source_port || null,
            targetPort: edge.target_port || null,
            dataType: edge.data_type || "image",
        }))
        .filter((edge) => edge.source && edge.target);
}

/** Đóng popup editor sau khi lưu xong (để user quay về sidebar). */
function closeEditorPopupSoon(reason: string) {
    try {
        console.log("[TobyFlowPersistence] closing editor popup:", reason);
        // Cho toast kịp hiện, rồi đóng tab/popup
        setTimeout(() => {
            try {
                window.close();
            } catch (_) {
                /* ignore */
            }
        }, 450);
    } catch (_) {
        /* ignore */
    }
}

export async function saveTobyFlowWorkflow(nodes: CanvasNodeData[], connections: CanvasConnection[], workflowName: string, options?: { closeAfterSave?: boolean }) {
    const closeAfterSave = options?.closeAfterSave !== false;
    const store = useWorkflowEditorStore.getState();
    if (store.isTemplateMode) {
        return saveTobyFlowTemplate(nodes, connections, workflowName, { closeAfterSave });
    }
    if (store.isReadOnly() || !store.getPermissions().canSave) {
        return { ok: false as const, error: "read_only" };
    }

    const win = extensionWindow();
    if (win.workflowExecutor?.isRunning) {
        console.log("[TobyFlowPersistence] save skipped — workflow executing");
        return { ok: true as const, skipped: true };
    }
    if (!win.storageManager?.saveWorkflowFull) {
        win.customDialog?.alert?.("Storage chưa sẵn sàng. Hãy thử lại.", { type: "error" });
        return { ok: false as const, error: "no_storage" };
    }

    const {
        nodes: exportNodes,
        edges,
        workflowData,
        legacyMode,
    } = TobyFlowCanvasAdapter.canvasToSaveExport(
        { nodes, connections },
        {
            wf_id: store.workflowId || undefined,
            wf_name: workflowName,
            workflowBase: store.workflowBase || undefined,
            legacyMode: store.legacyMode,
        },
    );

    if (legacyMode === "create" && win.featureGate?.canCreateWorkflowAsync) {
        try {
            const canCreate = await Promise.race([
                win.featureGate.canCreateWorkflowAsync(),
                new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 2000)), // không treo >2s
            ]);
            if (!canCreate) {
                if (!win.authManager?.isLoggedIn?.()) {
                    win.featureGate.showLoginPrompt?.("Tạo workflow yêu cầu đăng nhập");
                }
                return { ok: false as const, error: "quota" };
            }
        } catch (gateErr) {
            console.warn("[TobyFlowPersistence] canCreateWorkflowAsync skipped:", gateErr);
        }
    }

    useWorkflowEditorStore.setState({ isSaving: true });
    try {
        // Ensure create has a local id before save (LocalStorage also assigns if missing)
        if (!workflowData.wf_id) {
            workflowData.wf_id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        console.log("[TobyFlowPersistence] saveWorkflowFull", {
            mode: store.legacyMode,
            isTemplateMode: store.isTemplateMode,
            storageMode: win.storageManager?.getMode?.() || win.storageManager?.mode,
            wf_id: workflowData.wf_id,
            nodes: exportNodes.length,
            edges: edges.length,
        });

        // Hard timeout toàn bộ save — UI không xoay vô hạn
        const raw = await Promise.race([win.storageManager.saveWorkflowFull(workflowData, exportNodes, edges), new Promise((_, reject) => setTimeout(() => reject(new Error("Save timeout 15s")), 15000))]);
        // LocalStorage historically returned { workflow, nodes, edges }; ApiStorage returns workflow
        const result = (raw && typeof raw === "object" && (raw as { workflow?: TobyFlowWorkflow }).workflow ? (raw as { workflow: TobyFlowWorkflow }).workflow : raw) as TobyFlowWorkflow;
        const nestedNodes = (raw as { nodes?: TobyFlowNode[] })?.nodes;
        const nestedEdges = (raw as { edges?: TobyFlowConnection[] })?.edges;

        const wfId = result?.wf_id || workflowData.wf_id || store.workflowId;
        if (!wfId) {
            throw new Error("Save OK nhưng không có wf_id — kiểm tra LocalStorage");
        }

        useWorkflowEditorStore.getState().setWorkflowMeta({
            workflowId: String(wfId),
            workflowName: (result?.wf_name as string) || (workflowData.wf_name as string) || workflowName,
        });
        useWorkflowEditorStore.getState().setWorkflowBase({
            ...(result || workflowData),
            wf_id: String(wfId),
            nodes: (nestedNodes || exportNodes) as TobyFlowNode[],
            edges: (nestedEdges || edges) as TobyFlowConnection[],
        });
        if (store.legacyMode === "create" && wfId) {
            useWorkflowEditorStore.setState({ legacyMode: "edit" });
            useWorkflowEditorStore.getState().setEditorMode(
                TobyFlowCanvasAdapter.syncEditorMode({
                    mode: "edit",
                    workflow: { ...workflowData, wf_id: String(wfId) } as TobyFlowWorkflow,
                }),
            );
        }
        useWorkflowEditorStore.getState().clearUnsaved();
        const dual = raw as { _savedLocal?: boolean; _savedRemote?: boolean };
        const where = dual?._savedRemote && dual?._savedLocal ? "local + server" : dual?._savedRemote ? "server" : "local (máy khách)";
        win.showNotification?.(closeAfterSave ? `Đã lưu workflow — ${where}. Đang đóng…` : `Đã lưu workflow — ${where}.`, "success");
        console.log("[TobyFlowPersistence] save OK", wfId, where, "closeAfterSave=", closeAfterSave);

        // Double-check chrome.storage.local có workflow (debug + self-heal list)
        try {
            const chromeApi = win.chrome || (globalThis as { chrome?: typeof chrome }).chrome;
            if (chromeApi?.storage?.local?.get) {
                const check = await new Promise<Record<string, unknown>>((resolve) => {
                    chromeApi.storage.local.get(["af_workflows"], resolve);
                });
                const list = Array.isArray(check.af_workflows) ? (check.af_workflows as Array<{ wf_id?: string }>) : [];
                const found = list.some((w) => w?.wf_id === wfId);
                console.log("[TobyFlowPersistence] af_workflows after save:", list.length, "found:", found);
                if (!found) {
                    console.warn("[TobyFlowPersistence] workflow missing after save — attempting direct write");
                    const entry = { ...(result || workflowData), wf_id: String(wfId), platform: "flow" };
                    const next = list.filter((w) => w?.wf_id !== wfId).concat([entry as { wf_id?: string }]);
                    await new Promise<void>((resolve) => {
                        chromeApi.storage.local.set({ af_workflows: next }, () => resolve());
                    });
                }
            }
        } catch (verifyErr) {
            console.warn("[TobyFlowPersistence] post-save verify failed:", verifyErr);
        }

        // Notify sidebar to refresh list
        try {
            win.chrome?.runtime?.sendMessage?.({
                action: "workflowSaved",
                wfId,
                workflowId: wfId,
                wf_id: wfId,
            });
            window.dispatchEvent(new CustomEvent("tobyflow:workflow-saved", { detail: { wfId, workflowId: wfId, wf_id: wfId } }));
        } catch (_) {
            /* ignore */
        }
        if (closeAfterSave) {
            closeEditorPopupSoon(`workflow-saved:${wfId}`);
        }
        return { ok: true as const, workflow: { ...result, wf_id: String(wfId) } as TobyFlowWorkflow };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[TobyFlowPersistence] save failed:", message, error);
        win.customDialog?.alert?.(`Không thể lưu workflow: ${message}`, { type: "error" });
        return { ok: false as const, error: message };
    } finally {
        useWorkflowEditorStore.setState({ isSaving: false });
    }
}

export async function runTobyFlowWorkflow(nodes: CanvasNodeData[], connections: CanvasConnection[], workflowName: string) {
    const store = useWorkflowEditorStore.getState();
    console.log("[TobyFlowPersistence] run workflow requested", {
        nodes: nodes.length,
        connections: connections.length,
        workflowName,
        workflowId: store.workflowId,
    });
    if (store.isReadOnly() || !store.getPermissions().canRun) {
        return { ok: false as const, error: "read_only" };
    }

    const win = extensionWindow();
    if (win.featureGate && !win.featureGate.canUse?.("workflows_enabled")) {
        return { ok: false as const, error: "feature_disabled" };
    }

    // Chạy: lưu trước nhưng KHÔNG đóng popup
    const saveResult = await saveTobyFlowWorkflow(nodes, connections, workflowName, { closeAfterSave: false });
    if (!saveResult.ok) return saveResult;

    const wfId = useWorkflowEditorStore.getState().workflowId;
    if (!wfId) {
        win.customDialog?.alert?.("Workflow chưa có ID — hãy lưu trước khi chạy.", { type: "warning" });
        return { ok: false as const, error: "no_wf_id" };
    }

    if (store.isRunPending) return { ok: false as const, error: "pending" };
    useWorkflowEditorStore.setState({ isRunPending: true });

    try {
        if (win.workflowExecutor?.isRunning) {
            const force = await win.customDialog?.confirm?.("Có workflow đang chạy. Force stop để chạy mới?", {
                type: "warning",
                title: "Workflow đang chạy",
            });
            if (!force) return { ok: false as const, error: "running" };
            win.workflowExecutor.shouldStop = true;
            win.workflowExecutor.isRunning = false;
            await win.WorkflowExecutor?.clearCrossContextRunning?.();
        }

        const cross = await win.WorkflowExecutor?.getCrossContextRunning?.();
        if (cross?.wf_id && cross.wf_id !== wfId) {
            const force = await win.customDialog?.confirm?.(`"${cross.wf_name || "Workflow"}" đang chạy ở cửa sổ khác. Force stop?`, {
                type: "warning",
            });
            if (!force) return { ok: false as const, error: "cross_running" };
            await win.WorkflowExecutor?.clearCrossContextRunning?.();
        }

        if (!win.workflowExecutor?.execute) {
            win.customDialog?.alert?.("WorkflowExecutor chưa sẵn sàng.", { type: "error" });
            return { ok: false as const, error: "no_executor" };
        }

        console.log("[TobyFlowPersistence] run preflight start", { wfId });
        const preflight = await runWorkflowPreflight(nodes, connections);
        console.log("[TobyFlowPersistence] run preflight result", preflight);
        if (!preflight.ok) return { ok: false as const, error: preflight.error || "preflight_failed" };

        useWorkflowEditorStore.getState().setExecuting(true);
        useWorkflowEditorStore.getState().setCurrentRunningNode(null);
        console.log("[TobyFlowPersistence] executing workflow", { wfId });
        await win.workflowExecutor.execute(wfId);
        console.log("[TobyFlowPersistence] execute finished", { wfId });
        return { ok: true as const };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        win.customDialog?.alert?.(`Lỗi khi chạy workflow: ${message}`, { type: "error" });
        return { ok: false as const, error: message };
    } finally {
        useWorkflowEditorStore.setState({ isRunPending: false });
    }
}

export async function runTobyFlowSingleNode(nodes: CanvasNodeData[], connections: CanvasConnection[], workflowName: string, nodeId: string) {
    const store = useWorkflowEditorStore.getState();
    if (store.isReadOnly() || !store.getPermissions().canRun) {
        return { ok: false as const, error: "read_only" };
    }

    const win = extensionWindow();
    // Chạy node: lưu nhưng không đóng popup
    const saveResult = await saveTobyFlowWorkflow(nodes, connections, workflowName, { closeAfterSave: false });
    if (!saveResult.ok) return saveResult;

    const wfId = useWorkflowEditorStore.getState().workflowId;
    if (!wfId) return { ok: false as const, error: "no_wf_id" };

    const exportNode = nodes.find((n) => n.id === nodeId || n.metadata?.tobyflow?.nodeId === nodeId);
    const actualNodeId = exportNode?.metadata?.tobyflow?.nodeId || nodeId;
    if (!exportNode) return { ok: false as const, error: "node_not_found" };

    if (store.isRunPending) return { ok: false as const, error: "pending" };
    useWorkflowEditorStore.setState({ isRunPending: true });

    try {
        if (win.workflowExecutor?.isRunning) {
            const force = await win.customDialog?.confirm?.("Có workflow đang chạy. Force stop để chạy node này?", { type: "warning" });
            if (!force) return { ok: false as const, error: "running" };
            win.workflowExecutor.shouldStop = true;
            win.workflowExecutor.isRunning = false;
            await win.WorkflowExecutor?.clearCrossContextRunning?.();
        }

        if (!win.workflowExecutor?.executeSingleNode) {
            win.customDialog?.alert?.("WorkflowExecutor chưa hỗ trợ chạy single node.", { type: "error" });
            return { ok: false as const, error: "no_executor" };
        }

        const preflight = await runWorkflowPreflight(nodes, connections, { singleNodeId: actualNodeId });
        if (!preflight.ok) return { ok: false as const, error: preflight.error || "preflight_failed" };

        win.featureGate?.setPendingWorkflowRun?.();
        useWorkflowEditorStore.getState().setExecuting(true);
        useWorkflowEditorStore.getState().setCurrentRunningNode(actualNodeId);
        await win.workflowExecutor.executeSingleNode(wfId, actualNodeId);
        return { ok: true as const };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        win.customDialog?.alert?.(`Lỗi khi chạy node: ${message}`, { type: "error" });
        return { ok: false as const, error: message };
    } finally {
        useWorkflowEditorStore.setState({ isRunPending: false });
    }
}

export async function resetTobyFlowWorkflow(nodes: CanvasNodeData[], connections: CanvasConnection[], workflowName: string) {
    const store = useWorkflowEditorStore.getState();
    if (store.isReadOnly() || !store.getPermissions().canReset) {
        return { ok: false as const, error: "read_only" };
    }

    const win = extensionWindow();
    const wfId = store.workflowId;
    if (!wfId) {
        win.customDialog?.alert?.("Workflow chưa có ID.", { type: "warning" });
        return { ok: false as const, error: "no_wf_id" };
    }

    if (win.workflowExecutor?.isRunning) {
        const force = await win.customDialog?.confirm?.("Workflow đang chạy. Force stop và reset?", { type: "warning", confirmText: "Force Reset" });
        if (!force) return { ok: false as const, error: "running" };
        win.workflowExecutor.stop?.(true);
        try {
            await win.WorkflowExecutor?.clearCrossContextRunning?.();
            await win.MessageBridge?.stopExecution?.();
        } catch {
            /* ignore */
        }
    }

    const confirmed = await win.customDialog?.confirm?.("Reset workflow sẽ xóa toàn bộ kết quả và trạng thái các node. Tiếp tục?", {
        type: "warning",
        confirmText: "Reset",
    });
    if (!confirmed) return { ok: false as const, error: "cancelled" };

    useWorkflowEditorStore.getState().setResetInProgress(true);
    try {
        await saveTobyFlowWorkflow(nodes, connections, workflowName);
        if (!win.workflowExecutor?.reset) {
            win.customDialog?.alert?.("WorkflowExecutor chưa sẵn sàng.", { type: "error" });
            return { ok: false as const, error: "no_executor" };
        }
        await win.workflowExecutor.reset(wfId);
        const reloaded = await win.storageManager?.getWorkflow?.(wfId);
        if (reloaded) {
            useWorkflowEditorStore.getState().setWorkflowBase(reloaded);
            useWorkflowEditorStore.getState().clearUnsaved();
        }
        win.showNotification?.("Workflow đã được reset", "success");
        return { ok: true as const, workflow: reloaded || null };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        win.customDialog?.alert?.(`Reset thất bại: ${message}`, { type: "error" });
        return { ok: false as const, error: message };
    } finally {
        useWorkflowEditorStore.getState().setResetInProgress(false);
    }
}

export async function exportTobyFlowWorkflow(nodes: CanvasNodeData[], connections: CanvasConnection[], workflowName: string) {
    const store = useWorkflowEditorStore.getState();
    if (!store.getPermissions().canExport) {
        return { ok: false as const, error: "read_only" };
    }

    const win = extensionWindow();
    if (win.featureGate && !win.featureGate.canUse?.("workflow_export")) {
        win.featureGate.showModuleBlockedDialog?.("workflow_export");
        return { ok: false as const, error: "feature_disabled" };
    }

    const helper = win.WorkflowExportHelper;
    if (!helper?.buildExportData || !helper.buildExportFilename || !helper.downloadJson) {
        win.customDialog?.alert?.("Module export chưa sẵn sàng.", { type: "error" });
        return { ok: false as const, error: "no_helper" };
    }

    const {
        nodes: exportNodes,
        edges,
        workflowData,
    } = TobyFlowCanvasAdapter.canvasToSaveExport(
        { nodes, connections },
        {
            wf_id: store.workflowId || undefined,
            wf_name: workflowName,
            workflowBase: store.workflowBase || undefined,
            legacyMode: store.legacyMode,
        },
    );

    try {
        const exportData = helper.buildExportData(workflowName, (store.workflowBase as Record<string, unknown> | null)?.description, workflowData, exportNodes, edges);
        const filename = helper.buildExportFilename(workflowName);
        helper.downloadJson(exportData, filename);
        return { ok: true as const };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        win.customDialog?.alert?.(`Xuất workflow thất bại: ${message}`, { type: "error" });
        return { ok: false as const, error: message };
    }
}

async function cloneSharedWorkflowViaApi(wfId: string) {
    const win = extensionWindow();
    const token = await (win.authManager as { getToken?: () => Promise<string> } | undefined)?.getToken?.();
    if (!token) {
        win.customDialog?.alert?.("Vui lòng đăng nhập để sử dụng tính năng này.", { type: "warning" });
        return { ok: false as const, error: "login_required" };
    }

    const baseUrl = win.ApiBaseConfig?.get?.() || "";
    const response = await fetch(`${baseUrl}/shared-workflows/${wfId}/clone`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Extension-Id": win.chrome?.runtime?.id || "",
        },
    });

    const json = (await response.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
        code?: string;
        message?: string;
        data?: { workflow?: TobyFlowWorkflow };
        workflow?: TobyFlowWorkflow;
    };

    if (!response.ok) {
        const errCode = json?.error?.code || json?.code;
        const errMsg = json?.error?.message || json?.message || `HTTP ${response.status}`;

        if (errCode === "QUOTA_EXCEEDED" || errCode === "FEATURE_DISABLED") {
            const upgrade = await win.customDialog?.confirm?.(errMsg, {
                title: "Đã đạt giới hạn",
                type: "warning",
                confirmText: "Nâng cấp",
                cancelText: "Để sau",
            });
            if (upgrade) {
                if (typeof win.openUpgradeModal === "function") {
                    win.openUpgradeModal();
                } else {
                    win.chrome?.runtime?.sendMessage?.({ action: "showUpgradeModal" });
                }
            }
            return { ok: false as const, error: errCode };
        }

        win.customDialog?.alert?.(errMsg, { type: "error" });
        return { ok: false as const, error: errMsg };
    }

    const newWorkflow = json.data?.workflow || json.workflow;
    win.showNotification?.("Đã nhân bản workflow thành công!", "success");

    try {
        win.chrome?.runtime?.sendMessage?.({ action: "workflowClonedFromShared", workflow: newWorkflow });
    } catch {
        /* ignore */
    }
    try {
        window.close();
    } catch {
        /* ignore */
    }

    return { ok: true as const, workflow: newWorkflow };
}

async function cloneTemplateWorkflow(templateId: string | number, templateObj: Record<string, unknown> | null) {
    const win = extensionWindow();

    if (win.workflowTemplateList?._copyTemplateToWorkflow) {
        await win.workflowTemplateList._copyTemplateToWorkflow(templateId, templateObj);
        try {
            window.close();
        } catch {
            /* ignore */
        }
        return { ok: true as const, type: "template" as const };
    }

    return new Promise<{ ok: true; type: "template" } | { ok: false; error: string }>((resolve) => {
        win.chrome?.runtime?.sendMessage?.(
            {
                action: "cloneWorkflowTemplate",
                templateId,
                template: templateObj,
            },
            () => {
                const err = win.chrome?.runtime?.lastError;
                if (err) {
                    win.customDialog?.alert?.(`Không thể sao chép template: ${err.message || "unknown"}`, { type: "error" });
                    resolve({ ok: false as const, error: "message_failed" });
                    return;
                }
                try {
                    window.close();
                } catch {
                    /* ignore */
                }
                resolve({ ok: true as const, type: "template" as const });
            },
        );
    });
}

export async function duplicateTobyFlowWorkflow() {
    const store = useWorkflowEditorStore.getState();
    if (!store.getPermissions().canDuplicate) {
        return { ok: false as const, error: "not_allowed" };
    }

    const workflow = store.workflowBase as TobyFlowWorkflow | null;
    const mode = store.editorMode;

    if (mode === EditorMode.TEMPLATE_PREVIEW && workflow?._template_id) {
        return cloneTemplateWorkflow(workflow._template_id, workflow._original_template || null);
    }

    if (mode === EditorMode.SHARED_PREVIEW && workflow?.wf_id) {
        return cloneSharedWorkflowViaApi(workflow.wf_id);
    }

    extensionWindow().customDialog?.alert?.("Chế độ hiện tại không hỗ trợ nhân bản workflow.", { type: "warning" });
    return { ok: false as const, error: "unsupported_mode" };
}

export function shareTobyFlowWorkflow() {
    const store = useWorkflowEditorStore.getState();
    if (store.isReadOnly() || !store.getPermissions().canShare) return { ok: false as const, error: "read_only" };

    const win = extensionWindow();
    const wfId = store.workflowId;
    if (!wfId) {
        win.customDialog?.alert?.("Vui lòng lưu workflow trước khi chia sẻ.", { type: "warning" });
        return { ok: false as const, error: "no_wf_id" };
    }

    if (win.featureGate && !win.featureGate.canUse?.("workflow_share_enabled")) {
        win.featureGate.showModuleBlockedDialog?.("workflow_share");
        return { ok: false as const, error: "feature_disabled" };
    }

    if (win.ShareWorkflowModal?.show) {
        win.ShareWorkflowModal.show(wfId);
        return { ok: true as const };
    }

    win.customDialog?.alert?.("Chức năng chia sẻ chưa sẵn sàng.", { type: "info" });
    return { ok: false as const, error: "no_modal" };
}

export async function saveTobyFlowTemplate(nodes: CanvasNodeData[], connections: CanvasConnection[], workflowName: string, options?: { closeAfterSave?: boolean }) {
    const closeAfterSave = options?.closeAfterSave !== false;
    const store = useWorkflowEditorStore.getState();
    if (!store.isTemplateMode || store.isReadOnly() || !store.getPermissions().canSave) {
        return { ok: false as const, error: "read_only" };
    }

    const win = extensionWindow();
    if (!win.featureGate?.canManageWorkflowTemplates?.()) {
        win.showNotification?.("Bạn cần quyền admin để lưu template", "error");
        return { ok: false as const, error: "no_permission" };
    }

    const {
        nodes: exportNodes,
        edges,
        workflowData,
    } = TobyFlowCanvasAdapter.canvasToSaveExport(
        { nodes, connections },
        {
            wf_id: store.workflowId || undefined,
            wf_name: workflowName,
            workflowBase: store.workflowBase || undefined,
            legacyMode: store.legacyMode,
        },
    );

    if (!exportNodes.length) {
        win.showNotification?.("Template cần có ít nhất một node", "warning");
        return { ok: false as const, error: "no_nodes" };
    }

    useWorkflowEditorStore.setState({ isSaving: true });
    try {
        if (!store.templateId) {
            if (!win.SaveTemplateModal?.show) {
                win.customDialog?.alert?.("SaveTemplateModal chưa sẵn sàng.", { type: "error" });
                return { ok: false as const, error: "no_modal" };
            }
            const result = await win.SaveTemplateModal.show({
                wf_name: workflowName,
                description: store.templateData?.description || "",
                nodes: exportNodes,
                edges,
                settings: (workflowData as Record<string, unknown>).settings || {},
            });
            if (result?.success && result.template?.id) {
                const created = result.template as { id: string; name?: string; description?: string };
                useWorkflowEditorStore.getState().setTemplateMeta({
                    templateId: created.id,
                    templateData: { ...store.templateData, name: created.name, description: created.description },
                });
                useWorkflowEditorStore.getState().clearUnsaved();
                win.showNotification?.("Template đã lưu — đang đóng…", "success");
                try {
                    win.chrome?.runtime?.sendMessage?.({ action: "templateEditorClosed" });
                    win.chrome?.runtime?.sendMessage?.({ action: "workflowSaved" });
                } catch (_) {
                    /* ignore */
                }
                if (closeAfterSave) closeEditorPopupSoon(`template-created:${created.id}`);
                return { ok: true as const, templateId: result.template.id };
            }
            return { ok: false as const, error: "cancelled" };
        }

        const templatePayload = {
            name: workflowName,
            description: store.templateData?.description || "",
            category_id: store.templateData?.category_id || null,
            thumbnail_url: store.templateData?.thumbnail_url || null,
            video_url: store.templateData?.video_url || null,
            is_premium: store.templateData?.is_premium || false,
            is_featured: store.templateData?.is_featured || false,
            is_active: store.templateData?.is_published !== false,
            nodes: convertNodesToTemplateFormat(exportNodes),
            edges: convertEdgesToTemplateFormat(edges),
            settings: (workflowData as Record<string, unknown>).settings || {},
        };

        // Extension-only: update local storage (SaveTemplateModal helper)
        const extensionOnly = win.ApiBaseConfig?.shouldUseRemoteApi?.() === false || (win.ApiBaseConfig as { isExtensionOnly?: () => boolean } | undefined)?.isExtensionOnly?.() === true;
        if (extensionOnly && (win as Window & { SaveTemplateModal?: { _updateTemplateLocal?: (id: string, data: unknown) => Promise<Record<string, unknown>> } }).SaveTemplateModal?._updateTemplateLocal) {
            const updated = await (win as Window & { SaveTemplateModal: { _updateTemplateLocal: (id: string, data: unknown) => Promise<Record<string, unknown>> } }).SaveTemplateModal._updateTemplateLocal(String(store.templateId), templatePayload);
            useWorkflowEditorStore.getState().setTemplateMeta({
                templateData: { ...store.templateData, ...updated },
            });
            useWorkflowEditorStore.getState().clearUnsaved();
            win.showNotification?.("Template đã cập nhật (local) — đang đóng…", "success");
            if (closeAfterSave) closeEditorPopupSoon(`template-updated-local:${store.templateId}`);
            return { ok: true as const, templateId: store.templateId };
        }

        const response = (await win.authManager?._apiCall?.("PUT", `admin/workflow-templates/${store.templateId}`, templatePayload)) as
            | {
                  template?: Record<string, unknown>;
              }
            | undefined;
        if (response?.template) {
            useWorkflowEditorStore.getState().setTemplateMeta({
                templateData: { ...store.templateData, ...response.template },
            });
        }
        useWorkflowEditorStore.getState().clearUnsaved();
        win.showNotification?.("Template đã cập nhật — đang đóng…", "success");
        try {
            win.chrome?.runtime?.sendMessage?.({ action: "templateEditorClosed" });
        } catch (_) {
            /* ignore */
        }
        if (closeAfterSave) closeEditorPopupSoon(`template-updated:${store.templateId}`);
        return { ok: true as const, templateId: store.templateId };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        win.customDialog?.alert?.(`Lưu template thất bại: ${message}`, { type: "error" });
        return { ok: false as const, error: message };
    } finally {
        useWorkflowEditorStore.setState({ isSaving: false });
    }
}

export async function confirmCloseTobyFlowEditor(): Promise<boolean> {
    const store = useWorkflowEditorStore.getState();
    if (!store.isWorkflowMode || store.isReadOnly() || store.openedToViewRunning) return true;

    const win = extensionWindow();
    const activeUploads = store.countActiveUploads();
    if (activeUploads > 0) {
        const confirmed = await win.customDialog?.confirm?.(`Đang upload ${activeUploads} ảnh tham chiếu. Đóng sẽ hủy upload. Tiếp tục?`, { type: "warning", title: "Đang upload" });
        if (!confirmed) return false;
    }

    if (store.hasUnsavedChanges) {
        const confirmed = await win.customDialog?.confirm?.("Workflow có thay đổi chưa lưu. Đóng mà không lưu?", {
            type: "warning",
            title: "Chưa lưu",
        });
        if (!confirmed) return false;
    }

    store.cleanupUploadKeys();
    return true;
}

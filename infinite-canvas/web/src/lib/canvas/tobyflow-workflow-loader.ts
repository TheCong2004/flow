import { TobyFlowCanvasAdapter, type TobyFlowLoadPayload } from "@/lib/canvas/tobyflow-adapter";
import { useWorkflowEditorStore } from "@/stores/canvas/use-workflow-editor-store";

type ChromeStorage = {
    storage?: {
        local?: {
            get: (keys: string[]) => Promise<Record<string, unknown>>;
            remove: (keys: string[]) => Promise<void>;
        };
    };
};

declare global {
    interface Window {
        __TOBYFLOW_BOOT__?: TobyFlowLoadPayload;
        __TOBYFLOW_BOOT_READY__?: Promise<TobyFlowLoadPayload | null>;
    }
}

function consumeWindowBoot() {
    if (typeof window === "undefined" || !window.__TOBYFLOW_BOOT__) return null;
    const boot = window.__TOBYFLOW_BOOT__;
    delete window.__TOBYFLOW_BOOT__;
    return boot;
}

export async function loadTobyFlowWorkflowPayload(): Promise<TobyFlowLoadPayload | null> {
    const windowBoot = consumeWindowBoot();
    if (windowBoot) return windowBoot;

    if (typeof window !== "undefined" && window.__TOBYFLOW_BOOT_READY__) {
        const boot = await Promise.race([window.__TOBYFLOW_BOOT_READY__, new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800))]);
        const consumed = consumeWindowBoot();
        if (consumed) return consumed;
        if (boot) {
            delete window.__TOBYFLOW_BOOT__;
            return boot;
        }
    }

    const chromeApi = (globalThis as { chrome?: ChromeStorage }).chrome;
    const storage = chromeApi?.storage?.local;
    if (storage?.get) {
        try {
            const stored = await storage.get(["_pendingWorkflow"]);
            const pending = stored._pendingWorkflow as TobyFlowLoadPayload | undefined;
            if (pending) {
                await storage.remove(["_pendingWorkflow"]).catch(() => undefined);
                return pending;
            }
        } catch (error) {
            console.warn("[TobyFlowLoader] chrome.storage read failed:", error);
        }
    }

    const lateWindowBoot = consumeWindowBoot();
    if (lateWindowBoot) return lateWindowBoot;

    if (typeof window !== "undefined" && window.__TOBYFLOW_BOOT_READY__) {
        const boot = await Promise.race([window.__TOBYFLOW_BOOT_READY__, new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))]);
        if (boot) {
            delete window.__TOBYFLOW_BOOT__;
            return boot;
        }
    }

    if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const embedded = params.get("tobyflowPayload");
        if (embedded) {
            try {
                return JSON.parse(decodeURIComponent(embedded)) as TobyFlowLoadPayload;
            } catch (error) {
                console.warn("[TobyFlowLoader] Failed to parse tobyflowPayload:", error);
            }
        }
    }

    return null;
}

export function applyTobyFlowPayload(payload: TobyFlowLoadPayload) {
    const workflow = payload.workflow;
    const legacyMode = (payload.mode === "edit" || payload.mode === "view" || payload.mode === "admin_preview" ? payload.mode : "create") as "create" | "edit" | "view" | "admin_preview";

    useWorkflowEditorStore.getState().setWorkflowMode(true);
    useWorkflowEditorStore.getState().setEditorMode(TobyFlowCanvasAdapter.syncEditorMode(payload));
    useWorkflowEditorStore.getState().setLegacyMode(legacyMode);
    useWorkflowEditorStore.getState().clearUnsaved();
    useWorkflowEditorStore.setState({ openedToViewRunning: Boolean(payload.openedToViewRunning) });

    if (!workflow) {
        const emptyName = payload.isTemplateMode ? "Template mới" : "Workflow mới";
        useWorkflowEditorStore.getState().setWorkflowMeta({ workflowId: null, workflowName: emptyName });
        useWorkflowEditorStore.getState().setWorkflowBase({ wf_name: emptyName, nodes: [], edges: [] });
        useWorkflowEditorStore.getState().setTemplateMeta({
            isTemplateMode: Boolean(payload.isTemplateMode),
            templateId: payload.templateId || null,
            templateData: null,
        });
        return { nodes: [], connections: [], title: emptyName };
    }

    const canvasData = TobyFlowCanvasAdapter.workflowToCanvas(workflow);

    useWorkflowEditorStore.getState().setWorkflowMeta({
        workflowId: workflow.wf_id || null,
        workflowName: workflow.wf_name || canvasData.title || "",
    });
    useWorkflowEditorStore.getState().setWorkflowBase(workflow);
    useWorkflowEditorStore.getState().setTemplateMeta({
        isTemplateMode: Boolean(payload.isTemplateMode),
        templateId: payload.templateId || null,
        templateData: (workflow as Record<string, unknown>) || null,
    });

    return canvasData;
}

export function listenTobyFlowWorkflowMessages(onPayload: (payload: TobyFlowLoadPayload) => void) {
    const handler = (event: MessageEvent) => {
        if (event.source !== window.parent && event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== "tobyflow:load-workflow") return;
        onPayload(data.payload as TobyFlowLoadPayload);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
}

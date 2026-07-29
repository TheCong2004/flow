/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_RELEASES__: import("@/lib/release").ReleaseInfo[];

interface Window {
    __TOBYFLOW_EXTENSION__?: boolean;
    __TOBYFLOW_BOOT__?: import("@/lib/canvas/tobyflow-adapter").TobyFlowLoadPayload;
    eventBus?: {
        on: (event: string, handler: (data: unknown) => void) => void;
        off: (event: string, handler: (data: unknown) => void) => void;
        emit?: (event: string, data?: unknown) => void;
    };
    MessageBridge?: {
        getThumbnailsByIds?: (ids: string[]) => Promise<{ results?: Record<string, { thumbnail?: string; video_url?: string; type?: string; file_name?: string }> } | null>;
    };
    ImmediateUploader?: {
        cancelAll: (keys: Set<string>) => void;
        upload?: (file: File, thumbnail: string, opts: { key: string }) => Promise<unknown>;
    };
    imagePickerModal?: { open: (opts: Record<string, unknown>) => void };
    ImagePickerModal?: { prepareAlbumImageForRef?: (img: Record<string, unknown>) => Promise<{ key: string; file_name?: string } | null> };
    customDialog?: {
        confirm?: (msg: string, opts?: Record<string, unknown>) => Promise<boolean>;
        alert?: (msg: string, opts?: Record<string, unknown>) => void;
    };
    CustomDialog?: new () => NonNullable<Window["customDialog"]>;
    storageManager?: {
        saveWorkflowFull?: (...args: unknown[]) => Promise<unknown>;
        getWorkflow?: (wfId: string) => Promise<unknown>;
        resetWorkflow?: (wfId: string) => Promise<void>;
        updateNodeStatus?: (wfId: string, nodeId: string, patch: Record<string, unknown>) => Promise<void>;
    };
    workflowExecutor?: {
        isRunning?: boolean;
        shouldStop?: boolean;
        execute?: (wfId: string) => Promise<void>;
        executeSingleNode?: (wfId: string, nodeId: string) => Promise<void>;
        reset?: (wfId: string) => Promise<void>;
        stop?: (broadcast?: boolean) => void;
    };
    WorkflowExecutor?: {
        clearCrossContextRunning?: () => Promise<void>;
        getCrossContextRunning?: () => Promise<{ wf_id?: string; wf_name?: string } | null>;
    };
    featureGate?: {
        canUse?: (key: string) => boolean;
        canCreateWorkflowAsync?: () => Promise<boolean>;
        canManageWorkflowTemplates?: () => boolean;
        showModuleBlockedDialog?: (key: string) => void;
        showLoginPrompt?: (msg: string) => void;
        setPendingWorkflowRun?: () => void;
        checkGlobalQuotaWarning?: (scope: string) => { exhausted?: boolean };
    };
    authManager?: {
        isLoggedIn?: () => boolean;
        _apiCall?: (method: string, path: string, body?: unknown) => Promise<unknown>;
    };
    showNotification?: (msg: string, type?: string) => void;
    WorkflowExportHelper?: {
        buildExportData?: (...args: unknown[]) => unknown;
        buildExportFilename?: (name: string) => string;
        downloadJson?: (data: unknown, filename: string) => void;
    };
    ShareWorkflowModal?: { show?: (wfId: string) => void };
    SaveTemplateModal?: { show?: (workflowData: Record<string, unknown>) => Promise<{ success?: boolean; template?: { id?: string } } | null> };
    pendingUploadFiles?: Map<string, { file: File; thumbnail?: string; name?: string }>;
}

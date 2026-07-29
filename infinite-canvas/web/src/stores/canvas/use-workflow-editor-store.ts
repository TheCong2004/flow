import { create } from "zustand";

import type { TobyFlowWorkflow } from "@/lib/canvas/tobyflow-adapter";
import { EditorMode, type EditorModeValue, type EditorPermission } from "@/types/canvas";

export const EditorPermissions: Record<EditorModeValue, EditorPermission> = {
    [EditorMode.WORKFLOW_CREATE]: {
        canEdit: true,
        canSave: true,
        canRun: false,
        canShare: false,
        canReset: false,
        canExport: false,
        canDelete: false,
        canDuplicate: false,
        showLog: false,
        showQuota: true,
        showToggle: false,
    },
    [EditorMode.WORKFLOW_EDIT]: {
        canEdit: true,
        canSave: true,
        canRun: true,
        canShare: true,
        canReset: true,
        canExport: true,
        canDelete: true,
        canDuplicate: false,
        showLog: true,
        showQuota: true,
        showToggle: true,
    },
    [EditorMode.SHARED_PREVIEW]: {
        canEdit: false,
        canSave: false,
        canRun: false,
        canShare: false,
        canReset: false,
        canExport: true,
        canDelete: false,
        canDuplicate: true,
        showLog: false,
        showQuota: false,
        showToggle: false,
    },
    [EditorMode.ADMIN_PREVIEW]: {
        canEdit: false,
        canSave: false,
        canRun: false,
        canShare: false,
        canReset: false,
        canExport: true,
        canDelete: false,
        canDuplicate: false,
        showLog: true,
        showQuota: false,
        showToggle: false,
    },
    [EditorMode.TEMPLATE_PREVIEW]: {
        canEdit: false,
        canSave: false,
        canRun: false,
        canShare: false,
        canReset: false,
        canExport: false,
        canDelete: false,
        canDuplicate: true,
        showLog: false,
        showQuota: false,
        showToggle: false,
    },
    [EditorMode.TEMPLATE_CREATE]: {
        canEdit: true,
        canSave: true,
        canRun: false,
        canShare: false,
        canReset: false,
        canExport: false,
        canDelete: false,
        canDuplicate: false,
        showLog: false,
        showQuota: false,
        showToggle: false,
    },
    [EditorMode.TEMPLATE_EDIT]: {
        canEdit: true,
        canSave: true,
        canRun: false,
        canShare: false,
        canReset: false,
        canExport: false,
        canDelete: true,
        canDuplicate: false,
        showLog: false,
        showQuota: false,
        showToggle: false,
    },
};

export type TileCacheEntry = {
    thumbnail?: string;
    video_url?: string;
    type?: string;
    file_name?: string;
    _permanently_broken?: boolean;
};

export type ExecutionProgress = {
    completed: number;
    total: number;
};

type WorkflowEditorStore = {
    isWorkflowMode: boolean;
    editorMode: EditorModeValue;
    legacyMode: "create" | "edit" | "view" | "admin_preview";
    workflowId: string | null;
    workflowName: string;
    workflowBase: Partial<TobyFlowWorkflow> | null;
    isTemplateMode: boolean;
    templateId: string | null;
    templateData: Record<string, unknown> | null;
    isSaving: boolean;
    isRunPending: boolean;
    isExecuting: boolean;
    currentRunningNodeId: string | null;
    executionProgress: ExecutionProgress | null;
    hasUnsavedChanges: boolean;
    formUploadKeys: Set<string>;
    uploadNodeByKey: Map<string, string>;
    tileCache: Map<string, TileCacheEntry>;
    resetInProgress: boolean;
    openedToViewRunning: boolean;

    setWorkflowMode: (active: boolean) => void;
    setEditorMode: (mode: EditorModeValue) => void;
    setWorkflowMeta: (meta: { workflowId?: string | null; workflowName?: string }) => void;
    setWorkflowBase: (base: Partial<TobyFlowWorkflow> | null) => void;
    setLegacyMode: (mode: WorkflowEditorStore["legacyMode"]) => void;
    setTemplateMeta: (meta: { isTemplateMode?: boolean; templateId?: string | null; templateData?: Record<string, unknown> | null }) => void;
    setExecuting: (value: boolean) => void;
    setCurrentRunningNode: (nodeId: string | null) => void;
    setExecutionProgress: (progress: ExecutionProgress | null) => void;
    getPermissions: () => EditorPermission;
    isReadOnly: () => boolean;
    isPreviewMode: () => boolean;
    markUnsaved: () => void;
    clearUnsaved: () => void;
    trackUploadKey: (key: string, nodeId?: string) => void;
    untrackUploadKey: (key: string) => void;
    getUploadNodeId: (key: string) => string | undefined;
    cleanupUploadKeys: () => void;
    countActiveUploads: () => number;
    setResetInProgress: (value: boolean) => void;
    tileCacheSet: (key: string, value: TileCacheEntry) => void;
    getTileCache: () => Map<string, TileCacheEntry>;
    reset: () => void;
};

const TILE_CACHE_MAX = 100;

const initialState = {
    isWorkflowMode: false,
    editorMode: EditorMode.WORKFLOW_CREATE as EditorModeValue,
    legacyMode: "create" as WorkflowEditorStore["legacyMode"],
    workflowId: null as string | null,
    workflowName: "",
    workflowBase: null as Partial<TobyFlowWorkflow> | null,
    isTemplateMode: false,
    templateId: null as string | null,
    templateData: null as Record<string, unknown> | null,
    isSaving: false,
    isRunPending: false,
    isExecuting: false,
    currentRunningNodeId: null as string | null,
    executionProgress: null as ExecutionProgress | null,
    hasUnsavedChanges: false,
    formUploadKeys: new Set<string>(),
    uploadNodeByKey: new Map<string, string>(),
    tileCache: new Map<string, TileCacheEntry>(),
    resetInProgress: false,
    openedToViewRunning: false,
};

export const useWorkflowEditorStore = create<WorkflowEditorStore>((set, get) => ({
    ...initialState,

    setWorkflowMode: (isWorkflowMode) => set({ isWorkflowMode }),
    setEditorMode: (editorMode) => set({ editorMode }),
    setWorkflowMeta: ({ workflowId, workflowName }) =>
        set((state) => ({
            workflowId: workflowId !== undefined ? workflowId : state.workflowId,
            workflowName: workflowName !== undefined ? workflowName : state.workflowName,
        })),

    setWorkflowBase: (workflowBase) => set({ workflowBase }),
    setLegacyMode: (legacyMode) => set({ legacyMode }),

    setTemplateMeta: ({ isTemplateMode, templateId, templateData }) =>
        set((state) => ({
            isTemplateMode: isTemplateMode !== undefined ? isTemplateMode : state.isTemplateMode,
            templateId: templateId !== undefined ? templateId : state.templateId,
            templateData: templateData !== undefined ? templateData : state.templateData,
        })),

    setExecuting: (isExecuting) => set({ isExecuting }),
    setCurrentRunningNode: (currentRunningNodeId) => set({ currentRunningNodeId }),
    setExecutionProgress: (executionProgress) => set({ executionProgress }),

    getPermissions: () => EditorPermissions[get().editorMode] || EditorPermissions[EditorMode.WORKFLOW_CREATE],

    isReadOnly: () => {
        const mode = get().editorMode;
        return mode === EditorMode.SHARED_PREVIEW || mode === EditorMode.ADMIN_PREVIEW || mode === EditorMode.TEMPLATE_PREVIEW;
    },

    isPreviewMode: () => get().isReadOnly(),

    markUnsaved: () => set({ hasUnsavedChanges: true }),
    clearUnsaved: () => set({ hasUnsavedChanges: false }),

    trackUploadKey: (key, nodeId) =>
        set((state) => {
            const nextKeys = new Set(state.formUploadKeys);
            nextKeys.add(key);
            const nextMap = new Map(state.uploadNodeByKey);
            if (nodeId) nextMap.set(key, nodeId);
            return { formUploadKeys: nextKeys, uploadNodeByKey: nextMap };
        }),

    untrackUploadKey: (key) =>
        set((state) => {
            const nextKeys = new Set(state.formUploadKeys);
            nextKeys.delete(key);
            const nextMap = new Map(state.uploadNodeByKey);
            nextMap.delete(key);
            return { formUploadKeys: nextKeys, uploadNodeByKey: nextMap };
        }),

    getUploadNodeId: (key) => get().uploadNodeByKey.get(key),

    cleanupUploadKeys: () => {
        const keys = get().formUploadKeys;
        if (keys.size > 0) {
            const uploader = (window as Window & { ImmediateUploader?: { cancelAll: (keys: Set<string>) => void } }).ImmediateUploader;
            uploader?.cancelAll(keys);
        }
        set({ formUploadKeys: new Set(), uploadNodeByKey: new Map() });
    },

    countActiveUploads: () => get().formUploadKeys.size,

    setResetInProgress: (resetInProgress) => set({ resetInProgress }),

    tileCacheSet: (key, value) =>
        set((state) => {
            const next = new Map(state.tileCache);
            if (next.has(key)) next.delete(key);
            next.set(key, value);
            if (next.size > TILE_CACHE_MAX) {
                const oldest = next.keys().next().value;
                if (oldest) next.delete(oldest);
            }
            return { tileCache: next };
        }),

    getTileCache: () => get().tileCache,

    reset: () => set({ ...initialState, formUploadKeys: new Set(), uploadNodeByKey: new Map(), tileCache: new Map() }),
}));

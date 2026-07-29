export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
}

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";

export const EditorMode = {
    WORKFLOW_CREATE: "workflow_create",
    WORKFLOW_EDIT: "workflow_edit",
    SHARED_PREVIEW: "shared_preview",
    ADMIN_PREVIEW: "admin_preview",
    TEMPLATE_PREVIEW: "template_preview",
    TEMPLATE_CREATE: "template_create",
    TEMPLATE_EDIT: "template_edit",
} as const;

export type EditorModeValue = (typeof EditorMode)[keyof typeof EditorMode];

export type EditorPermission = {
    canEdit: boolean;
    canSave: boolean;
    canRun: boolean;
    canShare: boolean;
    canReset: boolean;
    canExport: boolean;
    canDelete: boolean;
    canDuplicate: boolean;
    showLog: boolean;
    showQuota: boolean;
    showToggle: boolean;
};

export type TobyFlowExecutionStatus = "pending" | "running" | "completed" | "failed";

export type TobyFlowNodeMetadata = {
    nodeId?: string;
    nodeType?: string;
    slug?: string;
    slugAuto?: boolean;
    refFileIds?: string;
    refThumbnails?: Record<string, string>;
    refFileNames?: Record<string, string>;
    resultFileIds?: string;
    resultThumbnails?: Record<string, string>;
    executionStatus?: TobyFlowExecutionStatus;
    errorMessage?: string;
    enabled?: boolean;
    /** Full server node payload — preserved for round-trip save */
    raw?: Record<string, unknown>;
};

export type CanvasNodeMetadata = {
    content?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    tobyflow?: TobyFlowNodeMetadata;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    size?: string;
    quality?: string;
    count?: number;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    isBatchRoot?: boolean;
    batchRootId?: string;
    batchChildIds?: string[];
    batchUsesReferenceImages?: boolean;
    primaryImageId?: string;
    imageBatchExpanded?: boolean;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeType;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type TobyFlowPortType = "text" | "image" | "video" | "frame" | "any";

export type TobyFlowPortDef = {
    name: string;
    type: TobyFlowPortType;
    required?: boolean;
    multiple?: boolean;
    label?: string;
    acceptFromNodeTypes?: string[];
    visibleWhen?: string;
    dynamicType?: string;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    sourcePort?: string;
    targetPort?: string;
    sourceHandle?: string;
    targetHandle?: string;
    dataType?: TobyFlowPortType | string;
    /** Full server edge payload for round-trip */
    raw?: Record<string, unknown>;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeType;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool" | "error";
    title?: string;
    text: string;
    meta?: string;
    detail?: unknown;
    references?: CanvasAssistantReference[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };

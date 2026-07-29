import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { normalizeEdgePorts } from "@/lib/canvas/tobyflow-port-system";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import { CanvasNodeType, EditorMode, type CanvasConnection, type CanvasNodeData, type CanvasNodeStatus, type EditorModeValue, type TobyFlowExecutionStatus, type TobyFlowNodeMetadata } from "@/types/canvas";

export type TobyFlowWorkflow = {
    wf_id?: string;
    wf_name?: string;
    project_id?: string | null;
    platform?: string;
    status?: string;
    enabled?: boolean;
    nodes?: TobyFlowNode[];
    edges?: TobyFlowConnection[];
    connections?: TobyFlowConnection[];
    _is_shared_view?: boolean;
    _is_admin_view?: boolean;
    _is_template_preview?: boolean;
    _isPreview?: boolean;
    _template_id?: string | number;
    _original_template?: Record<string, unknown> | null;
    _is_community_template?: boolean;
};

export type TobyFlowNode = {
    node_id: string;
    node_type: string;
    node_name?: string;
    slug?: string;
    slug_auto?: boolean;
    pos_x?: number;
    pos_y?: number;
    ref_file_ids?: string;
    ref_thumbnails?: Record<string, string>;
    ref_file_names?: Record<string, string>;
    result_file_ids?: string;
    result_thumbnails?: Record<string, string>;
    status?: TobyFlowExecutionStatus;
    error_message?: string;
    enabled?: boolean;
    data?: Partial<TobyFlowNode>;
};

export type TobyFlowConnection = {
    edge_id?: string;
    from_node_id?: string;
    to_node_id?: string;
    source_node_id?: string;
    target_node_id?: string;
    source_port?: string;
    target_port?: string;
    source_handle?: string;
    target_handle?: string;
    data_type?: string;
};

export type TobyFlowLoadPayload = {
    mode?: string;
    workflow?: TobyFlowWorkflow | null;
    isTemplateMode?: boolean;
    templateId?: string | null;
    openedToViewRunning?: boolean;
};

const STATUS_TO_CANVAS: Record<TobyFlowExecutionStatus, CanvasNodeStatus> = {
    pending: "idle",
    running: "loading",
    completed: "success",
    failed: "error",
};

const STATUS_TO_TOBYFLOW: Record<CanvasNodeStatus, TobyFlowExecutionStatus> = {
    idle: "pending",
    loading: "running",
    success: "completed",
    error: "failed",
};

const NODE_TYPE_MAP: Record<string, CanvasNodeType> = {
    image: CanvasNodeType.Image,
    text: CanvasNodeType.Text,
    text_extract: CanvasNodeType.Text,
    // generate: map theo media_type ở mapNodeType() — Image→Config (có composer), Video→Video
    generate: CanvasNodeType.Config,
    chatgpt: CanvasNodeType.Text,
    grok: CanvasNodeType.Text,
    prompt: CanvasNodeType.Text,
    delay: CanvasNodeType.Config,
    download: CanvasNodeType.Config,
    telegram: CanvasNodeType.Config,
    note: CanvasNodeType.Text,
    start: CanvasNodeType.Config,
    video: CanvasNodeType.Video,
    audio: CanvasNodeType.Audio,
    config: CanvasNodeType.Config,
};

function normalizeWorkflowNode(node: TobyFlowNode): TobyFlowNode {
    const data = { ...(node.data || {}), ...node } as Record<string, unknown>;
    const nt = (window as Window & { NodeTemplates?: { normalizeNodeData?: (d: Record<string, unknown>) => void } }).NodeTemplates;
    try {
        nt?.normalizeNodeData?.(data);
    } catch {
        /* ignore */
    }
    return { ...node, ...data, data } as TobyFlowNode;
}

/** Lấy text hiển thị / composer từ node TobyFlow (prompt, note, result_text). */
function extractNodePromptText(node: TobyFlowNode & Record<string, unknown>): string {
    const data = (node.data || {}) as Record<string, unknown>;
    const candidates = [node.prompt, data.prompt, node.note_text, data.note_text, node.result_text, data.result_text];
    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c;
    }
    return "";
}

function workflowEdges(workflow: TobyFlowWorkflow): TobyFlowConnection[] {
    const wf = workflow as TobyFlowWorkflow & { edges?: TobyFlowConnection[] };
    return wf.edges || workflow.connections || [];
}

export function isTempUploadId(id: string): boolean {
    if (!id || typeof id !== "string") return false;
    if (id.startsWith("upload_import_")) return false;
    return id.startsWith("upload_");
}

export function stripTempIds(refFileIds: string): string {
    if (!refFileIds) return "";
    return refFileIds
        .split(",")
        .map((s) => s.trim())
        .filter((id) => id && !isTempUploadId(id))
        .join(",");
}

export function stripTempIdKeys(obj?: Record<string, string>): Record<string, string> | undefined {
    if (!obj || typeof obj !== "object") return obj;
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (!isTempUploadId(key)) cleaned[key] = value;
    }
    return cleaned;
}

function mapNodeType(nodeType: string, mediaType?: string): CanvasNodeType {
    // Flow Generate Video → canvas Video (không phải Image trống)
    if (nodeType === "generate" && String(mediaType || "").toLowerCase() === "video") {
        return CanvasNodeType.Video;
    }
    if (nodeType === "generate") {
        // Image gen: Config node có composer prompt (tránh "NODE ẢNH TRỐNG")
        return CanvasNodeType.Config;
    }
    return NODE_TYPE_MAP[nodeType] || CanvasNodeType.Text;
}

function nodeSize(type: CanvasNodeType) {
    const spec = NODE_DEFAULT_SIZE[type];
    return { width: spec.width, height: spec.height };
}

function buildTobyflowMetadata(node: TobyFlowNode): TobyFlowNodeMetadata {
    const data = node.data || {};
    const merged = { ...data, ...node } as Record<string, unknown>;
    return {
        nodeId: node.node_id,
        nodeType: node.node_type || data.node_type,
        slug: node.slug || data.slug,
        slugAuto: node.slug_auto ?? data.slug_auto,
        refFileIds: node.ref_file_ids || data.ref_file_ids,
        refThumbnails: node.ref_thumbnails || data.ref_thumbnails,
        refFileNames: node.ref_file_names || data.ref_file_names,
        resultFileIds: node.result_file_ids || data.result_file_ids,
        resultThumbnails: node.result_thumbnails || data.result_thumbnails,
        executionStatus: (node.status || data.status || "pending") as TobyFlowExecutionStatus,
        errorMessage: node.error_message || data.error_message,
        enabled: (node.enabled ?? data.enabled) !== false,
        raw: merged,
    };
}

function connectionEndpoints(connection: TobyFlowConnection) {
    return {
        from: connection.source_node_id || connection.from_node_id || "",
        to: connection.target_node_id || connection.to_node_id || "",
    };
}

export class TobyFlowCanvasAdapter {
    static workflowToCanvas(workflow: TobyFlowWorkflow): Pick<CanvasProject, "nodes" | "connections"> & { title?: string } {
        const nodes: CanvasNodeData[] = (workflow.nodes || []).map((raw) => {
            const node = normalizeWorkflowNode({ ...raw, ...(raw.data || {}) } as TobyFlowNode & Record<string, unknown>);
            const mediaType = String((node as Record<string, unknown>).media_type || (node.data as Record<string, unknown> | undefined)?.media_type || "");
            const type = mapNodeType(node.node_type, mediaType);
            const { width, height } = nodeSize(type);
            const tf = buildTobyflowMetadata(node);
            const execStatus = tf.executionStatus || "pending";
            // CRITICAL: infinite-canvas Text/Config đọc metadata.content | prompt | composerContent
            // — nếu không đổ prompt từ TobyFlow → node hiện "Nhấp đúp..." / NODE ẢNH TRỐNG.
            const promptText = extractNodePromptText(node as TobyFlowNode & Record<string, unknown>);
            const title = node.node_name || node.node_type || "Node";

            const metadata: CanvasNodeData["metadata"] = {
                status: STATUS_TO_CANVAS[execStatus],
                errorDetails: tf.errorMessage,
                tobyflow: tf,
            };
            if (promptText) {
                metadata.content = promptText;
                metadata.prompt = promptText;
                metadata.composerContent = promptText;
            }
            // Video gen: gắn duration/mode để panel config hiểu
            if (type === CanvasNodeType.Video || mediaType.toLowerCase() === "video") {
                metadata.generationMode = "video";
                const dur = String((node as Record<string, unknown>).video_duration || (node.data as Record<string, unknown> | undefined)?.video_duration || "8s").replace(/s$/i, "");
                if (dur) metadata.seconds = dur;
            } else if (node.node_type === "generate") {
                metadata.generationMode = "image";
            }

            return {
                id: node.node_id,
                type,
                title,
                position: { x: node.pos_x ?? 0, y: node.pos_y ?? 0 },
                width,
                height,
                metadata,
            };
        });

        const nodeById = new Map(nodes.map((n) => [n.id, n]));

        const connections: CanvasConnection[] = workflowEdges(workflow).map((c, index) => {
            const { from, to } = connectionEndpoints(c);
            const sourceNode = nodeById.get(from);
            const targetNode = nodeById.get(to);
            const ports =
                sourceNode && targetNode
                    ? normalizeEdgePorts(c, sourceNode, targetNode)
                    : {
                          sourcePort: c.source_port,
                          targetPort: c.target_port,
                          sourceHandle: c.source_handle || "output_1",
                          targetHandle: c.target_handle || "input_1",
                          dataType: c.data_type || "image",
                      };

            return {
                id: c.edge_id || `conn-${from}-${to}-${index}`,
                fromNodeId: from,
                toNodeId: to,
                sourcePort: ports.sourcePort,
                targetPort: ports.targetPort,
                sourceHandle: ports.sourceHandle,
                targetHandle: ports.targetHandle,
                dataType: ports.dataType,
                raw: { ...c },
            };
        });

        return { nodes, connections, title: workflow.wf_name };
    }

    static canvasToWorkflow(project: Pick<CanvasProject, "nodes" | "connections">, meta: { wf_id?: string; wf_name?: string }): TobyFlowWorkflow {
        const nodes: TobyFlowNode[] = project.nodes.map((n) => {
            const tf = n.metadata?.tobyflow;
            const executionStatus = (tf?.executionStatus || STATUS_TO_TOBYFLOW[n.metadata?.status || "idle"]) as TobyFlowExecutionStatus;
            return {
                node_id: tf?.nodeId || n.id,
                node_type: tf?.nodeType || n.type,
                node_name: n.title,
                slug: tf?.slug,
                slug_auto: tf?.slugAuto,
                pos_x: n.position.x,
                pos_y: n.position.y,
                ref_file_ids: stripTempIds(tf?.refFileIds || ""),
                ref_thumbnails: stripTempIdKeys(tf?.refThumbnails),
                ref_file_names: stripTempIdKeys(tf?.refFileNames),
                result_file_ids: stripTempIds(tf?.resultFileIds || ""),
                result_thumbnails: stripTempIdKeys(tf?.resultThumbnails),
                status: executionStatus,
                error_message: tf?.errorMessage,
                enabled: tf?.enabled !== false,
            };
        });

        const connections: TobyFlowConnection[] = project.connections.map((c) => ({
            edge_id: c.id,
            source_node_id: c.fromNodeId,
            target_node_id: c.toNodeId,
            from_node_id: c.fromNodeId,
            to_node_id: c.toNodeId,
            source_port: c.sourcePort,
            target_port: c.targetPort,
            source_handle: c.sourceHandle,
            target_handle: c.targetHandle,
            data_type: c.dataType,
        }));

        return { ...meta, nodes, connections };
    }

    static syncEditorMode(payload: TobyFlowLoadPayload): EditorModeValue {
        const workflow = payload.workflow;
        const mode = payload.mode || "create";
        const isTemplateMode = Boolean(payload.isTemplateMode);

        if (isTemplateMode) {
            return payload.templateId ? EditorMode.TEMPLATE_EDIT : EditorMode.TEMPLATE_CREATE;
        }
        if (workflow?._is_admin_view) return EditorMode.ADMIN_PREVIEW;
        if (workflow?._is_shared_view) return EditorMode.SHARED_PREVIEW;
        if (workflow?._is_template_preview || workflow?._isPreview) return EditorMode.TEMPLATE_PREVIEW;
        if (mode === "view" || mode === "admin_preview") return EditorMode.ADMIN_PREVIEW;
        if (mode === "create") return EditorMode.WORKFLOW_CREATE;
        return EditorMode.WORKFLOW_EDIT;
    }

    static canvasToSaveExport(
        project: Pick<CanvasProject, "nodes" | "connections">,
        meta: {
            wf_id?: string;
            wf_name?: string;
            workflowBase?: Partial<TobyFlowWorkflow>;
            legacyMode?: string;
        },
    ) {
        const nodes = project.nodes.map((n) => {
            const tf = n.metadata?.tobyflow;
            const raw = (tf?.raw || {}) as Record<string, unknown>;
            const executionStatus = (tf?.executionStatus || STATUS_TO_TOBYFLOW[n.metadata?.status || "idle"]) as TobyFlowExecutionStatus;
            const refFileIds = stripTempIds(tf?.refFileIds || "");
            const hasRefFileIds = refFileIds.trim().length > 0;
            // Đồng bộ text user sửa trên canvas → prompt TobyFlow (executor đọc node.prompt)
            const canvasText = String(n.metadata?.content || n.metadata?.composerContent || n.metadata?.prompt || raw.prompt || "");

            return {
                ...raw,
                node_id: tf?.nodeId || n.id,
                node_type: (tf?.nodeType || raw.node_type || n.type) as string,
                node_name: n.title || (raw.node_name as string) || tf?.nodeType,
                slug: tf?.slug ?? raw.slug,
                slug_auto: tf?.slugAuto ?? raw.slug_auto,
                pos_x: n.position.x,
                pos_y: n.position.y,
                // Giữ prompt canvas; note node dùng note_text
                prompt: canvasText || (raw.prompt as string) || "",
                note_text: tf?.nodeType === "note" || raw.node_type === "note" ? canvasText || (raw.note_text as string) || "" : raw.note_text,
                ref_file_ids: refFileIds,
                ref_thumbnails: hasRefFileIds ? stripTempIdKeys(tf?.refThumbnails) : {},
                ref_file_names: hasRefFileIds ? stripTempIdKeys(tf?.refFileNames) : {},
                result_file_ids: stripTempIds(tf?.resultFileIds || (raw.result_file_ids as string) || ""),
                result_thumbnails: stripTempIdKeys(tf?.resultThumbnails) || raw.result_thumbnails,
                status: executionStatus,
                error_message: tf?.errorMessage || "",
                enabled: tf?.enabled !== false,
            };
        });

        const edges = project.connections.map((c, index) => {
            const raw = (c.raw || {}) as Record<string, unknown>;
            const sourcePort = c.sourcePort || (raw.source_port as string);
            const targetPort = c.targetPort || (raw.target_port as string);
            return {
                ...raw,
                edge_id: c.id.startsWith("conn-") ? `edge_${c.fromNodeId}_${c.toNodeId}_${index}` : c.id,
                source_node_id: c.fromNodeId,
                target_node_id: c.toNodeId,
                from_node_id: c.fromNodeId,
                to_node_id: c.toNodeId,
                source_port: sourcePort && sourcePort !== "default" ? sourcePort : raw.source_port || "default",
                target_port: targetPort && targetPort !== "default" ? targetPort : raw.target_port || "default",
                source_handle: c.sourceHandle || (raw.source_handle as string) || "output_1",
                target_handle: c.targetHandle || (raw.target_handle as string) || "input_1",
                data_type: c.dataType || (raw.data_type as string) || "image",
            };
        });

        const { nodes: _n, edges: _e, ...workflowBase } = meta.workflowBase || {};
        const workflowData = {
            ...workflowBase,
            wf_id: meta.wf_id,
            wf_name: meta.wf_name || workflowBase.wf_name || "Workflow",
            progress_total: nodes.length,
            project_id: workflowBase.project_id ?? (window as Window & { _currentProjectId?: string })._currentProjectId ?? null,
            platform: workflowBase.platform || "flow",
        };

        return { nodes, edges, workflowData, legacyMode: meta.legacyMode || (meta.wf_id ? "edit" : "create") };
    }

    static applyExecutionStatus(node: CanvasNodeData, status: TobyFlowExecutionStatus, patch?: Partial<TobyFlowNodeMetadata>): CanvasNodeData {
        const tf = node.metadata?.tobyflow || {};
        return {
            ...node,
            metadata: {
                ...node.metadata,
                status: STATUS_TO_CANVAS[status],
                errorDetails: status === "failed" ? patch?.errorMessage || tf.errorMessage : undefined,
                tobyflow: {
                    ...tf,
                    executionStatus: status,
                    ...patch,
                },
            },
        };
    }
}

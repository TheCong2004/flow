import type { CanvasConnection, CanvasNodeData, TobyFlowPortDef, TobyFlowPortType } from "@/types/canvas";

export const PORT_COMPAT: Record<TobyFlowPortType, TobyFlowPortType[]> = {
    text: ["text", "any"],
    image: ["image", "frame", "any"],
    video: ["video", "any"],
    frame: ["frame", "image", "any"],
    any: ["text", "image", "video", "frame", "any"],
};

/** Local fallback — mirror NodeTemplates.types ports (server may override via window.NodeTemplates) */
const LOCAL_NODE_PORTS: Record<string, { in: TobyFlowPortDef[]; out: TobyFlowPortDef[] }> = {
    generate: {
        in: [
            { name: "image_ref", type: "image", multiple: true, label: "Reference images" },
            { name: "text", type: "text", label: "Prompt text" },
            { name: "frame_1", type: "frame", label: "Frame 1", visibleWhen: "isVideoFrames" },
            { name: "frame_2", type: "frame", label: "Frame 2", visibleWhen: "isVideoFrames" },
            { name: "video_ref", type: "video", label: "Reference video", visibleWhen: "isVideoIngredient", acceptFromNodeTypes: ["generate"] },
        ],
        out: [{ name: "media", type: "image", label: "Result", dynamicType: "media_type" }],
    },
    download: {
        in: [{ name: "media_in", type: "any", required: true, multiple: true, label: "Files to download" }],
        out: [],
    },
    delay: {
        in: [{ name: "any_in", type: "any", label: "Input pass-through" }],
        out: [{ name: "any_out", type: "any", label: "Output after delay" }],
    },
    image: {
        in: [],
        out: [{ name: "media", type: "image", label: "Ref image" }],
    },
    text: {
        in: [],
        out: [{ name: "text", type: "text", label: "Text output" }],
    },
    text_extract: {
        in: [{ name: "text", type: "text", label: "Input text" }],
        out: [{ name: "text", type: "text", label: "Extracted text" }],
    },
    telegram: {
        in: [{ name: "media_in", type: "any", required: true, multiple: true, label: "Files to Telegram" }],
        out: [{ name: "pass", type: "any", label: "Pass-through" }],
    },
    chatgpt: {
        in: [
            { name: "image_ref", type: "image", multiple: true, label: "Reference images" },
            { name: "text", type: "text", label: "Prompt text" },
        ],
        out: [{ name: "media", type: "image", label: "ChatGPT images" }],
    },
    grok: {
        in: [
            { name: "image_ref", type: "image", multiple: true, label: "Reference images" },
            { name: "text", type: "text", label: "Prompt text" },
        ],
        out: [{ name: "media", type: "image", label: "Result", dynamicType: "grok_mode" }],
    },
    prompt: {
        in: [
            { name: "text", type: "text", label: "Prompt upstream" },
            { name: "image_ref", type: "image", multiple: true, label: "Reference images", visibleWhen: "enhance" },
        ],
        out: [{ name: "text", type: "text", label: "Result text" }],
    },
    note: { in: [], out: [] },
};

export type WorkflowConnectionValidation = {
    ok: boolean;
    error?: string;
    sourcePort?: string;
    targetPort?: string;
    sourceHandle?: string;
    targetHandle?: string;
    dataType?: string;
};

function extensionNodeTemplates() {
    return (
        window as Window & {
            NodeTemplates?: {
                getNodePorts?: (type: string, data?: Record<string, unknown>) => { in: TobyFlowPortDef[]; out: TobyFlowPortDef[] };
            };
        }
    ).NodeTemplates;
}

export function getWorkflowNodeType(node: CanvasNodeData): string {
    return node.metadata?.tobyflow?.nodeType || (node.metadata?.tobyflow?.raw?.node_type as string) || node.type;
}

export function getWorkflowNodeData(node: CanvasNodeData): Record<string, unknown> {
    return (node.metadata?.tobyflow?.raw || {}) as Record<string, unknown>;
}

function filterDynamicPorts(ports: TobyFlowPortDef[], data: Record<string, unknown>) {
    return ports.filter((port) => {
        if (!port.visibleWhen) return true;
        if (port.visibleWhen === "isVideoFrames") {
            return data.media_type === "Video" && data.video_input_type === "Frames";
        }
        if (port.visibleWhen === "isVideoIngredient") {
            return data.media_type === "Video" && data.video_input_type === "Ingredients";
        }
        if (port.visibleWhen === "enhance") {
            return Boolean(data.use_ai);
        }
        return true;
    });
}

function resolveDynamicPort(port: TobyFlowPortDef, data: Record<string, unknown>): TobyFlowPortDef {
    if (!port.dynamicType) return port;
    if (port.dynamicType === "media_type") {
        const mt = (data.media_type as string) || "Image";
        return { ...port, type: mt === "Video" ? "video" : "image" };
    }
    if (port.dynamicType === "grok_mode") {
        const mode = (data.grok_mode as string) || (data.mode as string) || "image";
        return { ...port, type: mode === "video" ? "video" : "image" };
    }
    return port;
}

export function getNodePorts(nodeType: string, data: Record<string, unknown> = {}) {
    const ext = extensionNodeTemplates()?.getNodePorts?.(nodeType, data);
    if (ext && (ext.in.length > 0 || ext.out.length > 0)) {
        return ext;
    }

    const local = LOCAL_NODE_PORTS[nodeType];
    if (!local) return { in: [], out: [] };

    return {
        in: filterDynamicPorts(local.in, data).map((port) => resolveDynamicPort(port, data)),
        out: filterDynamicPorts(local.out, data).map((port) => resolveDynamicPort(port, data)),
    };
}

export function portIndexToHandle(kind: "input" | "output", index: number) {
    return `${kind === "output" ? "output" : "input"}_${index + 1}`;
}

export function findPortIndex(ports: TobyFlowPortDef[], portName?: string) {
    if (!portName) return -1;
    return ports.findIndex((port) => port.name === portName);
}

export function arePortTypesCompatible(sourceType: TobyFlowPortType, targetType: TobyFlowPortType) {
    return (PORT_COMPAT[sourceType] || []).includes(targetType);
}

export function inferDataTypeFromPort(portType?: TobyFlowPortType | string) {
    if (portType === "text") return "text";
    if (portType === "video") return "video";
    if (portType === "frame" || portType === "image") return "image";
    return "image";
}

export function countTargetPortConnections(connections: CanvasConnection[], targetNodeId: string, targetPort: string) {
    return connections.filter((c) => c.toNodeId === targetNodeId && c.targetPort === targetPort).length;
}

export function suggestConnectionPorts(sourceNode: CanvasNodeData, targetNode: CanvasNodeData, existingConnections: CanvasConnection[], preferred?: { sourcePort?: string; targetPort?: string }): WorkflowConnectionValidation {
    const sourceType = getWorkflowNodeType(sourceNode);
    const targetType = getWorkflowNodeType(targetNode);
    const sourceData = getWorkflowNodeData(sourceNode);
    const targetData = getWorkflowNodeData(targetNode);
    const sourcePorts = getNodePorts(sourceType, sourceData);
    const targetPorts = getNodePorts(targetType, targetData);

    if (sourcePorts.out.length === 0) {
        return { ok: false, error: `Node "${sourceNode.title}" không có output port` };
    }
    if (targetPorts.in.length === 0) {
        return { ok: false, error: `Node "${targetNode.title}" không có input port` };
    }

    const tryPair = (sourcePortName: string, targetPortName: string): WorkflowConnectionValidation | null => {
        const sourcePort = sourcePorts.out.find((p) => p.name === sourcePortName);
        const targetPort = targetPorts.in.find((p) => p.name === targetPortName);
        if (!sourcePort || !targetPort) return null;

        if (!arePortTypesCompatible(sourcePort.type, targetPort.type)) {
            return {
                ok: false,
                error: `Port không tương thích: ${sourcePort.type} → ${targetPort.type}`,
            };
        }

        if (Array.isArray(targetPort.acceptFromNodeTypes) && targetPort.acceptFromNodeTypes.length > 0) {
            if (!targetPort.acceptFromNodeTypes.includes(sourceType)) {
                return {
                    ok: false,
                    error: `Port "${targetPort.label || targetPort.name}" chỉ nhận từ: ${targetPort.acceptFromNodeTypes.join(", ")}`,
                };
            }
        }

        if (targetPort.multiple === false) {
            const count = countTargetPortConnections(existingConnections, targetNode.id, targetPort.name);
            if (count > 0) {
                return {
                    ok: false,
                    error: `Port "${targetPort.label || targetPort.name}" chỉ chấp nhận 1 connection`,
                };
            }
        }

        const sourceIdx = findPortIndex(sourcePorts.out, sourcePort.name);
        const targetIdx = findPortIndex(targetPorts.in, targetPort.name);
        return {
            ok: true,
            sourcePort: sourcePort.name,
            targetPort: targetPort.name,
            sourceHandle: portIndexToHandle("output", sourceIdx >= 0 ? sourceIdx : 0),
            targetHandle: portIndexToHandle("input", targetIdx >= 0 ? targetIdx : 0),
            dataType: inferDataTypeFromPort(sourcePort.type),
        };
    };

    if (preferred?.sourcePort && preferred?.targetPort) {
        const direct = tryPair(preferred.sourcePort, preferred.targetPort);
        if (direct) return direct;
    }

    for (const outPort of sourcePorts.out) {
        const typeMatched = targetPorts.in.filter((inPort) => inPort.type === outPort.type);
        const candidates = typeMatched.length ? typeMatched : targetPorts.in;
        for (const inPort of candidates) {
            const result = tryPair(outPort.name, inPort.name);
            if (result?.ok) return result;
            if (result && !result.ok && result.error?.includes("không tương thích")) continue;
            if (result && !result.ok) return result;
        }
    }

    return { ok: false, error: "Không tìm thấy cặp port tương thích giữa hai node" };
}

export function normalizeEdgePorts(
    edge: {
        source_port?: string;
        target_port?: string;
        source_handle?: string;
        target_handle?: string;
        data_type?: string;
    },
    sourceNode: CanvasNodeData,
    targetNode: CanvasNodeData,
) {
    const hasSource = edge.source_port && edge.source_port !== "default";
    const hasTarget = edge.target_port && edge.target_port !== "default";
    if (hasSource && hasTarget) {
        const sourceType = getWorkflowNodeType(sourceNode);
        const targetType = getWorkflowNodeType(targetNode);
        const sourcePorts = getNodePorts(sourceType, getWorkflowNodeData(sourceNode));
        const targetPorts = getNodePorts(targetType, getWorkflowNodeData(targetNode));
        const sourceIdx = findPortIndex(sourcePorts.out, edge.source_port);
        const targetIdx = findPortIndex(targetPorts.in, edge.target_port);
        return {
            sourcePort: edge.source_port!,
            targetPort: edge.target_port!,
            sourceHandle: edge.source_handle || portIndexToHandle("output", sourceIdx >= 0 ? sourceIdx : 0),
            targetHandle: edge.target_handle || portIndexToHandle("input", targetIdx >= 0 ? targetIdx : 0),
            dataType: edge.data_type || inferDataTypeFromPort(sourcePorts.out[sourceIdx]?.type),
        };
    }

    const suggested = suggestConnectionPorts(sourceNode, targetNode, []);
    if (!suggested.ok) {
        return {
            sourcePort: edge.source_port || "default",
            targetPort: edge.target_port || "default",
            sourceHandle: edge.source_handle || "output_1",
            targetHandle: edge.target_handle || "input_1",
            dataType: edge.data_type || "image",
        };
    }
    return {
        sourcePort: suggested.sourcePort!,
        targetPort: suggested.targetPort!,
        sourceHandle: suggested.sourceHandle!,
        targetHandle: suggested.targetHandle!,
        dataType: suggested.dataType || "image",
    };
}

export function validateWorkflowConnection(sourceNode: CanvasNodeData, targetNode: CanvasNodeData, existingConnections: CanvasConnection[], preferred?: { sourcePort?: string; targetPort?: string }): WorkflowConnectionValidation {
    if (!sourceNode.metadata?.tobyflow && !targetNode.metadata?.tobyflow) {
        return { ok: true };
    }
    return suggestConnectionPorts(sourceNode, targetNode, existingConnections, preferred);
}

export function isWorkflowConnectionNode(node: CanvasNodeData) {
    return Boolean(node.metadata?.tobyflow?.nodeType || node.metadata?.tobyflow?.raw);
}

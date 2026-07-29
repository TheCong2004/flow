import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { getNodePorts, portIndexToHandle } from "@/lib/canvas/tobyflow-port-system";
import { CanvasNodeType, type CanvasNodeData, type Position } from "@/types/canvas";

const MENTIONABLE_TYPES = new Set(["image", "text", "text_extract", "generate", "chatgpt", "grok", "prompt"]);

const NODE_TYPE_MAP: Record<string, CanvasNodeType> = {
    image: CanvasNodeType.Image,
    text: CanvasNodeType.Text,
    text_extract: CanvasNodeType.Text,
    // generate: Config (composer) — Video gen map riêng nếu media_type=Video
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
};

export const WORKFLOW_PALETTE_TYPES = ["generate", "image", "text", "prompt", "chatgpt", "grok", "text_extract", "delay", "download", "telegram", "note"] as const;

export type WorkflowPaletteNodeType = (typeof WORKFLOW_PALETTE_TYPES)[number];

function extensionNodeTemplates() {
    return (
        window as Window & {
            IdGenerator?: { next: (kind: string) => string };
            NodeTemplates?: {
                getDefaults?: (type: string, settings?: unknown) => Record<string, unknown>;
                getType?: (type: string) => { name?: string; comingSoon?: boolean; sortOrder?: number };
                normalizeNodeData?: (data: Record<string, unknown>) => Record<string, unknown>;
            };
        }
    ).NodeTemplates;
}

function nextNodeId() {
    const win = window as Window & { IdGenerator?: { next: (kind: string) => string } };
    return win.IdGenerator?.next?.("node") || `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function slugify(name: string) {
    const base = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 48);
    return base || `node_${Math.random().toString(36).slice(2, 6)}`;
}

function buildPortMap(nodeType: string, data: Record<string, unknown>) {
    const ports = getNodePorts(nodeType, data);
    const portMap: Record<string, string> = { ...(data._port_map as Record<string, string> | undefined) };
    ports.in.forEach((port, idx) => {
        portMap[portIndexToHandle("input", idx)] = port.name;
    });
    ports.out.forEach((port, idx) => {
        portMap[portIndexToHandle("output", idx)] = port.name;
    });
    return portMap;
}

function getDefaultNodeData(nodeType: string): Record<string, unknown> {
    const nt = extensionNodeTemplates();
    const defaults = nt?.getDefaults?.(nodeType) || { enabled: true, status: "pending" };
    const data: Record<string, unknown> = {
        ...defaults,
        node_type: nodeType,
        enabled: defaults.enabled !== false,
        status: defaults.status || "pending",
    };
    nt?.normalizeNodeData?.(data);
    return data;
}

export function getWorkflowPaletteItems(): { type: WorkflowPaletteNodeType; label: string; disabled?: boolean }[] {
    const nt = extensionNodeTemplates();
    return WORKFLOW_PALETTE_TYPES.map((type) => {
        const config = nt?.getType?.(type);
        return {
            type,
            label: config?.name || type,
            disabled: Boolean(config?.comingSoon),
        };
    }).sort((a, b) => {
        const ao = nt?.getType?.(a.type)?.sortOrder ?? 999;
        const bo = nt?.getType?.(b.type)?.sortOrder ?? 999;
        return ao - bo;
    });
}

export function createTobyFlowCanvasNode(nodeType: string, position: Position, existingNodes: CanvasNodeData[] = []): CanvasNodeData {
    const nt = extensionNodeTemplates();
    const config = nt?.getType?.(nodeType);
    const label = config?.name || nodeType;
    const nodeId = nextNodeId();
    const data = getDefaultNodeData(nodeType);
    data.node_id = nodeId;
    data.node_name = label;
    data._port_map = buildPortMap(nodeType, data);

    if (MENTIONABLE_TYPES.has(nodeType)) {
        let slug = slugify(label);
        const used = new Set(existingNodes.map((n) => n.metadata?.tobyflow?.slug || (n.metadata?.tobyflow?.raw?.slug as string)).filter(Boolean));
        if (used.has(slug)) {
            slug = `${slug}_${nodeId.slice(-4)}`;
        }
        data.slug = slug;
        data.slug_auto = true;
    }

    const canvasType = NODE_TYPE_MAP[nodeType] || CanvasNodeType.Text;
    const spec = NODE_DEFAULT_SIZE[canvasType];

    const tf = {
        nodeId,
        nodeType,
        slug: data.slug as string | undefined,
        slugAuto: data.slug_auto as boolean | undefined,
        enabled: data.enabled !== false,
        executionStatus: "pending" as const,
        raw: { ...data },
    };

    return {
        id: nodeId,
        type: canvasType,
        title: label,
        position,
        width: spec.width,
        height: spec.height,
        metadata: {
            status: "idle",
            tobyflow: tf,
        },
    };
}

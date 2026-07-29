import { useCallback, useMemo, useState } from "react";
import { ImagePlus, Play, X } from "lucide-react";
import { Button, Input, Switch } from "antd";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { useWorkflowEditorStore } from "@/stores/canvas/use-workflow-editor-store";
import { CanvasResourceMentionTextarea } from "./canvas-resource-mention-textarea";
import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import type { CanvasNodeData } from "@/types/canvas";

const MENTIONABLE_TYPES = new Set(["image", "text", "text_extract", "generate", "chatgpt", "grok", "prompt"]);
const REF_IMAGE_TYPES = new Set(["image", "generate", "chatgpt", "grok", "prompt"]);
const PROMPT_TYPES = new Set(["prompt", "generate", "chatgpt", "grok", "text_extract", "text"]);

export type WorkflowNodePatch = {
    nodeName?: string;
    slug?: string;
    slugAuto?: boolean;
    enabled?: boolean;
    prompt?: string;
    refFileIds?: string;
    refThumbnails?: Record<string, string>;
    refFileNames?: Record<string, string>;
};

type PickerImage = {
    source?: string;
    fileId?: string;
    thumbnail?: string;
    file_name?: string;
    type?: string;
    file?: File;
};

type CanvasWorkflowNodePanelProps = {
    node: CanvasNodeData;
    readOnly?: boolean;
    canRun?: boolean;
    isRunning?: boolean;
    isSaving?: boolean;
    mentionReferences?: CanvasResourceReference[];
    onChange: (nodeId: string, patch: WorkflowNodePatch) => void;
    onRunNode?: (nodeId: string) => void;
    onClose: () => void;
};

function parseRefIds(value?: string) {
    return (value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function maxRefImages(nodeType?: string) {
    if (nodeType === "prompt") return 4;
    if (nodeType === "generate") return 8;
    return 6;
}

export function CanvasWorkflowNodePanel({ node, readOnly = false, canRun = false, isRunning = false, isSaving = false, mentionReferences = [], onChange, onRunNode, onClose }: CanvasWorkflowNodePanelProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const tileCache = useWorkflowEditorStore((state) => state.tileCache);

    const tf = node.metadata?.tobyflow;
    const raw = (tf?.raw || {}) as Record<string, unknown>;
    const nodeType = tf?.nodeType || (raw.node_type as string) || node.type;
    const nodeId = tf?.nodeId || node.id;

    const [nodeName, setNodeName] = useState(node.title || (raw.node_name as string) || "");
    const [slug, setSlug] = useState(tf?.slug || (raw.slug as string) || "");
    const [enabled, setEnabled] = useState(tf?.enabled !== false);
    const [prompt, setPrompt] = useState((raw.prompt as string) || node.metadata?.prompt || "");
    const refIds = useMemo(() => parseRefIds(tf?.refFileIds), [tf?.refFileIds]);

    const showSlug = MENTIONABLE_TYPES.has(nodeType);
    const showPrompt = PROMPT_TYPES.has(nodeType);
    const showRefImages = REF_IMAGE_TYPES.has(nodeType) && !readOnly;

    const commitPatch = useCallback(
        (patch: WorkflowNodePatch) => {
            if (readOnly) return;
            onChange(nodeId, patch);
        },
        [nodeId, onChange, readOnly],
    );

    const resolveThumb = (fileId: string) => {
        const cached = tileCache.get(fileId);
        if (cached?.thumbnail) return cached.thumbnail;
        return tf?.refThumbnails?.[fileId];
    };

    const updateRefs = (nextIds: string[], thumbs: Record<string, string>, names: Record<string, string>) => {
        commitPatch({
            refFileIds: nextIds.join(","),
            refThumbnails: thumbs,
            refFileNames: names,
        });
    };

    const openImagePicker = () => {
        const win = window as Window & {
            imagePickerModal?: {
                open: (opts: Record<string, unknown>) => void;
            };
            ImagePickerModal?: { prepareAlbumImageForRef?: (img: PickerImage) => Promise<{ key: string; file_name?: string } | null> };
            ImmediateUploader?: { upload: (file: File, thumbnail: string, opts: { key: string }) => Promise<unknown> };
            pendingUploadFiles?: Map<string, { file: File; thumbnail?: string; name?: string }>;
            customDialog?: { alert?: (msg: string, opts?: Record<string, unknown>) => void };
        };

        if (!win.imagePickerModal?.open) {
            win.customDialog?.alert?.("Image picker chưa sẵn sàng. Hãy tải lại trang.", { type: "error" });
            return;
        }

        const existingIds = refIds;
        const limit = maxRefImages(nodeType);

        win.imagePickerModal.open({
            existingFileIds: existingIds,
            mediaFilter: "image",
            maxSelections: limit,
            onConfirm: async (images: PickerImage[]) => {
                const flowImages = images.filter((img) => img.source === "flow" || img.source === "existing");
                const uploadImages = images.filter((img) => img.source === "upload" && img.file);
                const albumImages = images.filter((img) => img.source === "album");

                const newIds: string[] = [];
                const nextThumbs = { ...(tf?.refThumbnails || {}) };
                const nextNames = { ...(tf?.refFileNames || {}) };

                for (const img of flowImages) {
                    if (!img.fileId) continue;
                    newIds.push(img.fileId);
                    if (img.thumbnail) {
                        useWorkflowEditorStore.getState().tileCacheSet(img.fileId, {
                            thumbnail: img.thumbnail,
                            file_name: img.file_name || "",
                            type: img.type || "image",
                        });
                        nextThumbs[img.fileId] = img.thumbnail;
                    }
                    if (img.file_name) nextNames[img.fileId] = img.file_name;
                }

                for (const img of albumImages) {
                    try {
                        const prepared = await win.ImagePickerModal?.prepareAlbumImageForRef?.(img);
                        if (!prepared?.key) continue;
                        newIds.push(prepared.key);
                        if (img.thumbnail) {
                            useWorkflowEditorStore.getState().tileCacheSet(prepared.key, {
                                thumbnail: img.thumbnail,
                                file_name: prepared.file_name || "",
                                type: "image",
                            });
                            nextThumbs[prepared.key] = img.thumbnail;
                        }
                        if (prepared.key.startsWith("upload_")) {
                            useWorkflowEditorStore.getState().trackUploadKey(prepared.key, nodeId);
                        }
                    } catch (error) {
                        console.warn("[CanvasWorkflowNodePanel] album prepare failed:", error);
                    }
                }

                if (!win.pendingUploadFiles) win.pendingUploadFiles = new Map();
                for (const img of uploadImages) {
                    const key = img.fileId || `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    win.pendingUploadFiles.set(key, { file: img.file!, thumbnail: img.thumbnail, name: img.file?.name });
                    newIds.push(key);
                    if (img.thumbnail) {
                        useWorkflowEditorStore.getState().tileCacheSet(key, { thumbnail: img.thumbnail, type: "image" });
                        nextThumbs[key] = img.thumbnail;
                    }
                    useWorkflowEditorStore.getState().trackUploadKey(key, nodeId);
                    if (win.ImmediateUploader && img.file) {
                        void win.ImmediateUploader.upload(img.file, img.thumbnail || "", { key }).catch((error) => {
                            console.warn("[CanvasWorkflowNodePanel] upload failed:", error);
                        });
                    }
                }

                const merged = [...new Set([...existingIds, ...newIds])].slice(0, limit);
                updateRefs(merged, nextThumbs, nextNames);
            },
        });
    };

    const removeRef = (fileId: string) => {
        const nextIds = refIds.filter((id) => id !== fileId);
        const nextThumbs = { ...(tf?.refThumbnails || {}) };
        const nextNames = { ...(tf?.refFileNames || {}) };
        delete nextThumbs[fileId];
        delete nextNames[fileId];
        updateRefs(nextIds, nextThumbs, nextNames);
    };

    return (
        <div
            className="rounded-2xl border p-4 shadow-2xl backdrop-blur"
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide opacity-50">{nodeType}</div>
                    <div className="truncate text-sm font-medium">{node.title}</div>
                </div>
                <div className="flex items-center gap-1">
                    {canRun && !readOnly ? <Button type="text" size="small" className="!text-green-500" icon={<Play className="size-4" />} loading={isRunning} disabled={isSaving} onClick={() => onRunNode?.(nodeId)} title="Chạy node này" /> : null}
                    <button type="button" className="grid size-8 place-items-center rounded-lg opacity-60 transition hover:bg-white/10 hover:opacity-100" onClick={onClose} aria-label="Đóng">
                        <X className="size-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <label className="block space-y-1">
                    <span className="text-xs opacity-60">Tên node</span>
                    <Input
                        value={nodeName}
                        disabled={readOnly}
                        onChange={(event) => {
                            setNodeName(event.target.value);
                            commitPatch({ nodeName: event.target.value });
                        }}
                        className="!rounded-xl"
                    />
                </label>

                {showSlug ? (
                    <label className="block space-y-1">
                        <span className="text-xs opacity-60">Slug (@mention)</span>
                        <Input
                            value={slug}
                            disabled={readOnly}
                            onChange={(event) => {
                                setSlug(event.target.value);
                                commitPatch({ slug: event.target.value, slugAuto: false });
                            }}
                            className="!rounded-xl"
                            placeholder="my-node"
                        />
                    </label>
                ) : null}

                <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: theme.node.stroke }}>
                    <span className="text-sm">Bật node</span>
                    <Switch
                        checked={enabled}
                        disabled={readOnly}
                        onChange={(checked) => {
                            setEnabled(checked);
                            commitPatch({ enabled: checked });
                        }}
                    />
                </div>

                {showPrompt ? (
                    <label className="block space-y-1">
                        <span className="text-xs opacity-60">Prompt</span>
                        <CanvasResourceMentionTextarea
                            value={prompt}
                            references={mentionReferences}
                            disabled={readOnly}
                            onChange={(value) => {
                                setPrompt(value);
                                commitPatch({ prompt: value });
                            }}
                            className="thin-scrollbar h-28 w-full resize-none rounded-xl border px-3 py-2 text-sm leading-5 outline-none"
                            style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
                            placeholder="Nhập prompt..."
                        />
                    </label>
                ) : null}

                {showRefImages || refIds.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs opacity-60">Ảnh tham chiếu</span>
                            {!readOnly ? (
                                <Button type="text" size="small" icon={<ImagePlus className="size-4" />} onClick={openImagePicker}>
                                    Chọn ảnh
                                </Button>
                            ) : null}
                        </div>
                        {refIds.length ? (
                            <div className="flex flex-wrap gap-2">
                                {refIds.map((fileId) => {
                                    const thumb = resolveThumb(fileId);
                                    return (
                                        <div key={fileId} className="relative size-14 overflow-hidden rounded-lg border" style={{ borderColor: theme.node.stroke }}>
                                            {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-[10px] opacity-40">{fileId.slice(0, 8)}</div>}
                                            {!readOnly ? (
                                                <button type="button" className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white" onClick={() => removeRef(fileId)} aria-label="Xóa ảnh">
                                                    <X className="size-3" />
                                                </button>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed px-3 py-4 text-center text-xs opacity-50" style={{ borderColor: theme.node.stroke }}>
                                Chưa có ảnh tham chiếu
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

import { isTempUploadId } from "@/lib/canvas/tobyflow-adapter";
import type { TileCacheEntry } from "@/stores/canvas/use-workflow-editor-store";
import type { CanvasNodeData } from "@/types/canvas";

type ThumbnailBridge = {
    getThumbnailsByIds?: (ids: string[]) => Promise<{ results?: Record<string, TileCacheEntry> } | null>;
};

type ThumbnailStore = {
    getTileCache: () => Map<string, TileCacheEntry>;
    tileCacheSet: (key: string, value: TileCacheEntry) => void;
};

export class TobyFlowThumbnailService {
    private lastRescanAt = 0;

    constructor(private store: ThumbnailStore, private bridge: ThumbnailBridge = (window as Window & { MessageBridge?: ThumbnailBridge }).MessageBridge || {}) {}

    populateFromNodes(nodes: CanvasNodeData[]) {
        for (const node of nodes) {
            const tf = node.metadata?.tobyflow;
            if (!tf) continue;

            const activeRefIds = tf.refFileIds
                ? new Set(
                      tf.refFileIds
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                  )
                : null;

            if (tf.refThumbnails) {
                for (const [fileId, thumbVal] of Object.entries(tf.refThumbnails)) {
                    if (activeRefIds && !activeRefIds.has(fileId)) continue;
                    if (!thumbVal) continue;
                    this.store.tileCacheSet(fileId, {
                        thumbnail: thumbVal,
                        type: "image",
                    });
                }
            }

            if (tf.refFileNames) {
                for (const [fileId, fileName] of Object.entries(tf.refFileNames)) {
                    if (activeRefIds && !activeRefIds.has(fileId)) continue;
                    const existing = this.store.getTileCache().get(fileId) || {};
                    this.store.tileCacheSet(fileId, { ...existing, file_name: fileName });
                }
            }

            if (tf.resultThumbnails) {
                for (const [fileId, thumbVal] of Object.entries(tf.resultThumbnails)) {
                    if (!thumbVal) continue;
                    this.store.tileCacheSet(fileId, {
                        thumbnail: thumbVal,
                        type: "image",
                    });
                }
            }
        }
    }

    resolveRefThumbnail(fileId: string, node: CanvasNodeData): string | undefined {
        const cached = this.store.getTileCache().get(fileId);
        if (cached?.thumbnail) return cached.thumbnail;
        if (cached?.video_url) return cached.video_url;
        return node.metadata?.tobyflow?.refThumbnails?.[fileId];
    }

    async autoRescanBrokenThumbs(nodes: CanvasNodeData[], isReadOnly: boolean, { force = false } = {}) {
        if (isReadOnly) return;
        const now = Date.now();
        if (!force && now - this.lastRescanAt < 3000) return;
        this.lastRescanAt = now;

        const brokenIds = new Set<string>();
        const cache = this.store.getTileCache();

        for (const node of nodes) {
            const refStr = node.metadata?.tobyflow?.refFileIds || "";
            if (!refStr) continue;
            const ids = refStr
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            for (const id of ids) {
                if (isTempUploadId(id)) continue;
                const cached = cache.get(id);
                if (cached?._permanently_broken) continue;
                const hasRenderable = cached?.thumbnail || cached?.video_url;
                const hasDomTile = typeof document !== "undefined" && document.querySelector(`[data-tile-id="${CSS.escape(id)}"]`);
                if (!hasRenderable && !hasDomTile) brokenIds.add(id);
            }
        }

        if (brokenIds.size === 0 || !this.bridge.getThumbnailsByIds) return;

        try {
            const result = await this.bridge.getThumbnailsByIds([...brokenIds]).catch(() => null);
            const results = result?.results || {};
            let updatedCount = 0;

            for (const [fid, info] of Object.entries(results)) {
                if (!info || (!info.thumbnail && !info.video_url)) continue;
                const existing = cache.get(fid) || {};
                this.store.tileCacheSet(fid, {
                    ...existing,
                    thumbnail: info.thumbnail || existing.thumbnail || "",
                    type: info.type || existing.type || "image",
                    ...(info.file_name ? { file_name: info.file_name } : {}),
                    ...(info.video_url ? { video_url: info.video_url } : {}),
                });
                updatedCount++;
            }

            if (updatedCount > 0) {
                console.log(`[TobyFlowThumbnail] Auto-rescan recovered ${updatedCount}/${brokenIds.size} thumbnails`);
            }
        } catch (error) {
            console.warn("[TobyFlowThumbnail] Auto-rescan failed:", error);
        }
    }
}

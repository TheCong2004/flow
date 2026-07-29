import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "antd";

import { canvasThemes } from "@/lib/canvas-theme";
import { getWorkflowPaletteItems, type WorkflowPaletteNodeType } from "@/lib/canvas/tobyflow-node-factory";
import { useThemeStore } from "@/stores/use-theme-store";

type CanvasWorkflowPaletteProps = {
    readOnly?: boolean;
    onAddNode: (nodeType: WorkflowPaletteNodeType) => void;
};

export function CanvasWorkflowPalette({ readOnly = false, onAddNode }: CanvasWorkflowPaletteProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const items = useMemo(() => getWorkflowPaletteItems(), []);

    if (readOnly) return null;

    return (
        <div
            className="pointer-events-auto absolute bottom-20 left-4 z-40 flex max-h-[min(420px,55vh)] w-44 flex-col overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md"
            style={{ borderColor: theme.toolbar.border, background: theme.toolbar.panel }}
        >
            <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-70" style={{ borderColor: theme.toolbar.border }}>
                <Plus className="size-3.5" />
                Thêm node
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
                {items.map((item) => (
                    <Button key={item.type} type="text" block disabled={item.disabled} className="!h-8 !justify-start !rounded-xl !px-2 !text-left !text-xs" onClick={() => onAddNode(item.type)}>
                        {item.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}

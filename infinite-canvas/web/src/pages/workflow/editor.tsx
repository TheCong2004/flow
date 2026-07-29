import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import type { CanvasBackgroundMode } from "@/lib/canvas-theme";

export const WORKFLOW_SESSION_ID = "tobyflow-workflow-session";

export default function WorkflowEditorEntry() {
    const navigate = useNavigate();
    const hydrated = useCanvasStore((state) => state.hydrated);

    useEffect(() => {
        if (!hydrated) return;

        const store = useCanvasStore.getState();
        if (!store.openProject(WORKFLOW_SESSION_ID)) {
            const now = new Date().toISOString();
            const project = {
                id: WORKFLOW_SESSION_ID,
                title: "Workflow",
                createdAt: now,
                updatedAt: now,
                nodes: [],
                connections: [],
                chatSessions: [],
                activeChatId: null,
                backgroundMode: "lines" as CanvasBackgroundMode,
                showImageInfo: false,
                viewport: { x: 0, y: 0, k: 1 },
            };
            store.replaceProjects([project, ...store.projects.filter((item) => item.id !== WORKFLOW_SESSION_ID)]);
        }

        navigate(`/workflow-editor/canvas/${WORKFLOW_SESSION_ID}?source=workflow`, { replace: true });
    }, [hydrated, navigate]);

    return null;
}

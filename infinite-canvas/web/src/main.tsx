import React from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";
import "./styles/globals.css";
import { RouterProvider, createHashRouter } from "react-router-dom";

import { AppProviders } from "@/components/layout/app-providers";
import { browserRouter, routeConfig } from "@/router";

console.log("[InfiniteCanvas] bundle start", { href: window.location.href });

try {
    const stored = JSON.parse(localStorage.getItem("infinite-canvas:theme_store") || "{}") as {
        state?: { theme?: string };
    };
    const theme = stored.state?.theme === "light" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
} catch {
    /* ignore */
}

document.body.style.fontFamily = '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';

const isExtensionContext = Boolean((window as Window & { __TOBYFLOW_EXTENSION__?: boolean }).__TOBYFLOW_EXTENSION__);
const router = isExtensionContext ? createHashRouter(routeConfig) : browserRouter;

class RootErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
    state: { error: Error | null } = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[InfiniteCanvas] React render failed:", error, info);
        window.dispatchEvent(
            new CustomEvent("tobyflow:canvas-error", {
                detail: { message: "Workflow canvas render failed. Open Console for details." },
            }),
        );
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#181715", color: "#f5f5f4", padding: 24 }}>
                <div style={{ maxWidth: 560, border: "1px solid #44403c", borderRadius: 12, padding: 20, background: "#1f1d1a" }}>
                    <h1 style={{ margin: "0 0 8px", fontSize: 18 }}>Workflow editor failed to render</h1>
                    <p style={{ margin: 0, color: "#d6d3d1", lineHeight: 1.5 }}>{this.state.error.message || "Unknown error"}</p>
                </div>
            </main>
        );
    }
}

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RootErrorBoundary>
            <AppProviders>
                <RouterProvider router={router} />
            </AppProviders>
        </RootErrorBoundary>
    </React.StrictMode>,
);

console.log("[InfiniteCanvas] root render scheduled");

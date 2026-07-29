/**
 * Resolve public/ assets for standalone Vite (base ./) and Chromex extension popup.
 */
function isExtensionPage(): boolean {
    if (!!(globalThis as { __TOBYFLOW_EXTENSION__?: boolean }).__TOBYFLOW_EXTENSION__) {
        return true;
    }
    return globalThis.location?.protocol === "chrome-extension:";
}

export function publicAssetUrl(path: string): string {
    const normalized = path.replace(/^\//, "");
    if (isExtensionPage() && typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(`assets/tobyflow/dist/infinite-canvas/${normalized}`);
    }
    const base = import.meta.env.BASE_URL || "/";
    return `${base}${normalized}`;
}

/** CSS background URLs under assets/tobyflow/ (icons/, not infinite-canvas/). */
export function tobyflowAssetUrl(path: string): string {
    const normalized = path.replace(/^\//, "");
    if (isExtensionPage() && typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(`assets/tobyflow/${normalized}`);
    }
    return `/${normalized}`;
}

import allRenderers, { getDefaultFullAssetBaseUrl, mergeFullAssetOptions, setDefaultFullAssetBaseUrl } from '@file-viewer/preset-all';
import FlyfishFileViewerWeb, { createViewerControllerHandle, FileViewerElement, FILE_VIEWER_ELEMENT_TAG, mountViewer as mountBaseViewer } from '@file-viewer/web';
export * from '@file-viewer/web';
export { createViewerControllerHandle, FileViewerElement, FILE_VIEWER_ELEMENT_TAG };
export { getDefaultFullAssetBaseUrl, resetDefaultFullAssetBaseUrl, setDefaultFullAssetBaseUrl } from '@file-viewer/preset-all';
export const fileViewerFullPreset = allRenderers;
function detectCurrentScriptBaseUrl() {
    if (typeof document === 'undefined') {
        return undefined;
    }
    const currentScript = document.currentScript;
    const scripts = Array.from(document.scripts);
    const script = (currentScript === null || currentScript === void 0 ? void 0 : currentScript.src)
        ? currentScript
        : scripts.reverse().find(item => /(?:@file-viewer\/web-full|flyfish-file-viewer-web-full)/.test(item.src));
    if (!(script === null || script === void 0 ? void 0 : script.src)) {
        return undefined;
    }
    try {
        return new URL('./', script.src).href;
    }
    catch {
        return undefined;
    }
}
const currentScriptBaseUrl = detectCurrentScriptBaseUrl();
if (currentScriptBaseUrl) {
    setDefaultFullAssetBaseUrl(currentScriptBaseUrl);
}
export function withFullViewerOptions(options = {}, assetBaseUrl = getDefaultFullAssetBaseUrl()) {
    var _a;
    const { preset = allRenderers, rendererMode = 'replace', ...rest } = options;
    return {
        ...mergeFullAssetOptions(rest, assetBaseUrl),
        preset,
        rendererMode,
        autoRenderers: (_a = rest.autoRenderers) !== null && _a !== void 0 ? _a : true
    };
}
export function withFullMountOptions(options = {}, assetBaseUrl = getDefaultFullAssetBaseUrl()) {
    return {
        ...options,
        options: withFullViewerOptions(options.options, assetBaseUrl)
    };
}
export function mountViewer(container, initialOptions = {}, coreOptions = {}) {
    return mountBaseViewer(container, withFullMountOptions(initialOptions), coreOptions);
}
export class FileViewerFullElement extends FileViewerElement {
    get options() {
        return super.options;
    }
    set options(value) {
        super.options = withFullViewerOptions(value);
    }
    connectedCallback() {
        this.options = super.options;
        super.connectedCallback();
    }
    async load(options) {
        await super.load(withFullMountOptions(options));
    }
    async update(options = {}) {
        await super.update(withFullMountOptions(options));
    }
    get source() {
        return super.source;
    }
    set source(value) {
        if (!value) {
            super.source = value;
            return;
        }
        const { coreOptions, ...mountOptions } = value;
        super.source = {
            ...withFullMountOptions(mountOptions),
            coreOptions
        };
    }
}
export function defineFileViewerElement(tagName = FILE_VIEWER_ELEMENT_TAG) {
    if (typeof window === 'undefined' || !window.customElements) {
        return undefined;
    }
    const existing = window.customElements.get(tagName);
    if (existing) {
        return existing;
    }
    window.customElements.define(tagName, FileViewerFullElement);
    return FileViewerFullElement;
}
const FlyfishFileViewerWebFull = {
    ...FlyfishFileViewerWeb,
    fileViewerFullPreset,
    getDefaultFullAssetBaseUrl,
    setDefaultFullAssetBaseUrl,
    withFullViewerOptions,
    withFullMountOptions,
    defineFileViewerElement,
    FileViewerElement: FileViewerFullElement,
    mountViewer
};
export default FlyfishFileViewerWebFull;

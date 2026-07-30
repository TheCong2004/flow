import type { ReactNode } from 'react'

import { Brush, Camera, Copy, FileText, Grid2x2, Lock, LockOpen, Maximize2, Scissors, Sparkles, Upload, ZoomIn } from 'lucide-react'

import type { CanvasNodeData } from '@/types/canvas'

export type ImageNodeActionToolId =
    | 'copyPrompt'
    | 'reversePrompt'
    | 'replace'
    | 'resize'
    | 'maskEdit'
    | 'crop'
    | 'split'
    | 'upscale'
    | 'superResolve'
    | 'angle'
    | 'view'
export type ImageQuickToolId = 'info' | 'delete' | 'saveAsset' | 'download' | 'edit' | ImageNodeActionToolId

export type ImageToolHandlers = {
    onUpload: (node: CanvasNodeData) => void
    onToggleFreeResize: (node: CanvasNodeData) => void
    onMaskEdit: (node: CanvasNodeData) => void
    onCrop: (node: CanvasNodeData) => void
    onSplit: (node: CanvasNodeData) => void
    onUpscale: (node: CanvasNodeData) => void
    onSuperResolve: (node: CanvasNodeData) => void
    onAngle: (node: CanvasNodeData) => void
    onViewImage: (node: CanvasNodeData) => void
    onCopyPrompt: (node: CanvasNodeData) => void
    onReversePrompt: (node: CanvasNodeData) => void
}

export type ImageToolDefinition = {
    id: ImageNodeActionToolId
    defaultVisible: boolean
    panelLabel: string
    label: string | ((node: CanvasNodeData) => string)
    title: string | ((node: CanvasNodeData) => string)
    icon: (node: CanvasNodeData) => ReactNode
    active?: (node: CanvasNodeData) => boolean
    run: (node: CanvasNodeData, handlers: ImageToolHandlers) => void
}

export type ImageQuickToolsConfig = {
    ids: ImageQuickToolId[]
    showLabels: boolean
}

export const IMAGE_QUICK_TOOLS_STORAGE_KEY = 'canvas-image-quick-tools-v6'

const defaultBaseToolIds: ImageQuickToolId[] = ['info', 'delete', 'saveAsset', 'download', 'edit']

export const imageToolDefinitions: ImageToolDefinition[] = [
    {
        id: 'copyPrompt',
        defaultVisible: true,
        panelLabel: 'Sao chép prompt',
        label: 'Sao chép prompt',
        title: 'Sao chép prompt đã tạo ảnh này',
        icon: () => <Copy className='size-4' />,
        run: (node, handlers) => handlers.onCopyPrompt(node)
    },
    {
        id: 'reversePrompt',
        defaultVisible: true,
        panelLabel: 'Suy ngược prompt',
        label: 'Suy ngược prompt',
        title: 'Tạo node văn bản + cấu hình để suy ngược prompt',
        icon: () => <FileText className='size-4' />,
        run: (node, handlers) => handlers.onReversePrompt(node)
    },
    {
        id: 'replace',
        defaultVisible: true,
        panelLabel: 'Thay ảnh',
        label: 'Thay ảnh',
        title: 'Thay ảnh',
        icon: () => <Upload className='size-4' />,
        run: (node, handlers) => handlers.onUpload(node)
    },
    {
        id: 'resize',
        defaultVisible: false,
        panelLabel: 'Khóa tỉ lệ',
        label: (node) => (node.metadata?.freeResize ? 'Tỉ lệ tự do' : 'Khóa tỉ lệ'),
        title: (node) => (node.metadata?.freeResize ? 'Chuyển sang giữ tỉ lệ' : 'Chuyển sang tỉ lệ tự do'),
        icon: (node) => (node.metadata?.freeResize ? <LockOpen className='size-4' /> : <Lock className='size-4' />),
        active: (node) => Boolean(node.metadata?.freeResize),
        run: (node, handlers) => handlers.onToggleFreeResize(node)
    },
    {
        id: 'maskEdit',
        defaultVisible: true,
        panelLabel: 'Sửa cục bộ',
        label: 'Sửa cục bộ',
        title: 'Thêm mask rồi chỉnh sửa vùng chọn',
        icon: () => <Brush className='size-4' />,
        run: (node, handlers) => handlers.onMaskEdit(node)
    },
    {
        id: 'crop',
        defaultVisible: true,
        panelLabel: 'Cắt ảnh',
        label: 'Cắt ảnh',
        title: 'Cắt ảnh và tạo node mới',
        icon: () => <Scissors className='size-4' />,
        run: (node, handlers) => handlers.onCrop(node)
    },
    {
        id: 'split',
        defaultVisible: true,
        panelLabel: 'Chia lưới',
        label: 'Chia lưới',
        title: 'Chia ảnh theo hàng/cột',
        icon: () => <Grid2x2 className='size-4' />,
        run: (node, handlers) => handlers.onSplit(node)
    },
    {
        id: 'upscale',
        defaultVisible: true,
        panelLabel: 'Phóng to',
        label: 'Phóng to',
        title: 'Phóng to độ phân giải ảnh',
        icon: () => <ZoomIn className='size-4' />,
        run: (node, handlers) => handlers.onUpscale(node)
    },
    {
        id: 'superResolve',
        defaultVisible: false,
        panelLabel: 'Siêu phân giải',
        label: 'Siêu phân giải',
        title: 'AI Siêu phân giải',
        icon: () => <Sparkles className='size-4' />,
        run: (node, handlers) => handlers.onSuperResolve(node)
    },
    {
        id: 'angle',
        defaultVisible: false,
        panelLabel: 'Đa góc',
        label: 'Đa góc',
        title: 'Tạo góc nhìn',
        icon: () => <Camera className='size-4' />,
        run: (node, handlers) => handlers.onAngle(node)
    },
    {
        id: 'view',
        defaultVisible: true,
        panelLabel: 'Xem ảnh lớn',
        label: 'Xem ảnh lớn',
        title: 'Xem chi tiết ảnh',
        icon: () => <Maximize2 className='size-4' />,
        run: (node, handlers) => handlers.onViewImage(node)
    }
]

export const defaultImageQuickToolIds: ImageQuickToolId[] = [
    ...defaultBaseToolIds,
    ...imageToolDefinitions.filter((tool) => tool.defaultVisible).map((tool) => tool.id)
]

export function buildImageToolbarTools(node: CanvasNodeData, handlers: ImageToolHandlers) {
    return imageToolDefinitions.map((tool) => ({
        id: tool.id,
        label: resolveToolText(tool.label, node),
        title: resolveToolText(tool.title, node),
        icon: tool.icon(node),
        active: tool.active?.(node),
        onClick: () => tool.run(node, handlers)
    }))
}

export function normalizeImageQuickToolIds(value: unknown[]) {
    const allIds: ImageQuickToolId[] = [...defaultBaseToolIds, ...imageToolDefinitions.map((tool) => tool.id)]
    const ids = new Set(allIds)
    return allIds.filter((id) => value.includes(id) && ids.has(id))
}

export function readImageQuickToolsConfig(value: unknown): ImageQuickToolsConfig {
    if (Array.isArray(value)) return { ids: normalizeImageQuickToolIds(value), showLabels: true }
    if (!value || typeof value !== 'object') return { ids: defaultImageQuickToolIds, showLabels: true }
    const data = value as Partial<ImageQuickToolsConfig>
    return {
        ids: Array.isArray(data.ids) ? normalizeImageQuickToolIds(data.ids) : defaultImageQuickToolIds,
        showLabels: data.showLabels !== false
    }
}

function resolveToolText(value: string | ((node: CanvasNodeData) => string), node: CanvasNodeData) {
    return typeof value === 'function' ? value(node) : value
}

import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconEraser,
    IconHandStop,
    IconMusic,
    IconPhoto,
    IconTrash,
    IconTypography,
    IconUpload,
    IconVideo
} from '@tabler/icons-react'

type Props = {
    canUndo: boolean
    canRedo: boolean
    hasSelection: boolean
    onUndo: () => void
    onRedo: () => void
    onAddText: () => void
    onPickMedia: (accept: string) => void
    onDelete: () => void
    onClear: () => void
    onDeselect: () => void
}

export function AgentflowDock({
    canUndo,
    canRedo,
    hasSelection,
    onUndo,
    onRedo,
    onAddText,
    onPickMedia,
    onDelete,
    onClear,
    onDeselect
}: Props) {
    return (
        <div className='agentflow-workflow-dock' aria-label='Công cụ canvas'>
            <DockButton label='Di chuyển / bỏ chọn' onClick={onDeselect}>
                <IconHandStop />
            </DockButton>
            <DockButton label='Hoàn tác' disabled={!canUndo} onClick={onUndo}>
                <IconArrowBackUp />
            </DockButton>
            <DockButton label='Làm lại' disabled={!canRedo} onClick={onRedo}>
                <IconArrowForwardUp />
            </DockButton>
            <span className='agentflow-dock-divider' />
            <DockButton label='Thêm văn bản' onClick={onAddText}>
                <IconTypography />
            </DockButton>
            <DockButton label='Thêm ảnh' onClick={() => onPickMedia('image/*')}>
                <IconPhoto />
            </DockButton>
            <DockButton label='Thêm video' onClick={() => onPickMedia('video/*')}>
                <IconVideo />
            </DockButton>
            <DockButton label='Thêm âm thanh' onClick={() => onPickMedia('audio/*')}>
                <IconMusic />
            </DockButton>
            <DockButton label='Tải tài nguyên' onClick={() => onPickMedia('image/*,video/*,audio/*')}>
                <IconUpload />
            </DockButton>
            <span className='agentflow-dock-divider' />
            <DockButton label='Xóa mục đã chọn' danger disabled={!hasSelection} onClick={onDelete}>
                <IconTrash />
            </DockButton>
            <DockButton label='Xóa sạch canvas' danger onClick={onClear}>
                <IconEraser />
            </DockButton>
        </div>
    )
}

function DockButton({
    label,
    disabled,
    danger,
    onClick,
    children
}: {
    label: string
    disabled?: boolean
    danger?: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type='button'
            className={`agentflow-dock-button${danger ? ' danger' : ''}`}
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    )
}

import PropTypes from 'prop-types'
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

const Tool = ({ label, disabled, danger, onClick, children }) => (
    <button
        type='button'
        className={`workflow-editor-tool${danger ? ' danger' : ''}`}
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
    >
        {children}
    </button>
)

Tool.propTypes = {
    label: PropTypes.string,
    disabled: PropTypes.bool,
    danger: PropTypes.bool,
    onClick: PropTypes.func,
    children: PropTypes.node
}

const CanvasWorkflowToolbar = ({
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
}) => (
    <div className='workflow-editor-dock'>
        <Tool label='Di chuyển / bỏ chọn' onClick={onDeselect}>
            <IconHandStop />
        </Tool>
        <Tool label='Hoàn tác' disabled={!canUndo} onClick={onUndo}>
            <IconArrowBackUp />
        </Tool>
        <Tool label='Làm lại' disabled={!canRedo} onClick={onRedo}>
            <IconArrowForwardUp />
        </Tool>
        <span className='workflow-editor-dock__divider' />
        <Tool label='Văn bản' onClick={onAddText}>
            <IconTypography />
        </Tool>
        <Tool label='Ảnh' onClick={() => onPickMedia('image/*')}>
            <IconPhoto />
        </Tool>
        <Tool label='Video' onClick={() => onPickMedia('video/*')}>
            <IconVideo />
        </Tool>
        <Tool label='Âm thanh' onClick={() => onPickMedia('audio/*')}>
            <IconMusic />
        </Tool>
        <Tool label='Tải tài nguyên' onClick={() => onPickMedia('image/*,video/*,audio/*')}>
            <IconUpload />
        </Tool>
        <span className='workflow-editor-dock__divider' />
        <Tool label='Xóa mục đã chọn' danger disabled={!hasSelection} onClick={onDelete}>
            <IconTrash />
        </Tool>
        <Tool label='Xóa sạch canvas' danger onClick={onClear}>
            <IconEraser />
        </Tool>
    </div>
)

CanvasWorkflowToolbar.propTypes = {
    canUndo: PropTypes.bool,
    canRedo: PropTypes.bool,
    hasSelection: PropTypes.bool,
    onUndo: PropTypes.func,
    onRedo: PropTypes.func,
    onAddText: PropTypes.func,
    onPickMedia: PropTypes.func,
    onDelete: PropTypes.func,
    onClear: PropTypes.func,
    onDeselect: PropTypes.func
}

export default CanvasWorkflowToolbar

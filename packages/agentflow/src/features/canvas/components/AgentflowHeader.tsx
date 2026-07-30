import {
    IconAdjustments,
    IconChevronLeft,
    IconDeviceFloppy,
    IconDownload,
    IconMenu2,
    IconPlayerPlay,
    IconShare3,
    IconX
} from '@tabler/icons-react'

import type { HeaderRenderProps, ValidationResult } from '@/core/types'

export interface AgentflowHeaderProps extends HeaderRenderProps {
    readOnly?: boolean
}

export function AgentflowHeader({ flowName, isDirty, readOnly, onSave, onExport, onValidate }: AgentflowHeaderProps) {
    const share = async () => {
        await navigator.clipboard?.writeText(window.location.href)
    }

    return (
        <div className='agentflow-header'>
            <div className='agentflow-header-brand'>
                <button className='agentflow-header-icon' onClick={() => window.history.back()} title='Quay lại'>
                    <IconChevronLeft />
                </button>
                <button className='agentflow-header-icon agentflow-header-menu' title='Menu'>
                    <IconMenu2 />
                </button>
                <span className='agentflow-title'>
                    {flowName}
                    {isDirty && ' *'}
                </span>
            </div>
            <div className='agentflow-header-actions'>
                <button className='agentflow-header-action' onClick={onExport}>
                    <IconDownload /> Xuất JSON
                </button>
                <button className='agentflow-header-action' onClick={share}>
                    <IconShare3 /> Chia sẻ
                </button>
                <button className='agentflow-header-action agentflow-run-button' onClick={onValidate}>
                    <IconPlayerPlay /> Kiểm tra
                </button>
                <button className='agentflow-save-button' onClick={onSave} disabled={readOnly}>
                    <IconDeviceFloppy /> Lưu
                </button>
                <button className='agentflow-header-action' onClick={() => window.history.back()}>
                    Đóng <IconX />
                </button>
                <button className='agentflow-header-icon' title='Cài đặt'>
                    <IconAdjustments />
                </button>
            </div>
        </div>
    )
}

export function createHeaderProps(
    flowName: string,
    isDirty: boolean,
    onSave: () => void,
    toJSON: () => string,
    validate: () => ValidationResult
): HeaderRenderProps {
    return {
        flowName,
        isDirty,
        onSave,
        onExport: () => {
            const json = toJSON()
            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'flow.json'
            a.click()
            URL.revokeObjectURL(url)
        },
        onValidate: validate
    }
}

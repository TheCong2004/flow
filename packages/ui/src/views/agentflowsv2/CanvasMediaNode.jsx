import { useState } from 'react'
/* eslint-disable jsx-a11y/media-has-caption */
import PropTypes from 'prop-types'
import { Handle, Position, NodeResizer } from 'reactflow'
import { IconPhoto, IconVideo, IconMusic, IconSend, IconSettings } from '@tabler/icons-react'

const MODEL_OPTIONS = {
    image: [
        { value: 'gpt-image-1', label: 'GPT Image 1' },
        { value: 'grok-imagine-image', label: 'Grok Imagine' },
        { value: 'imagen-3', label: 'Google Imagen 3' },
        { value: 'flux-pro', label: 'FLUX Pro' }
    ],
    video: [
        { value: 'grok-imagine-video', label: 'Grok Imagine Video' },
        { value: 'veo-3', label: 'Google Veo 3' },
        { value: 'kling-2', label: 'Kling 2' },
        { value: 'runway-gen-4', label: 'Runway Gen-4' }
    ],
    audio: [
        { value: 'gpt-4o-mini-tts', label: 'OpenAI TTS' },
        { value: 'elevenlabs', label: 'ElevenLabs' },
        { value: 'suno', label: 'Suno' },
        { value: 'audio-generator', label: 'Audio Generator' }
    ]
}

const CanvasMediaNode = ({ data, selected }) => {
    const [settingsOpen, setSettingsOpen] = useState(false)
    const MediaIcon = data.mediaType === 'video' ? IconVideo : data.mediaType === 'audio' ? IconMusic : IconPhoto
    const accentColor = data.accentColor || (data.mediaType === 'video' ? '#f97316' : data.mediaType === 'audio' ? '#ec4899' : '#8b5cf6')
    const placeholder =
        data.mediaType === 'video'
            ? 'Mô tả video muốn tạo...'
            : data.mediaType === 'audio'
            ? 'Mô tả âm thanh muốn tạo...'
            : 'Mô tả ảnh muốn tạo...'

    return (
        <div className={'workflow-media-node-wrap' + (selected ? ' selected' : '')} style={{ '--media-accent': accentColor }}>
            <NodeResizer
                isVisible={selected}
                minWidth={240}
                minHeight={240}
                maxWidth={960}
                maxHeight={760}
                lineStyle={{ borderColor: accentColor, borderWidth: 1.5 }}
                handleStyle={{ width: 8, height: 8, borderRadius: 2, background: accentColor, border: '1px solid #fff' }}
            />
            <div className={`workflow-media-node${selected ? ' selected' : ''}`}>
                <Handle
                    id='workflowMedia_input'
                    className='workflow-media-handle workflow-media-handle--input'
                    type='target'
                    position={Position.Left}
                />
                {data.url ? (
                    <>
                        {data.mediaType === 'image' && <img src={data.url} alt={data.label || 'Canvas image'} />}
                        {data.mediaType === 'video' && <video src={data.url} controls />}
                        {data.mediaType === 'audio' && <audio src={data.url} controls />}
                    </>
                ) : data.prompt?.trim() ? (
                    <div className='workflow-media-node__prompt-preview'>
                        <span className='workflow-media-node__prompt-type'>{data.label} AI</span>
                        <p>{data.prompt}</p>
                    </div>
                ) : (
                    <div className='workflow-media-node__empty'>
                        <MediaIcon />
                        <span>Nhập mô tả {data.label?.toLowerCase()} muốn tạo</span>
                        <small>Chọn AI rồi nhấn nút tạo</small>
                    </div>
                )}
                <Handle
                    id='workflowMedia_output'
                    className='workflow-media-handle workflow-media-handle--output'
                    type='source'
                    position={Position.Right}
                />
            </div>
            {selected && (
                <div className='workflow-media-prompt nodrag nowheel'>
                    <textarea
                        value={data.prompt || ''}
                        placeholder={placeholder}
                        onChange={(event) => data.onChange?.({ prompt: event.target.value })}
                    />
                    <div className='workflow-media-prompt__footer'>
                        <button type='button' title='Cấu hình' onClick={() => setSettingsOpen((open) => !open)}>
                            <IconSettings />
                        </button>
                        <select
                            className='workflow-media-model-select nodrag nowheel'
                            value={data.model || MODEL_OPTIONS[data.mediaType][0].value}
                            onChange={(event) => data.onChange?.({ model: event.target.value })}
                            title='Chọn AI tạo nội dung'
                        >
                            {MODEL_OPTIONS[data.mediaType].map((model) => (
                                <option key={model.value} value={model.value}>
                                    {model.label}
                                </option>
                            ))}
                        </select>
                        {data.mediaType === 'video' && (
                            <button type='button' className='workflow-video-settings-summary' onClick={() => setSettingsOpen(true)}>
                                {data.resolution || '720p'} · {data.aspectRatio || 'landscape'} · {data.duration || 6}s
                            </button>
                        )}
                        <button type='button' className='workflow-media-prompt__send' title='Tạo'>
                            <IconSend />
                        </button>
                    </div>
                    {settingsOpen && data.mediaType === 'video' && (
                        <div className='workflow-video-settings nodrag nowheel'>
                            <div className='workflow-video-settings__header'>
                                <strong>Cài đặt video</strong>
                                <button type='button' onClick={() => setSettingsOpen(false)}>
                                    ×
                                </button>
                            </div>
                            <label>Độ nét</label>
                            <div className='workflow-video-settings__options workflow-video-settings__options--three'>
                                {['480p', '720p', '1080p'].map((resolution) => (
                                    <button
                                        type='button'
                                        key={resolution}
                                        className={(data.resolution || '720p') === resolution ? 'active' : ''}
                                        onClick={() => data.onChange?.({ resolution })}
                                    >
                                        {resolution}
                                    </button>
                                ))}
                            </div>
                            <label>Kích thước</label>
                            <div className='workflow-video-settings__options workflow-video-settings__options--three'>
                                {[
                                    ['landscape', 'Ngang', '1280×720'],
                                    ['portrait', 'Dọc', '720×1280'],
                                    ['square', 'Vuông', '1024×1024'],
                                    ['wide', 'Rộng', '1792×1024'],
                                    ['tall', 'Dọc dài', '1024×1792'],
                                    ['auto', 'Tự động', 'Auto']
                                ].map(([aspectRatio, name, size]) => (
                                    <button
                                        type='button'
                                        key={aspectRatio}
                                        className={(data.aspectRatio || 'landscape') === aspectRatio ? 'active' : ''}
                                        onClick={() => data.onChange?.({ aspectRatio, size })}
                                    >
                                        <strong>{name}</strong>
                                        <small>{size}</small>
                                    </button>
                                ))}
                            </div>
                            <label>Thời lượng</label>
                            <div className='workflow-video-settings__options workflow-video-settings__options--three'>
                                {[6, 10, 12, 16, 20].map((duration) => (
                                    <button
                                        type='button'
                                        key={duration}
                                        className={(data.duration || 6) === duration ? 'active' : ''}
                                        onClick={() => data.onChange?.({ duration })}
                                    >
                                        {duration}s
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

CanvasMediaNode.propTypes = {
    data: PropTypes.object,
    selected: PropTypes.bool
}

export default CanvasMediaNode

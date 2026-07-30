import { SseEvent } from './types'

function decodeData(value: string): unknown {
    if (!value) return ''
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

function parseBlock(block: string): SseEvent | undefined {
    let event = 'message'
    let id: string | undefined
    let retry: number | undefined
    const data: string[] = []

    for (const line of block.split('\n')) {
        if (!line || line.startsWith(':')) continue
        const separator = line.indexOf(':')
        const field = separator === -1 ? line : line.slice(0, separator)
        let value = separator === -1 ? '' : line.slice(separator + 1)
        if (value.startsWith(' ')) value = value.slice(1)

        if (field === 'event') event = value
        else if (field === 'data') data.push(value)
        else if (field === 'id') id = value
        else if (field === 'retry' && /^\d+$/.test(value)) retry = Number(value)
    }

    if (!data.length) return undefined
    return { event, data: decodeData(data.join('\n')), id, retry }
}

export async function* parseSseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (true) {
            const { done, value } = await reader.read()
            buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n').replace(/\r/g, '\n')

            let boundary = buffer.indexOf('\n\n')
            while (boundary >= 0) {
                const parsed = parseBlock(buffer.slice(0, boundary))
                buffer = buffer.slice(boundary + 2)
                if (parsed) yield parsed
                boundary = buffer.indexOf('\n\n')
            }

            if (done) {
                const parsed = parseBlock(buffer)
                if (parsed) yield parsed
                break
            }
        }
    } finally {
        reader.releaseLock()
    }
}

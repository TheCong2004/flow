import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSseStream } from '../dist/sse.js'

function streamFromChunks(chunks) {
    const encoder = new TextEncoder()
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
            controller.close()
        }
    })
}

test('parses SSE fields split across chunks', async () => {
    const stream = streamFromChunks([
        'event: token\r\ndata: {"te',
        'xt":"hello"}\r\nid: 7\r\n\r\n',
        ': heartbeat\n\nevent: complete\ndata: {"ok":true}\n\n'
    ])

    const events = []
    for await (const event of parseSseStream(stream)) events.push(event)

    assert.deepEqual(events, [
        { event: 'token', data: { text: 'hello' }, id: '7', retry: undefined },
        { event: 'complete', data: { ok: true }, id: undefined, retry: undefined }
    ])
})

test('keeps non-JSON and multiline data', async () => {
    const stream = streamFromChunks(['data: first\ndata: second\n\n'])
    const events = []
    for await (const event of parseSseStream(stream)) events.push(event)
    assert.equal(events[0].data, 'first\nsecond')
})

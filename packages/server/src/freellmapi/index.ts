import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export const freeLLMRouter = Router()

const DATA_FILE = path.join(process.cwd(), 'freellm-keys.json')

function getStoredKeys(): any[] {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8')
            return JSON.parse(data)
        }
    } catch (e) {
        console.error('Error reading freellm-keys.json:', e)
    }
    return []
}

function saveKeys(keys: any[]) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2), 'utf-8')
    } catch (e) {
        console.error('Error saving freellm-keys.json:', e)
    }
}

// ── GET STATUS ─────────────────────────────────────────────────────────────
freeLLMRouter.get('/status', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        integrated: true,
        mode: 'single-process',
        timestamp: new Date().toISOString()
    })
})

// ── GET KEYS ───────────────────────────────────────────────────────────────
freeLLMRouter.get('/keys', (req: Request, res: Response) => {
    const keys = getStoredKeys()
    res.json({ data: keys })
})

// ── ADD KEY ────────────────────────────────────────────────────────────────
freeLLMRouter.post('/keys', (req: Request, res: Response) => {
    const { provider, key, name } = req.body
    if (!key || !provider) {
        return res.status(400).json({ error: 'Provider and key are required' })
    }

    const keys = getStoredKeys()
    const newKey = {
        id: 'flk_' + Date.now() + Math.random().toString(36).substring(2, 6),
        provider,
        key,
        name: name || `${provider.toUpperCase()} Key`,
        createdAt: new Date().toISOString()
    }
    keys.push(newKey)
    saveKeys(keys)

    res.json({ success: true, data: newKey })
})

// ── DELETE KEY ─────────────────────────────────────────────────────────────
freeLLMRouter.delete('/keys/:id', (req: Request, res: Response) => {
    const { id } = req.params
    let keys = getStoredKeys()
    keys = keys.filter((k: any) => k.id !== id)
    saveKeys(keys)
    res.json({ success: true })
})

// ── GET MODELS CATALOG ─────────────────────────────────────────────────────
freeLLMRouter.get('/models', (req: Request, res: Response) => {
    const defaultModels = [
        { id: 'FreeLLM: gpt-4o', name: 'GPT-4o (Omni)', provider: 'OpenAI' },
        { id: 'FreeLLM: gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
        { id: 'FreeLLM: o3-mini', name: 'o3-mini Reasoning', provider: 'OpenAI' },
        { id: 'FreeLLM: claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        { id: 'FreeLLM: claude-3-5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
        { id: 'FreeLLM: gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
        { id: 'FreeLLM: gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
        { id: 'FreeLLM: gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental', provider: 'Google' },
        { id: 'FreeLLM: deepseek-chat', name: 'DeepSeek V3 Chat', provider: 'DeepSeek' },
        { id: 'FreeLLM: deepseek-reasoner', name: 'DeepSeek R1 Reasoning', provider: 'DeepSeek' },
        { id: 'FreeLLM: llama-3.3-70b', name: 'Llama 3.3 70B Versatile', provider: 'Groq' },
        { id: 'FreeLLM: mixtral-8x7b', name: 'Mixtral 8x7B Instruct', provider: 'Groq' },
        { id: 'FreeLLM: qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', provider: 'OpenRouter' }
    ]
    res.json({ data: defaultModels })
})

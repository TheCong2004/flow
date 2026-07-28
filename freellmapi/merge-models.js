const fs = require('fs')

const FLOWISE_MODELS = 'D:/Flowise/packages/components/models.json'
const OUT = 'D:/Flowise/freellmapi-models.json'
const UNIFIED_KEY = 'freellmapi-a7daef8636feb16c7f4779a36125fa86b3c906f4baca2165'

async function main() {
    // 1. Load Flowise's full model catalog (all providers preserved).
    const models = JSON.parse(fs.readFileSync(FLOWISE_MODELS, 'utf8'))

    // 2. Fetch the live FreeLLMAPI model list.
    const res = await fetch('http://localhost:3001/v1/models', {
        headers: { Authorization: `Bearer ${UNIFIED_KEY}` }
    })
    const { data } = await res.json()

    // 3. Build dropdown entries. "auto" first so it's the obvious default.
    const freellmEntries = data.map((m) => ({
        label: `FreeLLM: ${m.name}`,
        name: m.id,
        input_cost: 0,
        output_cost: 0
    }))

    // 4. Prepend FreeLLMAPI models to the chatOpenAI node's model list,
    //    keeping the original OpenAI models below them.
    const openai = models.chat.find((c) => c.name === 'chatOpenAI')
    const existingNames = new Set(openai.models.map((m) => m.name))
    const toAdd = freellmEntries.filter((m) => !existingNames.has(m.name))
    openai.models = [...toAdd, ...openai.models]

    fs.writeFileSync(OUT, JSON.stringify(models, null, 2))
    console.log(`Added ${toAdd.length} FreeLLMAPI models to chatOpenAI.`)
    console.log(`chatOpenAI now lists ${openai.models.length} models total.`)
    console.log(`Written: ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

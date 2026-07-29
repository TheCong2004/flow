import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box } from '@mui/material'

const COMMERCE_MARKETPLACE_URL = import.meta.env.VITE_COMMERCE_MARKETPLACE_URL || 'http://localhost:3001/collection/workflow'

const CommerceMarketplaceRedirect = () => {
    const navigate = useNavigate()
    const marketplaceUrl = useMemo(() => {
        const target = new URL(COMMERCE_MARKETPLACE_URL)
        target.searchParams.set('flowise_url', window.location.origin)
        target.searchParams.set('embedded', '1')
        return target.toString()
    }, [])

    useEffect(() => {
        const commerceOrigin = new URL(COMMERCE_MARKETPLACE_URL).origin
        const receivePurchase = (event) => {
            if (event.origin !== commerceOrigin || event.data?.type !== 'commerce:import-workflow') return
            const template = event.data.template
            if (!template?.flowData) return
            const parsedFlow = typeof template.flowData === 'string' ? JSON.parse(template.flowData) : template.flowData
            const templateFlowData = JSON.stringify(parsedFlow)
            const isAgentV2 = template.type === 'AgentflowV2'
            const isAgentCanvas = (parsedFlow?.nodes || []).some(
                (node) => node?.data?.category === 'Multi Agents' || node?.data?.category === 'Sequential Agents'
            )
            const destination = isAgentV2 ? '/v2/agentcanvas' : isAgentCanvas ? '/agentcanvas' : '/canvas'
            navigate(destination, {
                state: { templateFlowData, marketplaceTemplateName: template.templateName }
            })
        }
        window.addEventListener('message', receivePurchase)
        return () => window.removeEventListener('message', receivePurchase)
    }, [navigate])

    return (
        <Box
            component='iframe'
            src={marketplaceUrl}
            title='Flowise Marketplace'
            allow='clipboard-read; clipboard-write'
            sx={{ display: 'block', width: '100%', height: 'calc(100vh - 82px)', minHeight: 640, border: 0, bgcolor: 'background.default' }}
        />
    )
}

export default CommerceMarketplaceRedirect

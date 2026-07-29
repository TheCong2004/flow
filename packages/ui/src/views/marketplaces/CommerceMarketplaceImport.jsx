import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'

const MERCHANT_API_URL = (import.meta.env.VITE_MERCHANT_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')

const CommerceMarketplaceImport = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [error, setError] = useState('')

    useEffect(() => {
        const token = searchParams.get('token')
        if (!token) {
            setError('Thiếu token của đơn hàng đã thanh toán.')
            return
        }

        const importTemplate = async () => {
            const response = await fetch(`${MERCHANT_API_URL}/v1/marketplaces/imports/${encodeURIComponent(token)}`)
            if (!response.ok) throw new Error(`Không tải được workflow (${response.status})`)
            const template = await response.json()
            if (!template?.flowData) throw new Error('Workflow không có dữ liệu JSON.')
            if (template.type === 'Tool') throw new Error('Hiện tại chỉ nhập Chatflow và Agentflow.')

            const parsedFlow = typeof template.flowData === 'string' ? JSON.parse(template.flowData) : template.flowData
            const templateFlowData = JSON.stringify(parsedFlow)
            const isAgentV2 = template.type === 'AgentflowV2'
            const isAgentCanvas = (parsedFlow?.nodes || []).some(
                (node) => node?.data?.category === 'Multi Agents' || node?.data?.category === 'Sequential Agents'
            )
            const destination = isAgentV2 ? '/v2/agentcanvas' : isAgentCanvas ? '/agentcanvas' : '/canvas'
            navigate(destination, {
                replace: true,
                state: { templateFlowData, marketplaceTemplateName: template.templateName }
            })
        }

        importTemplate().catch((reason) => setError(reason instanceof Error ? reason.message : 'Không thể nhập workflow.'))
    }, [navigate, searchParams])

    return (
        <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', px: 3 }}>
            {error ? (
                <Alert severity='error'>{error}</Alert>
            ) : (
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress color='secondary' />
                    <Typography sx={{ mt: 2 }}>Đang tạo bản sao workflow trong Flowise...</Typography>
                </Box>
            )}
        </Box>
    )
}

export default CommerceMarketplaceImport

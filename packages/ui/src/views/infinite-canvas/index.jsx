import { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { IconLayoutDashboard } from '@tabler/icons-react'

// ==============================|| INFINITE CANVAS VIEW ||============================== //

const InfiniteCanvas = () => {
    const iframeRef = useRef(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        const iframe = iframeRef.current
        if (!iframe) return

        const handleLoad = () => setLoading(false)
        const handleError = () => {
            setLoading(false)
            setError(true)
        }

        iframe.addEventListener('load', handleLoad)
        iframe.addEventListener('error', handleError)

        // Timeout fallback — nếu iframe load quá lâu
        const timer = setTimeout(() => {
            if (loading) setLoading(false)
        }, 8000)

        return () => {
            iframe.removeEventListener('load', handleLoad)
            iframe.removeEventListener('error', handleError)
            clearTimeout(timer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 80px)',
                overflow: 'hidden',
                position: 'relative'
            }}
        >
            {/* Loading overlay */}
            {loading && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        zIndex: 10,
                        bgcolor: 'background.default'
                    }}
                >
                    <IconLayoutDashboard size={48} stroke={1} style={{ opacity: 0.3 }} />
                    <CircularProgress size={28} />
                    <Typography variant='body2' color='text.secondary'>
                        Đang tải Infinite Canvas...
                    </Typography>
                </Box>
            )}

            {/* Error state */}
            {error && !loading && (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        gap: 2
                    }}
                >
                    <IconLayoutDashboard size={48} stroke={1} style={{ opacity: 0.3 }} />
                    <Typography variant='h6' color='text.secondary'>
                        Không thể tải Infinite Canvas
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Hãy chạy <code>pnpm --filter flowise-infinite-canvas build</code> rồi khởi động lại server.
                    </Typography>
                </Box>
            )}

            {/* Infinite Canvas iframe */}
            <iframe
                ref={iframeRef}
                src='/infinite-canvas-app'
                title='Infinite Canvas'
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: error ? 'none' : 'block'
                }}
                allow='clipboard-read; clipboard-write'
            />
        </Box>
    )
}

export default InfiniteCanvas

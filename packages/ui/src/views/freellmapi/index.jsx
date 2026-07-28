import React, { useState, useEffect } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography
} from '@mui/material'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import MainCard from '@/ui-component/cards/MainCard'
import {
    IconKey,
    IconPlus,
    IconTrash,
    IconSearch,
    IconCpu,
    IconSparkles,
    IconShieldCheck
} from '@tabler/icons-react'
import freellmApi from '@/api/freellmapi'

const PROVIDER_OPTIONS = [
    { id: 'openai', name: 'OpenAI (GPT-4o, o3-mini...)' },
    { id: 'gemini', name: 'Google Gemini (Gemini 1.5 Pro, Flash...)' },
    { id: 'anthropic', name: 'Anthropic Claude (Claude 3.5 Sonnet...)' },
    { id: 'groq', name: 'Groq (Llama 3.3, Mixtral...)' },
    { id: 'deepseek', name: 'DeepSeek (V3, R1...)' },
    { id: 'openrouter', name: 'OpenRouter (Multi-provider)' },
    { id: 'together', name: 'Together AI' },
    { id: 'mistral', name: 'Mistral AI' }
]

function TabPanel(props) {
    const { children, value, index, ...other } = props
    return (
        <div role='tabpanel' hidden={value !== index} id={`freellm-tabpanel-${index}`} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    )
}

const FreeLLMAPIDashboard = () => {
    const [tabIndex, setTabIndex] = useState(0)
    const [keys, setKeys] = useState([])
    const [models, setModels] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [provider, setProvider] = useState('gemini')
    const [apiKey, setApiKey] = useState('')
    const [keyName, setKeyName] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const resKeys = await freellmApi.getFreeLLMKeys().catch(() => null)
            const keysData = resKeys?.data?.data || resKeys?.data || []
            setKeys(Array.isArray(keysData) ? keysData : [])

            const resModels = await freellmApi.getFreeLLMModels().catch(() => null)
            const modelsData = resModels?.data?.data || resModels?.data || []
            setModels(Array.isArray(modelsData) ? modelsData : [])
        } catch (e) {
            console.error('Error loading FreeLLM API data:', e)
            setKeys([])
            setModels([])
        }
    }

    const handleAddKey = async () => {
        if (!apiKey) return
        try {
            await freellmApi.addFreeLLMKey({
                provider,
                key: apiKey,
                name: keyName || `${provider.toUpperCase()} Key`
            })
            setDialogOpen(false)
            setApiKey('')
            setKeyName('')
            loadData()
        } catch (e) {
            console.error(e)
        }
    }

    const handleDeleteKey = async (id) => {
        try {
            await freellmApi.deleteFreeLLMKey(id)
            loadData()
        } catch (e) {
            console.error(e)
        }
    }

    const safeKeys = Array.isArray(keys) ? keys : []
    const safeModels = Array.isArray(models) ? models : []

    const defaultFallbackModels = [
        { id: 'FreeLLM: gpt-4o', name: 'GPT-4o (Omni)', provider: 'OpenAI' },
        { id: 'FreeLLM: claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
        { id: 'FreeLLM: gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
        { id: 'FreeLLM: deepseek-r1', name: 'DeepSeek R1 Reasoning', provider: 'DeepSeek' },
        { id: 'FreeLLM: llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Groq / Meta' }
    ]

    const modelListToUse = safeModels.length > 0 ? safeModels : defaultFallbackModels

    const filteredModels = modelListToUse.filter((m) =>
        (m.name || m.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.id || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <MainCard sx={{ minHeight: 'calc(100vh - 110px)', p: 0 }}>
            <ViewHeader
                title='FreeLLM API'
                description='Quản lý Provider Keys, Router mô hình AI miễn phí tích hợp trực tiếp'
            >
                <Button
                    variant='contained'
                    color='primary'
                    startIcon={<IconPlus size={18} />}
                    onClick={() => setDialogOpen(true)}
                >
                    Thêm API Key mới
                </Button>
            </ViewHeader>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
                <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)}>
                    <Tab icon={<IconKey size={18} />} iconPosition='start' label='API Keys của nhà cung cấp' />
                    <Tab icon={<IconCpu size={18} />} iconPosition='start' label={`Danh mục Model (${modelListToUse.length})`} />
                    <Tab icon={<IconShieldCheck size={18} />} iconPosition='start' label='Tổng quan & Tích hợp' />
                </Tabs>
            </Box>

            {/* TAB 1: API KEYS MANAGEMENT */}
            <TabPanel value={tabIndex} index={0}>
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant='h4'>Danh sách API Keys đã thêm</Typography>
                    <Typography variant='body2' color='textSecondary'>
                        FreeLLMAPI sẽ tự động điều phối & cân bằng tải qua các Key này
                    </Typography>
                </Box>

                {safeKeys.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default', borderRadius: 2 }}>
                        <IconSparkles size={48} style={{ color: '#2196f3', marginBottom: 12 }} />
                        <Typography variant='h5' gutterBottom>
                            Đã kích hoạt chế độ Free Model tự động!
                        </Typography>
                        <Typography variant='body2' color='textSecondary' sx={{ maxW: 500, mx: 'auto', mb: 2 }}>
                            Hệ thống đã có sẵn 75+ Model AI miễn phí. Bạn có thể dán thêm API Key riêng (Gemini, OpenAI, Groq, DeepSeek,...) để tăng hạn ngạch (quota) và ưu tiên cao hơn.
                        </Typography>
                        <Button variant='outlined' startIcon={<IconPlus size={18} />} onClick={() => setDialogOpen(true)}>
                            Thêm API Key cá nhân
                        </Button>
                    </Paper>
                ) : (
                    <TableContainer component={Paper} variant='outlined'>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Tên Key</TableCell>
                                    <TableCell>Nhà cung cấp</TableCell>
                                    <TableCell>API Key (Đã mã hóa)</TableCell>
                                    <TableCell>Trạng thái</TableCell>
                                    <TableCell align='right'>Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {safeKeys.map((k) => (
                                    <TableRow key={k.id || Math.random()}>
                                        <TableCell sx={{ fontWeight: 600 }}>{k.name}</TableCell>
                                        <TableCell>
                                            <Chip label={(k.provider || 'AI').toUpperCase()} size='small' color='primary' variant='outlined' />
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace' }}>
                                            {k.key ? `${k.key.substring(0, 6)}••••••••${k.key.substring(k.key.length - 4)}` : '••••••••••••'}
                                        </TableCell>
                                        <TableCell>
                                            <Chip label='Active' size='small' color='success' />
                                        </TableCell>
                                        <TableCell align='right'>
                                            <IconButton color='error' onClick={() => handleDeleteKey(k.id)}>
                                                <IconTrash size={18} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </TabPanel>

            {/* TAB 2: MODEL CATALOG */}
            <TabPanel value={tabIndex} index={1}>
                <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        placeholder='Tìm kiếm model (GPT-4o, Claude, Gemini, DeepSeek...)...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size='small'
                        fullWidth
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position='start'>
                                    <IconSearch size={18} />
                                </InputAdornment>
                            )
                        }}
                    />
                </Box>

                <Grid container spacing={2}>
                    {filteredModels.map((m, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={m.id || idx}>
                            <Card variant='outlined' sx={{ borderRadius: 2 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Typography variant='h6' noWrap sx={{ fontWeight: 600 }}>
                                            {m.name || m.id}
                                        </Typography>
                                        <Chip label='Miễn phí' size='small' color='success' variant='outlined' />
                                    </Box>
                                    <Typography variant='caption' color='textSecondary' display='block' sx={{ fontFamily: 'monospace', mb: 1 }}>
                                        ID: {m.id}
                                    </Typography>
                                    <Chip label={m.provider || 'FreeLLM Router'} size='small' variant='outlined' />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </TabPanel>

            {/* TAB 3: OVERVIEW & INTEGRATION */}
            <TabPanel value={tabIndex} index={2}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, borderRadius: 2 }} variant='outlined'>
                            <Typography variant='h5' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <IconShieldCheck color='#4caf50' /> Tình trạng Tích hợp Nội bộ
                            </Typography>
                            <Typography variant='body2' paragraph color='textSecondary'>
                                FreeLLM API đã được gộp trực tiếp vào tiến trình duy nhất của Flowise. Bạn không cần khởi chạy thêm bất kỳ ứng dụng hay cổng (port) nào khác.
                            </Typography>
                            <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: 13, mb: 2 }}>
                                <div><strong>Router Endpoint:</strong> /v1/chat/completions</div>
                                <div><strong>Built-in Credential:</strong> FreeLLMAPI (Built-in)</div>
                                <div><strong>Trạng thái:</strong> Đang hoạt động (Single Process)</div>
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, borderRadius: 2 }} variant='outlined'>
                            <Typography variant='h5' gutterBottom>
                                Hướng dẫn sử dụng nhanh
                            </Typography>
                            <Typography variant='body2' component='div' sx={{ lineHeight: 1.8 }}>
                                1. Mở bất kỳ <strong>Chatflow</strong> hoặc <strong>Agentflow</strong> nào.<br />
                                2. Kéo node <strong>ChatOpenAI</strong> vào màn hình.<br />
                                3. Chọn Credential là <strong>FreeLLMAPI (Built-in)</strong>.<br />
                                4. Chọn Model có chữ <code>FreeLLM: ...</code> và bắt đầu chạy!
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </TabPanel>

            {/* ADD KEY DIALOG */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
                <DialogTitle>Thêm API Key Nhà Cung Cấp</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <FormControl fullWidth sx={{ mb: 2.5, mt: 1 }}>
                        <InputLabel>Nhà cung cấp AI (Provider)</InputLabel>
                        <Select value={provider} label='Nhà cung cấp AI (Provider)' onChange={(e) => setProvider(e.target.value)}>
                            {PROVIDER_OPTIONS.map((opt) => (
                                <MenuItem key={opt.id} value={opt.id}>
                                    {opt.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label='Tên nhãn (Tùy chọn)'
                        fullWidth
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        placeholder='Ví dụ: Key Gemini Cá nhân 1'
                        sx={{ mb: 2.5 }}
                    />

                    <TextField
                        label='API Key'
                        fullWidth
                        required
                        type='password'
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder='Dán API Key của nhà cung cấp vào đây...'
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
                    <Button variant='contained' onClick={handleAddKey} disabled={!apiKey}>
                        Lưu Key
                    </Button>
                </DialogActions>
            </Dialog>
        </MainCard>
    )
}

export default FreeLLMAPIDashboard

import client from './client'

const getFreeLLMStatus = () => client.get('/freellmapi/status')

const getFreeLLMKeys = () => client.get('/freellmapi/keys')

const addFreeLLMKey = (body) => client.post('/freellmapi/keys', body)

const deleteFreeLLMKey = (id) => client.delete(`/freellmapi/keys/${id}`)

const getFreeLLMModels = () => client.get('/freellmapi/models')

export default {
    getFreeLLMStatus,
    getFreeLLMKeys,
    addFreeLLMKey,
    deleteFreeLLMKey,
    getFreeLLMModels
}

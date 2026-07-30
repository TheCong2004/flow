jest.mock('../../utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn()
}))

import { Request, Response } from 'express'
import { requireClientPermission } from './workspace'

function responseMock() {
    const response = {
        status: jest.fn(),
        json: jest.fn()
    }
    response.status.mockReturnValue(response)
    response.json.mockReturnValue(response)
    return response as unknown as Response
}

describe('requireClientPermission', () => {
    it('allows a principal with the required permission', () => {
        const request = {
            clientPrincipal: { permissions: ['chatflows:view'] }
        } as unknown as Request
        const response = responseMock()
        const next = jest.fn()

        requireClientPermission('chatflows:view')(request, response, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(response.status).not.toHaveBeenCalled()
    })

    it('returns 403 when the permission is missing', () => {
        const request = {
            clientPrincipal: { permissions: [] }
        } as unknown as Request
        const response = responseMock()
        const next = jest.fn()

        requireClientPermission('chatflows:view')(request, response, next)

        expect(response.status).toHaveBeenCalledWith(403)
        expect(next).not.toHaveBeenCalled()
    })
})

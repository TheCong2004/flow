import { JwtFromRequestFunction, Strategy as JwtStrategy, VerifiedCallback } from 'passport-jwt'
import { decryptToken } from '../../utils/tempTokenUtils'
import { Strategy } from 'passport'
import { Request } from 'express'
import { ICommonObject } from 'flowise-components'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'
import { Platform } from '../../../Interface'

const _cookieExtractor = (req: any) => {
    let jwt = null

    if (req && req.cookies) {
        jwt = req.cookies['token']
    }

    return jwt
}

export const getAuthStrategy = (options: any): Strategy => {
    let jwtFromRequest: JwtFromRequestFunction
    jwtFromRequest = _cookieExtractor
    const jwtOptions = {
        jwtFromRequest: jwtFromRequest,
        passReqToCallback: true,
        ...options
    }
    const jwtVerify = async (req: Request, payload: ICommonObject, done: VerifiedCallback) => {
        try {
            const meta = decryptToken(payload.meta)
            if (!meta) {
                return done(null, false, 'Unauthorized.')
            }
            const ids = meta.split(':')
            if (ids.length !== 2) {
                return done(null, false, 'Unauthorized.')
            }

            // For Open Source mode, req.user may not be set by session.
            // Reconstruct user from JWT payload directly.
            if (!req.user) {
                const identityManager = getRunningExpressApp().identityManager
                const isOpenSource = !identityManager || identityManager.getPlatformType() === Platform.OPEN_SOURCE
                if (isOpenSource) {
                    // Trust the JWT token - reconstruct a minimal user
                    const user = {
                        id: ids[0],
                        activeWorkspaceId: ids[1],
                        activeOrganizationId: 'default',
                        isOrganizationAdmin: true,
                        permissions: [],
                        features: {}
                    }
                    req.user = user as any
                    return done(null, user)
                }
                return done(null, false, 'Unauthorized.')
            }

            if (req.user.id !== ids[0]) {
                return done(null, false, 'Unauthorized.')
            }
            done(null, req.user)
        } catch (error) {
            done(error, false)
        }
    }
    return new JwtStrategy(jwtOptions, jwtVerify)
}


import * as Server from '../index'
import * as DataSource from '../DataSource'
import logger from '../utils/logger'
import { BaseCommand } from './base'

export default class Start extends BaseCommand {
    async run(): Promise<void> {
        logger.info('Starting Flowise...')
        await DataSource.init()
        await Server.start()
    }

    async catch(error: Error) {
        if (error.stack) logger.error(error.stack)
        logger.error('❌ [server]: Error during start command:', error.message)
    }

    async stopProcess() {
        try {
            logger.info(`Shutting down Flowise...`)
            const serverApp = Server.getInstance()
            if (serverApp) await serverApp.stopApp()
        } catch (error) {
            logger.error('There was an error shutting down Flowise...', error)
            await this.failExit()
        }

        await this.gracefullyExit()
    }
}

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class DeleteStructureName extends BaseCommand {
  static commandName = 'delete:structure-name'
  static description = ''

  static options: CommandOptions = {}

  async run() {
    this.logger.info('Hello world from "DeleteStructureName"')
  }
}
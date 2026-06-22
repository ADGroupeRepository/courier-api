import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class DeleteStructureName extends BaseCommand {
  static readonly commandName = 'delete:structure-name'
  static readonly description = ''

  static readonly options: CommandOptions = {}

  async run() {
    this.logger.info('Hello world from "DeleteStructureName"')
  }
}

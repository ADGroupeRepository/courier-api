import type { HttpContext } from '@adonisjs/core/http'
import OrganisationService from '#modules/organisations/organisation_service'
import {
  createOrganisationValidator,
  updateOrganisationValidator,
} from '#modules/organisations/organisation_validator'

export default class OrganisationsController {
  /**
   * GET /api/v1/organisations
   * List all organisations the authenticated user belongs to.
   */
  async index({ request, response }: HttpContext) {
    const authHeader = request.header('Authorization')!
    const token = authHeader.slice(7).trim()

    const service = new OrganisationService()
    const organisations = await service.list(token)

    return response.ok({ data: organisations })
  }

  /**
   * POST /api/v1/organisations
   * Create a new organisation. Automatically provisions a database + storage bucket.
   */
  async store({ request, response, user }: HttpContext) {
    const payload = await request.validateUsing(createOrganisationValidator)
    const service = new OrganisationService()
    const organisation = await service.create(payload, user!.$id)

    return response.created({ message: 'Organisation created successfully', data: organisation })
  }

  /**
   * GET /api/v1/organisations/:id
   * Get a single organisation with full metadata.
   */
  async show({ request, response }: HttpContext) {
    const teamId = request.param('id')
    const service = new OrganisationService()
    const organisation = await service.get(teamId)

    return response.ok({ data: organisation })
  }

  /**
   * PATCH /api/v1/organisations/:id
   * Update an organisation's name and/or metadata.
   */
  async update({ request, response }: HttpContext) {
    const teamId = request.param('id')
    const { logo, ...payload } = await request.validateUsing(updateOrganisationValidator)

    const service = new OrganisationService()
    const organisation = await service.update(
      teamId,
      payload,
      logo && logo.tmpPath && logo.clientName
        ? { tmpPath: logo.tmpPath, fileName: logo.clientName }
        : undefined
    )

    return response.ok({ message: 'Organisation updated successfully', data: organisation })
  }

  /**
   * DELETE /api/v1/organisations/:id
   * Delete an organisation and all its provisioned resources (database + bucket).
   */
  async destroy({ request, response }: HttpContext) {
    const teamId = request.param('id')
    const service = new OrganisationService()
    await service.delete(teamId)

    return response.noContent()
  }
}

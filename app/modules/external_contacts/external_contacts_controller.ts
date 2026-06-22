import type { HttpContext } from '@adonisjs/core/http'
import { ExternalContactService } from '#modules/external_contacts/external_contact_service'
import {
  createExternalContactValidator,
  updateExternalContactValidator,
} from '#modules/external_contacts/external_contact_validator'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'

export default class ExternalContactsController {
  private readonly missingCollectionMessage =
    'External contacts are not provisioned for this organisation. Run `node ace provision:external-contacts` to create the missing collection for courier-enabled organisations.'

  private isMissingExternalContactsCollection(error: any) {
    return (
      error?.code === 404 &&
      typeof error?.message === 'string' &&
      error.message.toLowerCase().includes('collection')
    )
  }

  private missingCollectionResponse(response: HttpContext['response']) {
    return response.status(503).send({
      message: this.missingCollectionMessage,
    })
  }

  /**
   * Helper to get user roles in an organisation.
   */
  private async getUserContext(user: any, orgId: string) {
    const memberships = await appwrite.teams.listMemberships({
      teamId: orgId,
      queries: [Query.equal('userId', user?.$id || '')],
    })

    if (memberships.total === 0) {
      throw new Error('User is not a member of this organisation')
    }

    const membership = memberships.memberships[0]
    const roles = membership?.roles || []
    const canManage = roles.some((r) => ['owner', 'admin'].includes(r))

    return { roles, canManage }
  }

  /**
   * GET /api/v1/organisations/:orgId/contacts
   */
  async index({ request, params, response }: HttpContext) {
    const limit = request.input('limit') ? Number.parseInt(request.input('limit'), 10) : 25
    const page = request.input('page') ? Number.parseInt(request.input('page'), 10) : 1
    const structureType = request.input('type')

    try {
      const service = await ExternalContactService.forOrg(params.orgId)
      const { documents, total } = await service.list({ limit, page, structureType })
      return response.ok({
        total,
        limit,
        page,
        lastPage: Math.ceil(total / limit),
        data: documents,
      })
    } catch (error: any) {
      if (this.isMissingExternalContactsCollection(error)) {
        return this.missingCollectionResponse(response)
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * GET /api/v1/organisations/:orgId/contacts/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      const service = await ExternalContactService.forOrg(params.orgId)
      const contact = await service.get(params.id)
      return response.ok({ data: contact })
    } catch (error: any) {
      if (this.isMissingExternalContactsCollection(error)) {
        return this.missingCollectionResponse(response)
      }
      if (error.code === 404) {
        return response.notFound({ message: 'Contact not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * POST /api/v1/organisations/:orgId/contacts
   */
  async store({ user, params, request, response }: HttpContext) {
    const payload = await request.validateUsing(createExternalContactValidator)

    try {
      const service = await ExternalContactService.forOrg(params.orgId)
      const contact = await service.create({
        ...payload,
        createdBy: user?.$id || '',
      })
      return response.created({ data: contact })
    } catch (error: any) {
      if (this.isMissingExternalContactsCollection(error)) {
        return this.missingCollectionResponse(response)
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * PATCH /api/v1/organisations/:orgId/contacts/:id
   */
  async update({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(updateExternalContactValidator)

    try {
      const service = await ExternalContactService.forOrg(params.orgId)
      const contact = await service.update(params.id, payload)
      return response.ok({ data: contact })
    } catch (error: any) {
      if (this.isMissingExternalContactsCollection(error)) {
        return this.missingCollectionResponse(response)
      }
      if (error.code === 404) {
        return response.notFound({ message: 'Contact not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  /**
   * DELETE /api/v1/organisations/:orgId/contacts/:id
   */
  async destroy({ user, params, response }: HttpContext) {
    try {
      const { canManage } = await this.getUserContext(user, params.orgId)
      if (!canManage) {
        return response.forbidden({ message: 'Only admins can delete contacts' })
      }

      const service = await ExternalContactService.forOrg(params.orgId)
      await service.delete(params.id)
      return response.ok({ message: 'Contact deleted successfully' })
    } catch (error: any) {
      if (this.isMissingExternalContactsCollection(error)) {
        return this.missingCollectionResponse(response)
      }
      if (error.code === 404) {
        return response.notFound({ message: 'Contact not found' })
      }
      return response.internalServerError({ message: error.message })
    }
  }
}

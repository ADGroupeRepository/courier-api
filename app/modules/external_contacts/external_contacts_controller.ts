import type { HttpContext } from '@adonisjs/core/http'
import { ExternalContactService } from '#modules/external_contacts/external_contact_service'
import {
  createExternalContactValidator,
  updateExternalContactValidator,
} from '#modules/external_contacts/external_contact_validator'
import appwrite from '#services/appwrite_service'
import { Query } from 'node-appwrite'

export default class ExternalContactsController {
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
  async index({ params, response }: HttpContext) {
    try {
      const service = await ExternalContactService.forOrg(params.orgId)
      const contacts = await service.list()
      return response.ok({ data: contacts })
    } catch (error: any) {
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
      if (error.code === 404) return response.notFound({ message: 'Contact not found' })
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
      if (error.code === 404) return response.notFound({ message: 'Contact not found' })
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
      if (error.code === 404) return response.notFound({ message: 'Contact not found' })
      return response.internalServerError({ message: error.message })
    }
  }
}

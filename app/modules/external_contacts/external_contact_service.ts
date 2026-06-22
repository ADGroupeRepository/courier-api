import appwrite from '#services/appwrite_service'
import { ID, Query } from 'node-appwrite'
import { Collections } from '#modules/_registry/collection_ids'
import { type CourierStructureType } from '#modules/courier/courier_enums'

export interface ExternalContact {
  $id: string
  $createdAt: string
  name: string
  email?: string
  phone?: string
  structureType: CourierStructureType
  idNumber?: string
  address?: string
  createdBy: string
}

export type CreateExternalContactPayload = Omit<ExternalContact, '$id' | '$createdAt'>
export type UpdateExternalContactPayload = Partial<CreateExternalContactPayload>

export class ExternalContactService {
  private readonly orgId: string

  constructor(orgId: string) {
    this.orgId = orgId
  }

  /**
   * Initialize the service for a specific organisation.
   * @param orgId - The ID of the organisation.
   * @returns A new instance of ExternalContactService.
   */
  static async forOrg(orgId: string) {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    if (!prefs.databaseId) {
      throw new Error(`Organisation ${orgId} does not have a provisioned database.`)
    }
    return new ExternalContactService(prefs.databaseId)
  }

  /**
   * List external contacts for the organisation with pagination.
   * @param options - Pagination options.
   * @param queries - Optional Appwrite queries for filtering/sorting.
   * @returns A paginated list of external contacts.
   */
  async list(options: { limit?: number; page?: number } = {}, queries: string[] = []) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
    const page = Math.max(options.page ?? 1, 1)
    const offset = (page - 1) * limit

    const response = await appwrite.databases.listDocuments({
      databaseId: this.orgId,
      collectionId: Collections.EXTERNAL_CONTACTS,
      queries: [
        Query.limit(limit),
        Query.offset(offset),
        Query.orderDesc('$createdAt'),
        ...queries,
      ],
    })

    return {
      total: response.total,
      documents: response.documents.map((doc) => this.mapToContact(doc)),
    }
  }

  /**
   * Get a single external contact by ID.
   * @param id - The ID of the contact.
   * @returns The contact details.
   */
  async get(id: string) {
    const doc = await appwrite.databases.getDocument({
      databaseId: this.orgId,
      collectionId: Collections.EXTERNAL_CONTACTS,
      documentId: id,
    })
    return this.mapToContact(doc)
  }

  /**
   * Create a new external contact.
   * @param payload - The contact details.
   * @returns The created contact details.
   */
  async create(payload: CreateExternalContactPayload) {
    const doc = await appwrite.databases.createDocument({
      databaseId: this.orgId,
      collectionId: Collections.EXTERNAL_CONTACTS,
      documentId: ID.unique(),
      data: payload,
    })

    return this.mapToContact(doc)
  }

  /**
   * Update an existing external contact.
   * @param id - The ID of the contact to update.
   * @param payload - The fields to update.
   * @returns The updated contact details.
   */
  async update(id: string, payload: UpdateExternalContactPayload) {
    const doc = await appwrite.databases.updateDocument({
      databaseId: this.orgId,
      collectionId: Collections.EXTERNAL_CONTACTS,
      documentId: id,
      data: payload,
    })

    return this.mapToContact(doc)
  }

  /**
   * Permanently delete an external contact.
   * @param id - The ID of the contact to delete.
   */
  async delete(id: string) {
    await appwrite.databases.deleteDocument({
      databaseId: this.orgId,
      collectionId: Collections.EXTERNAL_CONTACTS,
      documentId: id,
    })
  }

  private mapToContact(doc: any): ExternalContact {
    return {
      $id: doc.$id,
      $createdAt: doc.$createdAt,
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      structureType: doc.structureType,
      idNumber: doc.idNumber,
      address: doc.address,
      createdBy: doc.createdBy,
    }
  }
}

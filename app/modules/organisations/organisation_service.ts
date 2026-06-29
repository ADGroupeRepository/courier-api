import appwriteConfig from '#config/appwrite'
import { buildMemberAddedEmailHtml } from '#modules/auth/auth_service'
import OrganisationCreated from '#events/organisation_created'
import PlanService from '#modules/plans/plan_service'
import MembersService from '#modules/directory/members_service'
import { Collections } from '#modules/_registry/collection_ids'
import appwrite from '#services/appwrite_service'
import EmailService from '#services/email_service'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import { Compression, ID, Permission, Query, Role } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'

interface CreateOrganisationPayload {
  name: string
  description?: string
  address?: string
  rccm?: string
}

interface UpdateOrganisationPayload {
  name?: string
  description?: string
  address?: string
  rccm?: string
}

/**
 * Manages the full lifecycle of an organisation (Appwrite Team) including
 * automatic provisioning and cleanup of its isolated database and storage bucket.
 */
export default class OrganisationService {
  /**
   * Create a new organisation with:
   * 1. An Appwrite Team (the org identity)
   * 2. An isolated Database (for all module collections)
   * 3. An isolated Storage Bucket (for file uploads)
   * 4. Team preferences storing the resource IDs + org metadata
   *
   * The creator is automatically added as owner/admin.
   * @param payload - The organisation details (name, description, address).
   * @param creatorId - The ID of the user creating the organisation.
   * @returns The created organisation details.
   */
  async create(payload: CreateOrganisationPayload, creatorId: string) {
    console.error(`[OrgService] Starting creation for: ${payload.name} (Creator: ${creatorId})`)
    const { name, description, address, rccm } = payload
    const teamId = ID.unique()

    // Step 1: Create the team
    console.log(`[OrgService] Creating team with ID: ${teamId}`)
    const team = await appwrite.teams.create({
      teamId,
      name,
    })
    console.log(`[OrgService] Team created: ${team.$id}`)

    // Step 1.1: Add the creator to the team as owner/admin
    console.log(`[OrgService] Adding creator ${creatorId} to team...`)
    await appwrite.teams.createMembership({
      teamId: team.$id,
      userId: creatorId,
      roles: ['owner', 'admin'],
    })

    // Step 2: Provision isolated database
    console.log('[OrgService] Creating database...')
    const database = await appwrite.databases.create({
      databaseId: ID.unique(),
      name,
    })
    console.log(`[OrgService] Database created: ${database.$id}`)

    // Step 3: Provision isolated storage bucket
    console.log('[OrgService] Creating bucket...')
    const bucket = await appwrite.storage.createBucket({
      bucketId: ID.unique(),
      name,
      permissions: [
        Permission.read(Role.team(team.$id)),
        Permission.create(Role.team(team.$id)),
        Permission.update(Role.team(team.$id, 'admin')),
        Permission.delete(Role.team(team.$id, 'admin')),
      ],
      fileSecurity: true,
      maximumFileSize: 25 * 1024 * 1024, // 25 MB
      compression: Compression.Gzip,
      encryption: true,
    })
    console.log(`[OrgService] Bucket created: ${bucket.$id}`)

    // Step 4: Store resource IDs + metadata in team preferences
    console.log('[OrgService] Updating team prefs...')
    await appwrite.teams.updatePrefs({
      teamId: team.$id,
      prefs: {
        databaseId: database.$id,
        bucketId: bucket.$id,
        description: description ?? '',
        address: address ?? '',
        rccm: rccm ?? '',
        modules: [],
        plan: 'free',
      },
    })
    console.log('[OrgService] Team prefs updated.')

    // Step 5: Dispatch core modules provisioning to background event listener
    console.log('[OrgService] Dispatching core modules provisioning event...')
    emitter.emit(OrganisationCreated, new OrganisationCreated(team.$id))

    return {
      id: team.$id,
      name: team.name,
      description: description ?? null,
      address: address ?? null,
      rccm: rccm ?? null,
      createdAt: team.$createdAt,
      updatedAt: team.$updatedAt,
    }
  }

  /**
   * Build a public preview URL for any file stored in the public-media bucket.
   * @param fileId - The ID of the file.
   * @param width - Optional desired width of the preview.
   * @param height - Optional desired height of the preview.
   * @returns The public preview URL.
   */
  static buildPreviewUrl(fileId: string, width?: number, height?: number): string {
    const params = new URLSearchParams({ project: appwriteConfig.projectId })

    if (width !== undefined) {
      params.set('width', width.toString())
    }

    if (height !== undefined) {
      params.set('height', height.toString())
    }

    return `${appwriteConfig.endpoint}/storage/buckets/public-media/files/${fileId}/preview?${params.toString()}`
  }

  /**
   * List all organisations the authenticated user belongs to.
   * Uses the session-scoped teams service so only their orgs are returned.
   * @param jwt - The user's session JWT.
   * @returns A list of organisations.
   */
  async list(jwt: string) {
    const { teams } = appwrite.createSessionClient(jwt)
    const result = await teams.list()

    return Promise.all(
      result.teams.map(async (team) => {
        const prefs = (await appwrite.teams.getPrefs({ teamId: team.$id })) as any
        const logoUrl = prefs.logoFileId
          ? OrganisationService.buildPreviewUrl(prefs.logoFileId)
          : null

        return {
          id: team.$id,
          name: team.name,
          membersCount: team.total,
          logoUrl,
          createdAt: team.$createdAt,
          updatedAt: team.$updatedAt,
        }
      })
    )
  }

  /**
   * Get a single organisation with its full metadata from preferences.
   * @param teamId - The ID of the organisation (team).
   * @returns The organisation's full details.
   */
  async get(teamId: string) {
    const [team, prefs] = await Promise.all([
      appwrite.teams.get({ teamId }),
      appwrite.teams.getPrefs({ teamId }) as Promise<any>,
    ])

    const logoUrl = prefs.logoFileId ? OrganisationService.buildPreviewUrl(prefs.logoFileId) : null

    return {
      id: team.$id,
      name: team.name,
      membersCount: team.total,
      description: prefs.description ?? null,
      address: prefs.address ?? null,
      rccm: prefs.rccm ?? null,
      logoUrl,
      modules: prefs.modules ?? [],
      plan: prefs.plan ?? 'free',
      createdAt: team.$createdAt,
      updatedAt: team.$updatedAt,
    }
  }

  /**
   * Upload or replace an organisation's logo.
   * @param teamId - The ID of the organisation (team).
   * @param tmpPath - The temporary path of the logo file.
   * @param fileName - The original filename.
   * @returns The public preview URL of the uploaded logo.
   */
  async uploadLogo(teamId: string, tmpPath: string, fileName: string) {
    const fileId = `logo-${teamId}`
    const prefs = (await appwrite.teams.getPrefs({ teamId })) as any

    // 1. Delete old logo if it exists
    if (prefs.logoFileId) {
      try {
        await appwrite.storage.deleteFile({
          bucketId: 'public-media',
          fileId: prefs.logoFileId,
        })
      } catch (error: any) {
        if (error.code !== 404) throw error
      }
    }

    // 2. Upload the new logo
    const file = InputFile.fromPath(tmpPath, fileName)
    await appwrite.storage.createFile({
      bucketId: 'public-media',
      fileId,
      file,
    })

    // 3. Update team preferences
    await appwrite.teams.updatePrefs({
      teamId,
      prefs: {
        ...prefs,
        logoFileId: fileId,
      },
    })

    return OrganisationService.buildPreviewUrl(fileId)
  }

  /**
   * Update organisation name and/or metadata.
   * Merges with existing prefs to avoid overwriting other stored values.
   * @param teamId - The ID of the organisation (team).
   * @param payload - The update details (name, description, address).
   * @returns The updated organisation details.
   */
  async update(
    teamId: string,
    payload: UpdateOrganisationPayload,
    logoFile?: { tmpPath: string; fileName: string }
  ) {
    const updates: Promise<unknown>[] = []

    // Update team name if provided
    if (payload.name) {
      updates.push(appwrite.teams.updateName({ teamId, name: payload.name }))
    }

    // Merge metadata into existing prefs
    if (
      payload.description !== undefined ||
      payload.address !== undefined ||
      payload.rccm !== undefined
    ) {
      const existing = await appwrite.teams.getPrefs({ teamId })
      updates.push(
        appwrite.teams.updatePrefs({
          teamId,
          prefs: {
            ...existing,
            ...(payload.description !== undefined && { description: payload.description }),
            ...(payload.address !== undefined && { address: payload.address }),
            ...(payload.rccm !== undefined && { rccm: payload.rccm }),
          },
        })
      )
    }

    await Promise.all(updates)

    if (logoFile) {
      await this.uploadLogo(teamId, logoFile.tmpPath, logoFile.fileName)
    }

    return this.get(teamId)
  }

  /**
   * Delete an organisation and all its provisioned resources.
   * Order matters: delete DB and bucket before the team to ensure we have access.
   * @param teamId - The ID of the organisation (team).
   */
  async delete(teamId: string) {
    console.log(`[OrgService] Deleting organisation: ${teamId}`)
    const prefs = (await appwrite.teams.getPrefs({ teamId })) as any

    // 1. Delete isolated resources (Database, Bucket)
    // We wrap these in a Promise.allSettled or individual try/catch to ensure
    // that if one fails (e.g. already deleted), the others still proceed.
    const cleanupTasks = [
      // Delete Database
      async () => {
        if (prefs.databaseId) {
          try {
            await appwrite.databases.delete({ databaseId: prefs.databaseId })
            console.log(`[OrgService] Deleted database: ${prefs.databaseId}`)
          } catch (err: any) {
            console.log(
              `[OrgService] Failed to delete database ${prefs.databaseId}: ${err.message}`
            )
          }
        }
      },
      // Delete Bucket
      async () => {
        if (prefs.bucketId) {
          try {
            await appwrite.storage.deleteBucket({ bucketId: prefs.bucketId })
            console.log(`[OrgService] Deleted bucket: ${prefs.bucketId}`)
          } catch (err: any) {
            console.log(`[OrgService] Failed to delete bucket ${prefs.bucketId}: ${err.message}`)
          }
        }
      },
      // Delete Logo from public-media
      async () => {
        const logoFileId = `logo-${teamId}`
        try {
          await appwrite.storage.deleteFile({
            bucketId: 'public-media',
            fileId: logoFileId,
          })
          console.log(`[OrgService] Deleted logo file: ${logoFileId}`)
        } catch (err: any) {
          // 404 is expected if no logo was ever uploaded
          if (err.code !== 404) {
            console.log(`[OrgService] Failed to delete logo ${logoFileId}: ${err.message}`)
          }
        }
      },
    ]

    await Promise.all(cleanupTasks.map((task) => task()))

    // 2. Delete the team itself
    try {
      await appwrite.teams.delete({ teamId })
      console.log(`[OrgService] Deleted team: ${teamId}`)
    } catch (err: any) {
      console.log(`[OrgService] Failed to delete team ${teamId}: ${err.message}`)
      throw err // Re-throw the team deletion error as it's the primary operation
    }
  }

  // ---------------------------------------------------------------------------
  // Member management
  // ---------------------------------------------------------------------------

  /**
   * Add a member to the organisation by email address.
   *
   * Uses a userId-based approach to avoid sending invitation emails:
   * 1. Look up the user by email in the admin Users API.
   * 2. If not found, auto-create the account with a temporary password.
   * 3. Add them to the team by userId (auto-confirmed, no email sent).
   * @param teamId - The ID of the organisation (team).
   * @param email - The member's email address.
   * @param roles - The roles to assign to the new member.
   * @param name - The member's display name when provisioning a new account.
   * @returns The membership details.
   */
  async addMember(teamId: string, email: string, roles: string[], name: string) {
    // 1. Find or create the user
    const userList = await appwrite.users.list({
      queries: [Query.equal('email', [email])],
    })

    let userId: string

    if (userList.total > 0) {
      // User already exists
      userId = userList.users[0].$id
    } else {
      // User doesn't exist — create with a temporary password
      const newUser = await appwrite.users.create({
        userId: ID.unique(),
        email,
        password: appwriteConfig.tempMemberPassword,
        name,
      })
      userId = newUser.$id

      logger.info({ userId }, '[Member] Provisioned new user account for membership')
    }

    // 2. Add to team by userId — auto-confirmed, no email sent
    const membership = await appwrite.teams.createMembership({
      teamId,
      userId,
      roles,
    })

    // 3. Send notification email to the new member (non-fatal)
    try {
      const team = await appwrite.teams.get({ teamId })
      const memberName = membership.userName || name

      await EmailService.send({
        to: email,
        subject: `Vous avez été ajouté à ${team.name}`,
        html: buildMemberAddedEmailHtml(memberName, team.name),
        text: `Bonjour ${memberName},\n\nVous avez été ajouté à l'organisation ${team.name} sur Bara. Connectez-vous sur https://bara.akumba.io pour accéder à votre espace de travail.`,
      })
    } catch (err: any) {
      logger.warn(
        { teamId, email, error: err.message },
        '[Member] Failed to send notification email'
      )
    }

    return {
      id: membership.$id,
      userId: membership.userId,
      teamId: membership.teamId,
      userName: membership.userName,
      userEmail: membership.userEmail,
      roles: membership.roles,
      invited: membership.invited,
      joined: membership.joined,
    }
  }

  /**
   * List all members of an organisation with pagination.
   * @param teamId - The ID of the organisation (team).
   * @param options - Pagination options.
   * @returns A paginated list of members with their roles and status.
   */
  async listMembers(
    teamId: string,
    options: {
      limit?: number
      page?: number
      search?: string
      role?: string
      hasLicense?: boolean
      departmentId?: string
    } = {}
  ) {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
    const page = Math.max(options.page ?? 1, 1)
    const offset = (page - 1) * limit

    const queries: any[] = [Query.limit(limit), Query.offset(offset)]

    // Filter by role
    if (options.role) {
      queries.push(Query.contains('roles', [options.role]))
    }

    // Filter by search (userName)
    if (options.search) {
      queries.push(Query.search('userName', options.search))
    }

    const result = await appwrite.teams.listMemberships({
      teamId,
      queries,
    })

    // Pre-filter by departmentId if requested
    let departmentUserIds: Set<string> | null = null
    if (options.departmentId) {
      try {
        const membersService = await MembersService.forOrg(teamId)
        const deptMembers = await membersService.listByDepartment(options.departmentId, {
          limit: 5000,
        })
        departmentUserIds = new Set(deptMembers.documents.map((doc: any) => doc.userId))
      } catch (error: any) {
        logger.warn(
          { teamId, departmentId: options.departmentId, error: error?.message },
          '[OrgService] Failed to load department members for filter'
        )
        departmentUserIds = new Set()
      }
    }

    // Fetch active licenses in the organisation
    let activeLicenseUserIds: string[] = []
    try {
      const licensesResult = await appwrite.databases.listDocuments({
        databaseId: 'bara-platform',
        collectionId: Collections.LICENSES,
        queries: [Query.equal('orgId', teamId), Query.equal('isActive', true), Query.limit(100)],
      })
      activeLicenseUserIds = licensesResult.documents.map((doc: any) => doc.userId)
    } catch (err: any) {
      logger.warn(
        { teamId, error: err?.message },
        '[OrgService] Failed to load licenses for member list'
      )
    }

    // Apply post-filters (departmentId, hasLicense) before mapping
    let filteredMemberships = result.memberships

    if (departmentUserIds !== null) {
      filteredMemberships = filteredMemberships.filter((m) => departmentUserIds!.has(m.userId))
    }

    if (options.hasLicense !== undefined) {
      filteredMemberships = filteredMemberships.filter((m) => {
        const userHasLicense = activeLicenseUserIds.includes(m.userId)
        return options.hasLicense ? userHasLicense : !userHasLicense
      })
    }

    const documents = await Promise.all(
      filteredMemberships.map(async (m) => {
        let departments: Array<{ id: string; name: string; role: 'manager' | 'member' }> = []
        let avatarUrl: string | null = null

        try {
          const membersService = await MembersService.forOrg(teamId)
          departments = await membersService.listDepartmentsForUser(m.userId)
        } catch (error: any) {
          logger.warn(
            { teamId, userId: m.userId, error: error?.message },
            '[OrgService] Failed to load member departments for list response'
          )
        }

        try {
          const user = await appwrite.users.get({ userId: m.userId })
          const avatarFileId = user.prefs?.avatarFileId
          avatarUrl = avatarFileId ? OrganisationService.buildPreviewUrl(avatarFileId) : null
        } catch (error: any) {
          logger.warn(
            { teamId, userId: m.userId, error: error?.message },
            '[OrgService] Failed to load member avatar for list response'
          )
        }

        return {
          id: m.$id,
          userId: m.userId,
          userName: m.userName,
          userEmail: m.userEmail,
          roles: m.roles,
          invited: m.invited,
          joined: m.joined,
          avatarUrl,
          departments,
          hasLicense: activeLicenseUserIds.includes(m.userId),
        }
      })
    )

    return {
      total:
        departmentUserIds !== null || options.hasLicense !== undefined
          ? filteredMemberships.length
          : result.total,
      documents,
    }
  }

  async getMember(teamId: string, userId: string) {
    const memberships = await appwrite.teams.listMemberships({
      teamId,
      queries: [Query.equal('userId', userId)],
    })

    if (memberships.total === 0) {
      const err = new Error('Member not found')
      ;(err as any).code = 404
      throw err
    }

    const m = memberships.memberships[0]

    let departments: Array<{ id: string; name: string; role: 'manager' | 'member' }> = []
    let avatarUrl: string | null = null

    try {
      const membersService = await MembersService.forOrg(teamId)
      departments = await membersService.listDepartmentsForUser(m.userId)
    } catch (error: any) {
      logger.warn(
        { teamId, userId: m.userId, error: error?.message },
        '[OrgService] Failed to load member departments'
      )
    }

    try {
      const user = await appwrite.users.get({ userId: m.userId })
      const avatarFileId = user.prefs?.avatarFileId
      avatarUrl = avatarFileId ? OrganisationService.buildPreviewUrl(avatarFileId) : null
    } catch (error: any) {
      logger.warn(
        { teamId, userId: m.userId, error: error?.message },
        '[OrgService] Failed to load member avatar'
      )
    }

    // Fetch if the user has an active license
    let hasLicense = false
    try {
      const licensesResult = await appwrite.databases.listDocuments({
        databaseId: 'bara-platform',
        collectionId: Collections.LICENSES,
        queries: [
          Query.equal('orgId', teamId),
          Query.equal('userId', m.userId),
          Query.equal('isActive', true),
          Query.limit(1),
        ],
      })
      hasLicense = licensesResult.total > 0
    } catch (err: any) {
      logger.warn(
        { teamId, userId: m.userId, error: err?.message },
        '[OrgService] Failed to load license info for getMember'
      )
    }

    return {
      id: m.$id,
      userId: m.userId,
      userName: m.userName,
      userEmail: m.userEmail,
      roles: m.roles,
      invited: m.invited,
      joined: m.joined,
      avatarUrl,
      departments,
      hasLicense,
    }
  }

  /**
   * Update a member's roles within the organisation.
   * @param teamId - The ID of the organisation (team).
   * @param membershipId - The ID of the membership record.
   * @param roles - The new roles to assign.
   * @returns The updated membership details.
   */
  async updateMember(teamId: string, membershipId: string, roles: string[]) {
    const membership = await appwrite.teams.updateMembership({
      teamId,
      membershipId,
      roles,
    })

    return {
      id: membership.$id,
      userId: membership.userId,
      roles: membership.roles,
    }
  }

  /**
   * Remove a member from the organisation.
   * @param teamId - The ID of the organisation (team).
   * @param membershipId - The ID of the membership record to remove.
   */
  async removeMember(teamId: string, membershipId: string) {
    let membership: Awaited<ReturnType<typeof appwrite.teams.getMembership>> | undefined

    try {
      // 1. Get membership details to retrieve the userId
      membership = await appwrite.teams.getMembership({ teamId, membershipId })

      // 2. Revoke their seat license if it exists
      await PlanService.revokeLicenseFromUser(teamId, membership.userId)
      logger.info(
        { userId: membership.userId, teamId },
        '[Member] Automatically revoked seat license upon removal'
      )
    } catch (err: any) {
      // Non-fatal: user might not have had an active license or membership fetch failed
      logger.warn(
        { membershipId, error: err.message },
        '[Member] Non-fatal: Failed to auto-revoke license during removal'
      )
    }

    // 3. Delete the team membership
    await appwrite.teams.deleteMembership({ teamId, membershipId })

    // 4. Delete the associated Appwrite account
    if (membership?.userId) {
      try {
        await appwrite.users.delete(membership.userId)
        logger.info(
          { userId: membership.userId, teamId },
          '[Member] Deleted Appwrite user account upon removal'
        )
      } catch (err: any) {
        logger.error(
          { userId: membership.userId, teamId, error: err.message },
          '[Member] Failed to delete Appwrite user account during removal'
        )
        throw err
      }
    } else {
      logger.warn(
        { membershipId, teamId },
        '[Member] Skipping Appwrite account deletion because membership userId was unavailable'
      )
    }
  }

  /**
   * Automatically ensures a "Courier Service" department exists and maps secretariat members to it.
   */
  async ensureCourierDepartmentAndSecretariatMembers(orgId: string) {
    const prefs = (await appwrite.teams.getPrefs({ teamId: orgId })) as any
    const databaseId = prefs.databaseId
    if (!databaseId) return

    // 1. Ensure "Courier Service" department exists
    let courierDeptId: string | null = null
    const depts = await appwrite.databases.listDocuments({
      databaseId,
      collectionId: Collections.DEPARTMENTS,
      queries: [Query.equal('name', 'Courier Service'), Query.limit(1)],
    })

    if (depts.total > 0) {
      courierDeptId = depts.documents[0].$id
    } else {
      const newDept = await appwrite.databases.createDocument({
        databaseId,
        collectionId: Collections.DEPARTMENTS,
        documentId: ID.unique(),
        data: {
          name: 'Courier Service',
          description: 'Department responsible for mail, courier pickup, and dispatching.',
          managerUserId: '',
        },
      })
      courierDeptId = newDept.$id
    }

    // 2. Fetch all members with secretariat role
    const memberships = await appwrite.teams.listMemberships({
      teamId: orgId,
    })

    const secretariatMembers = memberships.memberships.filter((m) =>
      m.roles?.includes('secretariat')
    )

    // 3. For each secretariat member, ensure they have a profile in the Courier Service department
    for (const member of secretariatMembers) {
      const existingProfile = await appwrite.databases.listDocuments({
        databaseId: databaseId,
        collectionId: Collections.ORG_PROFILES,
        queries: [
          Query.equal('userId', member.userId),
          Query.equal('departmentId', courierDeptId),
          Query.limit(1),
        ],
      })

      if (existingProfile.total === 0) {
        await appwrite.databases.createDocument({
          databaseId: databaseId,
          collectionId: Collections.ORG_PROFILES,
          documentId: ID.unique(),
          data: {
            userId: member.userId,
            membershipId: member.$id,
            departmentId: courierDeptId,
            jobTitle: 'Secretariat Agent',
            departmentRole: 'member',
          },
        })
      }
    }
  }
}

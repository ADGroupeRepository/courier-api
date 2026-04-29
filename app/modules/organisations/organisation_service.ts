import appwriteConfig from '#config/appwrite'
import appwrite from '#services/appwrite_service'
import logger from '@adonisjs/core/services/logger'
import { Compression, ID, Permission, Query, Role } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'
import ModuleProvisioningService from '#modules/_registry/provisioning_service'
import { MODULE_REGISTRY } from '#modules/_registry/module_registry'

interface CreateOrganisationPayload {
  name: string
  description?: string
  address?: string
}

interface UpdateOrganisationPayload {
  name?: string
  description?: string
  address?: string
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
   */
  async create(payload: CreateOrganisationPayload, creatorId: string) {
    console.error(`[OrgService] Starting creation for: ${payload.name} (Creator: ${creatorId})`)
    const { name, description, address } = payload
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
        modules: [],
        plan: 'free',
      },
    })
    console.log('[OrgService] Team prefs updated.')
    
    // Step 5: Auto-provision core modules (like 'directory')
    console.log('[OrgService] Provisioning core modules...')
    const provisioningService = new ModuleProvisioningService()
    for (const [moduleName, moduleDef] of MODULE_REGISTRY) {
      if (moduleDef.core) {
        console.log(`[OrgService] Activating core module: ${moduleName}. Memory: ${JSON.stringify(process.memoryUsage())}`)
        await provisioningService.activate(team.$id, moduleName)
      }
    }
    console.log(`[OrgService] Core modules provisioned. Memory: ${JSON.stringify(process.memoryUsage())}`)

    return {
      id: team.$id,
      name: team.name,
      description: description ?? null,
      address: address ?? null,
      databaseId: database.$id,
      bucketId: bucket.$id,
      createdAt: team.$createdAt,
      updatedAt: team.$updatedAt,
    }
  }

  /**
   * Build a public preview URL for any file stored in the public-media bucket.
   */
  static buildPreviewUrl(fileId: string, width = 200, height = 200): string {
    return `${appwriteConfig.endpoint}/storage/buckets/public-media/files/${fileId}/preview?width=${width}&height=${height}&project=${appwriteConfig.projectId}`
  }

  /**
   * List all organisations the authenticated user belongs to.
   * Uses the session-scoped teams service so only their orgs are returned.
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
          total: team.total,
          logoUrl,
          createdAt: team.$createdAt,
          updatedAt: team.$updatedAt,
        }
      })
    )
  }

  /**
   * Get a single organisation with its full metadata from preferences.
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
      total: team.total,
      description: prefs.description ?? null,
      address: prefs.address ?? null,
      databaseId: prefs.databaseId,
      bucketId: prefs.bucketId,
      logoUrl,
      modules: prefs.modules ?? [],
      plan: prefs.plan ?? 'free',
      createdAt: team.$createdAt,
      updatedAt: team.$updatedAt,
    }
  }

  /**
   * Upload or replace an organisation's logo.
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
   */
  async update(teamId: string, payload: UpdateOrganisationPayload) {
    const updates: Promise<unknown>[] = []

    // Update team name if provided
    if (payload.name) {
      updates.push(appwrite.teams.updateName({ teamId, name: payload.name }))
    }

    // Merge metadata into existing prefs
    if (payload.description !== undefined || payload.address !== undefined) {
      const existing = await appwrite.teams.getPrefs({ teamId })
      updates.push(
        appwrite.teams.updatePrefs({
          teamId,
          prefs: {
            ...existing,
            ...(payload.description !== undefined && { description: payload.description }),
            ...(payload.address !== undefined && { address: payload.address }),
          },
        })
      )
    }

    await Promise.all(updates)
    return this.get(teamId)
  }

  /**
   * Delete an organisation and all its provisioned resources.
   * Order matters: delete DB and bucket before the team to ensure we have access.
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
            console.log(`[OrgService] Failed to delete database ${prefs.databaseId}: ${err.message}`)
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
   */
  async addMember(teamId: string, email: string, roles: string[]) {
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
        name: email.split('@')[0], // Use email prefix as default name
      })
      userId = newUser.$id

      logger.info({ email }, '[Member] Created account (using TEMP_MEMBER_PASSWORD)')
    }

    // 2. Add to team by userId — auto-confirmed, no email sent
    const membership = await appwrite.teams.createMembership({
      teamId,
      userId,
      roles,
    })

    return {
      id: membership.$id,
      userId: membership.userId,
      teamId: membership.teamId,
      userName: membership.userName,
      userEmail: membership.userEmail,
      roles: membership.roles,
      invited: membership.invited,
      joined: membership.joined,
      confirm: membership.confirm,
    }
  }

  /**
   * List all members of an organisation.
   */
  async listMembers(teamId: string) {
    const result = await appwrite.teams.listMemberships({ teamId })

    return result.memberships.map((m) => ({
      id: m.$id,
      userId: m.userId,
      userName: m.userName,
      userEmail: m.userEmail,
      roles: m.roles,
      invited: m.invited,
      joined: m.joined,
      confirm: m.confirm,
    }))
  }

  /**
   * Update a member's roles within the organisation.
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
   */
  async removeMember(teamId: string, membershipId: string) {
    await appwrite.teams.deleteMembership({ teamId, membershipId })
  }
}

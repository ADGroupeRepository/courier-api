import { Client, Users, Teams, Databases, Storage, Account } from 'node-appwrite'
import appwriteConfig from '#config/appwrite'

/**
 * Core Appwrite service providing both admin and session-scoped clients.
 *
 * - **Admin client**: Singleton initialized once at module load. Uses the
 *   API key for server-side operations (provisioning, user management).
 * - **Session client**: Created per-request using the user's JWT.
 *
 * Usage:
 *   import appwrite from '#services/appwrite_service'
 *   await appwrite.users.get({ userId: '...' })
 */
class AppwriteService {
  private readonly adminClient: Client

  constructor() {
    this.adminClient = new Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId)
      .setKey(appwriteConfig.apiKey)
      .setSelfSigned(true)
  }

  /** Admin-scoped Users service (requires API key). */
  get users() {
    return new Users(this.adminClient)
  }

  /** Admin-scoped Teams service (requires API key). */
  get teams() {
    return new Teams(this.adminClient)
  }

  /** Admin-scoped Databases service (requires API key). */
  get databases() {
    return new Databases(this.adminClient)
  }

  /** Admin-scoped Storage service (requires API key). */
  get storage() {
    return new Storage(this.adminClient)
  }

  /**
   * Create a session-scoped client for acting on behalf of a specific user.
   * The JWT comes from the client-side Appwrite SDK after login.
   */
  createSessionClient(jwt: string) {
    const client = new Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId)
      .setJWT(jwt)
      .setSelfSigned(true)

    return {
      client,
      account: new Account(client),
      teams: new Teams(client),
      databases: new Databases(client),
      storage: new Storage(client),
    }
  }
}

/**
 * Singleton instance — ESM module caching guarantees this is created
 * exactly once and reused across all imports.
 */
const appwrite = new AppwriteService()
export default appwrite

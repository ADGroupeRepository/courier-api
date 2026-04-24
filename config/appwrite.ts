/*
|--------------------------------------------------------------------------
| Appwrite configuration
|--------------------------------------------------------------------------
*/

import env from '#start/env'

const appwriteConfig = {
  endpoint: env.get('APPWRITE_ENDPOINT'),
  projectId: env.get('APPWRITE_PROJECT_ID'),
  apiKey: env.get('APPWRITE_KEY'),
  tempMemberPassword: env.get('TEMP_MEMBER_PASSWORD'),
}

export default appwriteConfig

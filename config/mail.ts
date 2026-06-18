/*
|--------------------------------------------------------------------------
| Mail configuration
|--------------------------------------------------------------------------
*/

import env from '#start/env'

const mailConfig = {
  resendApiKey: env.get('RESEND_API_KEY'),
  fromAddress: env.get('MAIL_FROM_ADDRESS'),
}

export default mailConfig

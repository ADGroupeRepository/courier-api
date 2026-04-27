import { test } from '@japa/runner'

test.group('Auth', () => {
  const testEmail = `test-${Math.random().toString(36).substring(7)}@bara.app`
  const testPassword = 'Password123!'
  let jwtToken: string

  /*
  // Cleanup after all tests in this group
  group.teardown(async () => {
    const users = await appwrite.users.list([Query.equal('email', testEmail)])
    for (const user of users.users) {
      await appwrite.users.delete({ userId: user.$id })
    }
  })
  */

  test('signup a new user', async ({ client, assert }) => {
    const response = await client.post('/api/v1/auth/signup').json({
      name: 'Test User',
      email: testEmail,
      password: testPassword,
    })

    response.assertStatus(201)
    assert.equal(response.body().data.email, testEmail)
    assert.property(response.body().data, 'id')
  })

  test('login with valid credentials', async ({ client, assert }) => {
    const response = await client.post('/api/v1/auth/login').json({
      email: testEmail,
      password: testPassword,
    })

    response.assertStatus(200)
    assert.property(response.body().data, 'token')
    assert.property(response.body().data, 'user')
    assert.property(response.body().data, 'organisations')
    
    jwtToken = response.body().data.token
  })

  test('get current profile', async ({ client, assert }) => {
    const response = await client
      .get('/api/v1/auth/profile')
      .setup((request) => request.bearerToken(jwtToken))

    response.assertStatus(200)
    assert.equal(response.body().data.user.email, testEmail)
    assert.isArray(response.body().data.organisations)
  })

  test('logout successfully', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/logout')
      .setup((request) => request.bearerToken(jwtToken))

    response.assertStatus(200)
  })

  test('deny access to profile after logout', async ({ client }) => {
    const response = await client
      .get('/api/v1/auth/profile')
      .setup((request) => request.bearerToken(jwtToken))

    // Appwrite JWT should be invalidated or the middleware should catch it
    response.assertStatus(401)
  })
})

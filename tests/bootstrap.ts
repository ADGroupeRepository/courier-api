export const runnerHooks = {
  setup: [] as Array<() => void | Promise<void>>,
  teardown: [] as Array<() => void | Promise<void>>,
}

export const configureSuite = (suite: any) => {
  if (suite.name === 'functional') {
    // suite.setup(() => {})
  }
}

import { test, expect } from "./support/electronFixture";

test("launches the desktop app with isolated temporary app data", async ({
  appDataDir,
  electronApp,
}) => {
  const appDataPath = await electronApp.evaluate(({ app }) => app.getPath("appData"));

  expect(appDataPath).toBe(appDataDir);
});

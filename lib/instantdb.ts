import { init, i, InstantReactWebDatabase } from "@instantdb/react"

const schema = i.schema({
  entities: {
    workspaces: i.entity({
      name: i.string(),
      createdAt: i.number(),
      updatedAt: i.number(),
      platformFilter: i.json(),
      rulesJson: i.string(),
      coverageStats: i.json(),
      currentRules: i.json(),
    }),
  },
})

export type AppSchema = typeof schema

const APP_ID =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_INSTANTDB_APP_ID ?? "" : ""

export const isInstantDBConfigured = APP_ID.length > 0

// init() requires an appId; use a placeholder when none is configured so module
// load doesn't throw. All call sites must check isInstantDBConfigured before
// performing real operations.
export const db: InstantReactWebDatabase<AppSchema> = init({
  appId: APP_ID || "00000000-0000-0000-0000-000000000000",
  schema,
})

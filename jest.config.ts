import type { Config } from "jest"

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom",
  rootDir: ".",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|scss|sass)$": "<rootDir>/tests/__mocks__/styleMock.js",
    // uuid v14 ships ESM-only; mock with CJS-compatible deterministic shim for tests
    "^uuid$": "<rootDir>/tests/__mocks__/uuid.js",
  },
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts", "<rootDir>/tests/unit/**/*.test.tsx"],
  collectCoverageFrom: ["lib/**/*.ts", "hooks/**/*.ts", "components/**/*.tsx"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        esModuleInterop: true,
      },
    }],
  },
}

export default config

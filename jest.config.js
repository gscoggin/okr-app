/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub out Next.js server-only modules that don't work in Jest
    '^next/headers$': '<rootDir>/src/__tests__/__mocks__/next-headers.ts',
  },
  testMatch: [
    '<rootDir>/src/__tests__/journeys/**/*.test.ts',
    '<rootDir>/src/__tests__/unit/**/*.test.ts',
  ],
  testTimeout: 30000, // allow time for MongoMemoryServer binary download
};

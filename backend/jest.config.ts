import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 20000,
  // Suppress noisy console output from application code during tests.
  silent: false,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/database/migrate.ts',
    '!src/database/schema.sql',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@bank-statement-ocr/shared(.*)$': '<rootDir>/../shared/src$1',
  },
};

export default config;

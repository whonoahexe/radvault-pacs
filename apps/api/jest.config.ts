import type { Config } from 'jest';

const cliArgs = process.argv.join(' ');
const isIntegrationRun =
  cliArgs.includes('--testPathPattern=test') || cliArgs.includes('--testPathPatterns=test');

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@radvault/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  testMatch: isIntegrationRun
    ? ['<rootDir>/test/**/*.integration.spec.ts']
    : ['<rootDir>/src/**/*.spec.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.module.ts',
    '!<rootDir>/src/main.ts',
    '!<rootDir>/src/telemetry.ts',
    '!<rootDir>/src/**/*.controller.ts',
    '!<rootDir>/src/**/dto/**',
    '!<rootDir>/src/**/decorators/**',
    '!<rootDir>/src/**/guards/**',
    '!<rootDir>/src/**/strategies/**',
    '!<rootDir>/src/common/**',
    '!<rootDir>/src/modules/audit/**',
    '!<rootDir>/src/modules/dicom/**',
    '!<rootDir>/src/modules/health/**',
    '!<rootDir>/src/modules/internal/**',
  ],
  coveragePathIgnorePatterns: ['/dist/'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};

export default config;

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'Node',
        target: 'ES2022',
        strict: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        declaration: false,
        declarationMap: false,
        sourceMap: false,
      }
    }],
  },
  moduleNameMapper: {
    '^(\\.\\.?\\/.*)\\.js$': '$1',
  },
  testTimeout: 10000
};

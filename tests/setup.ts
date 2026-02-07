/**
 * Jest Test Setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'oracle_test';
process.env.DB_USER = 'oracle';
process.env.DB_PASSWORD = 'oracle_test_password';
process.env.TEMPORAL_ADDRESS = 'localhost:7233';
process.env.PORT = '3099';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
  // Add any global setup here
});

// Global teardown
afterAll(async () => {
  // Add any global cleanup here
});

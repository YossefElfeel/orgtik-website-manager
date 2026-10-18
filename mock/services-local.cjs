// Loaded only by the local Services entrypoint/development command.
process.env.ORGTIK_SERVICES_DEV = "1";
process.env.VERCEL_ENV = "development";
process.env.MOCK_SANDBOX = "services-local";
process.env.MOCK_AUTH_STORE = "file";
process.env.MOCK_JOURNAL = "file";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

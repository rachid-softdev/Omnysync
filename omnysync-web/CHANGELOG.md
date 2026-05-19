# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Security improvements (encryption, CSP headers, rate limiting)
- API validation with Zod schemas
- Comprehensive test coverage
- CI/CD workflows
- Performance database indexes
- HTTP timeout and retry for all connector services
- AI usage tracking and logging
- Queue system with idempotency and dead letter queue

### Fixed

- Google Docs credential encryption
- ENCRYPTION_KEY now required with minimum length
- ENCRYPTION_SALT moved to environment variable
- Stripe subscription limit enforcement
- Connector limit enforcement

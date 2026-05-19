# API Documentation

## Authentication

All API routes (except webhooks and OAuth) require authentication via NextAuth session.

## Endpoints

### Sync

#### GET /api/sync

List all sync documents for the authenticated user.

#### POST /api/sync

Create a new sync document.

Body:

```json
{
  "sourceConnectorId": "uuid",
  "destConnectorId": "uuid",
  "sourceDocumentId": "string",
  "title": "string (optional)"
}
```

### Connectors

#### GET /api/connectors

List all connectors for the authenticated user.

#### POST /api/connectors

Create a new connector.

Body:

```json
{
  "type": "GOOGLE_DOCS|NOTION|WORDPRESS|GHOST|WEBFLOW|SHOPIFY",
  "name": "string",
  "config": {},
  "credentials": {}
}
```

### Stripe

#### POST /api/stripe/checkout

Create a Stripe checkout session.

#### GET /api/stripe/portal

Get Stripe customer portal URL.

#### POST /api/stripe/webhook

Handle Stripe webhooks.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE (optional)"
}
```

Common status codes:

- 400: Bad Request
- 401: Unauthorized
- 429: Rate Limit Exceeded
- 500: Internal Server Error

```

```

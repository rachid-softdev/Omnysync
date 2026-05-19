# Deployment Guide

## Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ENCRYPTION_KEY`
   - `ENCRYPTION_SALT`
   - `OPENAI_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_BUSINESS_MONTHLY`
3. Deploy!

## Railway

1. Create new project
2. Add PostgreSQL database
3. Add environment variables
4. Deploy from GitHub

## Docker

```bash
docker-compose up -d
```

## Environment Variables

See `.env.example` for all required variables.
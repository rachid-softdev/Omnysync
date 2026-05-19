/**
 * Seed script for Feature Flags & Entitlements
 *
 * Run with: npx tsx scripts/seed-entitlements.ts
 *
 * Creates:
 * - Plans (free, pro, business, enterprise)
 * - Features (boolean, limit, experiment types)
 * - Plan-Feature associations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    isActive: true,
    sortOrder: 0,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    priceYearly: 290,
    isActive: true,
    sortOrder: 1,
  },
  {
    key: 'business',
    name: 'Business',
    priceMonthly: 99,
    priceYearly: 990,
    isActive: true,
    sortOrder: 2,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceMonthly: null,
    priceYearly: null,
    isActive: true,
    sortOrder: 3,
  },
]

const FEATURES = [
  // Boolean features
  {
    key: 'EXPORT_PDF',
    name: 'Export PDF',
    description: 'Export documents as PDF',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'EXPORT_CSV',
    name: 'Export CSV',
    description: 'Export data as CSV',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'AI_SUMMARY',
    name: 'AI Summary',
    description: 'AI-powered content summarization',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'AI_SEO',
    name: 'AI SEO',
    description: 'AI-powered SEO optimization',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'AI_IMAGES',
    name: 'AI Images',
    description: 'AI-generated images',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'AI_INTERLINKING',
    name: 'AI Interlinking',
    description: 'AI-powered internal linking',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'TWO_WAY_SYNC',
    name: 'Two-Way Sync',
    description: 'Bidirectional content synchronization',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'APPROVAL_PORTAL',
    name: 'Approval Portal',
    description: 'Content approval workflow',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'CUSTOM_DOMAIN',
    name: 'Custom Domain',
    description: 'Use your own domain',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'API_ACCESS',
    name: 'API Access',
    description: 'Programmatic API access',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'PRIORITY_SUPPORT',
    name: 'Priority Support',
    description: 'Priority customer support',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'ANALYTICS_EXPORT',
    name: 'Analytics Export',
    description: 'Export analytics data',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'WEBHOOKS',
    name: 'Webhooks',
    description: 'Custom webhook integrations',
    type: 'BOOLEAN' as const,
  },
  {
    key: 'SCHEDULED_SYNC',
    name: 'Scheduled Sync',
    description: 'Automated scheduled syncing',
    type: 'BOOLEAN' as const,
  },

  // Limit features
  {
    key: 'MAX_CONNECTORS',
    name: 'Max Connectors',
    description: 'Maximum number of connectors',
    type: 'LIMIT' as const,
    defaultConfig: { max: 100 },
  },
  {
    key: 'MAX_DOCUMENTS',
    name: 'Max Documents',
    description: 'Maximum number of documents',
    type: 'LIMIT' as const,
    defaultConfig: { max: 10000 },
  },
  {
    key: 'MAX_SYNCS_PER_MONTH',
    name: 'Max Syncs/Month',
    description: 'Maximum syncs per month',
    type: 'LIMIT' as const,
    defaultConfig: { max: 1000 },
  },
  {
    key: 'MAX_TEAM_MEMBERS',
    name: 'Max Team Members',
    description: 'Maximum team members',
    type: 'LIMIT' as const,
    defaultConfig: { max: 50 },
  },
  {
    key: 'MAX_API_CALLS',
    name: 'Max API Calls',
    description: 'Maximum API calls per month',
    type: 'LIMIT' as const,
    defaultConfig: { max: 100000 },
  },

  // Experiment features
  {
    key: 'NEW_DASHBOARD',
    name: 'New Dashboard',
    description: 'Redesigned dashboard experience',
    type: 'EXPERIMENT' as const,
    defaultConfig: { percentage: 50, seed: 'NEW_DASHBOARD_v1' },
  },
  {
    key: 'AI_V2',
    name: 'AI V2',
    description: 'Next generation AI features',
    type: 'EXPERIMENT' as const,
    defaultConfig: { percentage: 25, seed: 'AI_V2_2026' },
  },
]

const PLAN_FEATURES: Record<
  string,
  Record<string, { enabled: boolean; limitValue: number | null; configJson: object | null }>
> = {
  free: {
    EXPORT_PDF: { enabled: false, limitValue: null, configJson: null },
    EXPORT_CSV: { enabled: true, limitValue: null, configJson: null },
    AI_SUMMARY: { enabled: false, limitValue: null, configJson: null },
    AI_SEO: { enabled: false, limitValue: null, configJson: null },
    AI_IMAGES: { enabled: false, limitValue: null, configJson: null },
    AI_INTERLINKING: { enabled: false, limitValue: null, configJson: null },
    TWO_WAY_SYNC: { enabled: false, limitValue: null, configJson: null },
    APPROVAL_PORTAL: { enabled: false, limitValue: null, configJson: null },
    CUSTOM_DOMAIN: { enabled: false, limitValue: null, configJson: null },
    API_ACCESS: { enabled: false, limitValue: null, configJson: null },
    PRIORITY_SUPPORT: { enabled: false, limitValue: null, configJson: null },
    ANALYTICS_EXPORT: { enabled: false, limitValue: null, configJson: null },
    WEBHOOKS: { enabled: false, limitValue: null, configJson: null },
    SCHEDULED_SYNC: { enabled: false, limitValue: null, configJson: null },
    MAX_CONNECTORS: { enabled: true, limitValue: 2, configJson: null },
    MAX_DOCUMENTS: { enabled: true, limitValue: 100, configJson: null },
    MAX_SYNCS_PER_MONTH: { enabled: true, limitValue: 10, configJson: null },
    MAX_TEAM_MEMBERS: { enabled: true, limitValue: 1, configJson: null },
    MAX_API_CALLS: { enabled: true, limitValue: 0, configJson: null },
    NEW_DASHBOARD: { enabled: false, limitValue: null, configJson: null },
    AI_V2: { enabled: false, limitValue: null, configJson: null },
  },
  pro: {
    EXPORT_PDF: { enabled: true, limitValue: null, configJson: null },
    EXPORT_CSV: { enabled: true, limitValue: null, configJson: null },
    AI_SUMMARY: { enabled: true, limitValue: null, configJson: null },
    AI_SEO: { enabled: true, limitValue: null, configJson: null },
    AI_IMAGES: { enabled: true, limitValue: null, configJson: null },
    AI_INTERLINKING: { enabled: true, limitValue: null, configJson: null },
    TWO_WAY_SYNC: { enabled: false, limitValue: null, configJson: null },
    APPROVAL_PORTAL: { enabled: false, limitValue: null, configJson: null },
    CUSTOM_DOMAIN: { enabled: false, limitValue: null, configJson: null },
    API_ACCESS: { enabled: true, limitValue: null, configJson: null },
    PRIORITY_SUPPORT: { enabled: false, limitValue: null, configJson: null },
    ANALYTICS_EXPORT: { enabled: true, limitValue: null, configJson: null },
    WEBHOOKS: { enabled: true, limitValue: null, configJson: null },
    SCHEDULED_SYNC: { enabled: true, limitValue: null, configJson: null },
    MAX_CONNECTORS: { enabled: true, limitValue: 10, configJson: null },
    MAX_DOCUMENTS: { enabled: true, limitValue: -1, configJson: null }, // -1 = unlimited
    MAX_SYNCS_PER_MONTH: { enabled: true, limitValue: 100, configJson: null },
    MAX_TEAM_MEMBERS: { enabled: true, limitValue: 1, configJson: null },
    MAX_API_CALLS: { enabled: true, limitValue: 1000, configJson: null },
    NEW_DASHBOARD: {
      enabled: true,
      limitValue: null,
      configJson: { percentage: 50, seed: 'NEW_DASHBOARD_v1' },
    },
    AI_V2: { enabled: false, limitValue: null, configJson: null },
  },
  business: {
    EXPORT_PDF: { enabled: true, limitValue: null, configJson: null },
    EXPORT_CSV: { enabled: true, limitValue: null, configJson: null },
    AI_SUMMARY: { enabled: true, limitValue: null, configJson: null },
    AI_SEO: { enabled: true, limitValue: null, configJson: null },
    AI_IMAGES: { enabled: true, limitValue: null, configJson: null },
    AI_INTERLINKING: { enabled: true, limitValue: null, configJson: null },
    TWO_WAY_SYNC: { enabled: true, limitValue: null, configJson: null },
    APPROVAL_PORTAL: { enabled: true, limitValue: null, configJson: null },
    CUSTOM_DOMAIN: { enabled: true, limitValue: null, configJson: null },
    API_ACCESS: { enabled: true, limitValue: null, configJson: null },
    PRIORITY_SUPPORT: { enabled: true, limitValue: null, configJson: null },
    ANALYTICS_EXPORT: { enabled: true, limitValue: null, configJson: null },
    WEBHOOKS: { enabled: true, limitValue: null, configJson: null },
    SCHEDULED_SYNC: { enabled: true, limitValue: null, configJson: null },
    MAX_CONNECTORS: { enabled: true, limitValue: -1, configJson: null },
    MAX_DOCUMENTS: { enabled: true, limitValue: -1, configJson: null },
    MAX_SYNCS_PER_MONTH: { enabled: true, limitValue: -1, configJson: null },
    MAX_TEAM_MEMBERS: { enabled: true, limitValue: 10, configJson: null },
    MAX_API_CALLS: { enabled: true, limitValue: 10000, configJson: null },
    NEW_DASHBOARD: {
      enabled: true,
      limitValue: null,
      configJson: { percentage: 50, seed: 'NEW_DASHBOARD_v1' },
    },
    AI_V2: { enabled: true, limitValue: null, configJson: { percentage: 25, seed: 'AI_V2_2026' } },
  },
  enterprise: {
    // All features enabled, all limits unlimited
    EXPORT_PDF: { enabled: true, limitValue: null, configJson: null },
    EXPORT_CSV: { enabled: true, limitValue: null, configJson: null },
    AI_SUMMARY: { enabled: true, limitValue: null, configJson: null },
    AI_SEO: { enabled: true, limitValue: null, configJson: null },
    AI_IMAGES: { enabled: true, limitValue: null, configJson: null },
    AI_INTERLINKING: { enabled: true, limitValue: null, configJson: null },
    TWO_WAY_SYNC: { enabled: true, limitValue: null, configJson: null },
    APPROVAL_PORTAL: { enabled: true, limitValue: null, configJson: null },
    CUSTOM_DOMAIN: { enabled: true, limitValue: null, configJson: null },
    API_ACCESS: { enabled: true, limitValue: null, configJson: null },
    PRIORITY_SUPPORT: { enabled: true, limitValue: null, configJson: null },
    ANALYTICS_EXPORT: { enabled: true, limitValue: null, configJson: null },
    WEBHOOKS: { enabled: true, limitValue: null, configJson: null },
    SCHEDULED_SYNC: { enabled: true, limitValue: null, configJson: null },
    MAX_CONNECTORS: { enabled: true, limitValue: -1, configJson: null },
    MAX_DOCUMENTS: { enabled: true, limitValue: -1, configJson: null },
    MAX_SYNCS_PER_MONTH: { enabled: true, limitValue: -1, configJson: null },
    MAX_TEAM_MEMBERS: { enabled: true, limitValue: -1, configJson: null },
    MAX_API_CALLS: { enabled: true, limitValue: -1, configJson: null },
    NEW_DASHBOARD: {
      enabled: true,
      limitValue: null,
      configJson: { percentage: 100, seed: 'NEW_DASHBOARD_v1' },
    },
    AI_V2: { enabled: true, limitValue: null, configJson: { percentage: 100, seed: 'AI_V2_2026' } },
  },
}

async function seed() {
  console.log('🌱 Seeding entitlements data...')

  // Create plans
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: plan,
      create: plan,
    })
    console.log(`  ✓ Plan: ${plan.name}`)
  }

  // Create features
  const featureMap = new Map<string, string>()
  for (const feature of FEATURES) {
    const created = await prisma.feature.upsert({
      where: { key: feature.key },
      update: feature,
      create: feature,
    })
    featureMap.set(feature.key, created.id)
    console.log(`  ✓ Feature: ${feature.name} (${feature.type})`)
  }

  // Create plan-feature associations
  for (const [planKey, features] of Object.entries(PLAN_FEATURES)) {
    const plan = await prisma.plan.findUnique({ where: { key: planKey } })
    if (!plan) continue

    for (const [featureKey, config] of Object.entries(features)) {
      const featureId = featureMap.get(featureKey)
      if (!featureId) continue

      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: plan.id,
            featureId,
          },
        },
        update: {
          enabled: config.enabled,
          limitValue: config.limitValue,
          configJson: config.configJson,
        },
        create: {
          planId: plan.id,
          featureId,
          enabled: config.enabled,
          limitValue: config.limitValue,
          configJson: config.configJson,
        },
      })
    }
    console.log(`  ✓ Plan features: ${planKey}`)
  }

  console.log('✅ Seeding complete!')
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })

/**
 * Feature Flags & Entitlements - Experiment Service (A/B Testing)
 * Omnysync - 2026
 *
 * Uses murmurhash for stable bucketing - same user always gets same bucket
 * Changing the seed creates a new segment
 */

import { ExperimentConfig, ExperimentBucket } from "./types"
import { EXPERIMENT_DEFAULTS } from "./constants"
import { getEntitlementRepository, FeatureData } from "./EntitlementRepository"

// ============================================================================
// MURMURHASH IMPLEMENTATION (x64)
// ============================================================================

/**
 * murmurhash3 x64 - produces a stable 64-bit hash
 * This implementation is based on the MurmurHash3 algorithm
 */
function murmurhash3(key: string, seed: number = 0): number {
  const data = new TextEncoder().encode(key)
  const len = data.length

  let h1 = seed
  let h2 = seed
  let h3 = seed
  let h4 = seed

  const c1 = 0x87c37b91114253d5n
  const c2 = 0x4cf5ad432745937fn

  // Process 16 bytes at a time (4 uint32)
  let i = 0
  while (i + 16 <= len) {
    const k1 =
      (BigInt(data[i]) |
        (BigInt(data[i + 1]) << 8n) |
        (BigInt(data[i + 2]) << 16n) |
        (BigInt(data[i + 3]) << 24n)) |
      (BigInt(data[i + 4]) << 32n) |
      (BigInt(data[i + 5]) << 40n) |
      (BigInt(data[i + 6]) << 48n) |
      (BigInt(data[i + 7]) << 56n)

    const k2 =
      (BigInt(data[i + 8]) |
        (BigInt(data[i + 9]) << 8n) |
        (BigInt(data[i + 10]) << 16n) |
        (BigInt(data[i + 11]) << 24n)) |
      (BigInt(data[i + 12]) << 32n) |
      (BigInt(data[i + 13]) << 40n) |
      (BigInt(data[i + 14]) << 48n) |
      (BigInt(data[i + 15]) << 56n)

    h1 = Number((BigInt(h1) ^ (k1 * c1)) & 0xffffffffn) >>> 0
    h1 = ((h1 << 31) | (h1 >>> 1)) >>> 0
    h1 = Number((BigInt(h1) * c2) & 0xffffffffn) >>> 0

    h2 = Number((BigInt(h2) ^ (k2 * c2)) & 0xffffffffn) >>> 0
    h2 = ((h2 << 31) | (h2 >>> 1)) >>> 0
    h2 = Number((BigInt(h2) * c1) & 0xffffffffn) >>> 0

    i += 16
  }

  // Handle remaining bytes
  let k1 = 0n
  let k2 = 0n

  switch (len % 16) {
    case 15:
      k2 ^= BigInt(data[i + 14]) << 48n
      // eslint-disable-next-line no-fallthrough
    case 14:
      k2 ^= BigInt(data[i + 13]) << 40n
      // eslint-disable-next-line no-fallthrough
    case 13:
      k2 ^= BigInt(data[i + 12]) << 32n
      // eslint-disable-next-line no-fallthrough
    case 12:
      k2 ^= BigInt(data[i + 11]) << 24n
      // eslint-disable-next-line no-fallthrough
    case 11:
      k2 ^= BigInt(data[i + 10]) << 16n
      // eslint-disable-next-line no-fallthrough
    case 10:
      k2 ^= BigInt(data[i + 9]) << 8n
      // eslint-disable-next-line no-fallthrough
    case 9:
      k2 ^= BigInt(data[i + 8])
      k2 *= c2
      // eslint-disable-next-line no-fallthrough
    case 8:
      k1 ^= BigInt(data[i + 7]) << 56n
      // eslint-disable-next-line no-fallthrough
    case 7:
      k1 ^= BigInt(data[i + 6]) << 48n
      // eslint-disable-next-line no-fallthrough
    case 6:
      k1 ^= BigInt(data[i + 5]) << 40n
      // eslint-disable-next-line no-fallthrough
    case 5:
      k1 ^= BigInt(data[i + 4]) << 32n
      // eslint-disable-next-line no-fallthrough
    case 4:
      k1 ^= BigInt(data[i + 3]) << 24n
      // eslint-disable-next-line no-fallthrough
    case 3:
      k1 ^= BigInt(data[i + 2]) << 16n
      // eslint-disable-next-line no-fallthrough
    case 2:
      k1 ^= BigInt(data[i + 1]) << 8n
      // eslint-disable-next-line no-fallthrough
    case 1:
      k1 ^= BigInt(data[i])
      k1 *= c1
  }

  // Finalization
  h1 ^= BigInt(len) & 0xffffffffn
  h2 ^= BigInt(len) & 0xffffffffn
  h3 ^= BigInt(len) & 0xffffffffn
  h4 ^= BigInt(len) & 0xffffffffn

  // fmix64
  h1 = Number((BigInt(h1) ^ (BigInt(h1) >> 33n)) & 0xffffffffn) >>> 0
  h1 = (Number((BigInt(h1) * 0xff51afd7ed558ccdn) & 0xffffffffn) ^ (h1 >>> 15)) >>> 0
  h1 = Number((BigInt(h1) * 0xc4ceb9fe1a85ec53n) & 0xffffffffn) >>> 0
  h1 = (h1 ^ (h1 >>> 16)) >>> 0

  h2 = Number((BigInt(h2) ^ (BigInt(h2) >> 33n)) & 0xffffffffn) >>> 0
  h2 = (Number((BigInt(h2) * 0xff51afd7ed558ccdn) & 0xffffffffn) ^ (h2 >>> 15)) >>> 0
  h2 = Number((BigInt(h2) * 0xc4ceb9fe1a85ec53n) & 0xffffffffn) >>> 0
  h2 = (h2 ^ (h2 >>> 16)) >>> 0

  h3 = Number((BigInt(h3) ^ (BigInt(h3) >> 33n)) & 0xffffffffn) >>> 0
  h3 = (Number((BigInt(h3) * 0xff51afd7ed558ccdn) & 0xffffffffn) ^ (h3 >>> 15)) >>> 0
  h3 = Number((BigInt(h3) * 0xc4ceb9fe1a85ec53n) & 0xffffffffn) >>> 0
  h3 = (h3 ^ (h3 >>> 16)) >>> 0

  h4 = Number((BigInt(h4) ^ (BigInt(h4) >> 33n)) & 0xffffffffn) >>> 0
  h4 = (Number((BigInt(h4) * 0xff51afd7ed558ccdn) & 0xffffffffn) ^ (h4 >>> 15)) >>> 0
  h4 = Number((BigInt(h4) * 0xc4ceb9fe1a85ec53n) & 0xffffffffn) >>> 0
  h4 = (h4 ^ (h4 >>> 16)) >>> 0

  // Combine into a single number (0-99 range)
  return ((h1 + h2 + h3 + h4) % 100) >>> 0
}

// ============================================================================
// EXPERIMENT SERVICE
// ============================================================================

export class ExperimentService {
  /**
   * Get the bucket for a user in an experiment
   * Returns a number 0-99 that's stable for the same user+seed
   */
  getBucket(userId: string, seed: string): number {
    const combinedKey = `${seed}:${userId}`
    return murmurhash3(combinedKey)
  }

  /**
   * Check if a user is in an experiment
   * Uses stable hashing to determine bucket
   */
  isInExperiment(
    userId: string,
    config: ExperimentConfig
  ): ExperimentBucket {
    const bucket = this.getBucket(userId, config.seed)
    const inExperiment = bucket < config.percentage

    return {
      inExperiment,
      bucket,
    }
  }

  /**
   * Get experiment config from repository
   */
  async getExperimentConfig(
    experimentKey: string
  ): Promise<ExperimentConfig | null> {
    const repo = getEntitlementRepository()
    const feature = await repo.getFeature(experimentKey)

    if (!feature || feature.type !== "EXPERIMENT") {
      return null
    }

    const defaultConfig = feature.defaultConfig as
      | { percentage: number; seed: string }
      | null

    return {
      percentage: defaultConfig?.percentage ?? EXPERIMENT_DEFAULTS.DEFAULT_PERCENTAGE,
      seed: defaultConfig?.seed ?? `${EXPERIMENT_DEFAULTS.SEED_PREFIX}${experimentKey}`,
      enabled: false, // Will be set by isInExperiment
    }
  }

  /**
   * Check if a feature is an experiment type
   */
  async isExperimentFeature(featureKey: string): Promise<boolean> {
    const repo = getEntitlementRepository()
    const feature = await repo.getFeature(featureKey)
    return feature?.type === "EXPERIMENT"
  }

  /**
   * Get experiment group for frontend display
   * Returns "control" or "treatment" for display purposes
   */
  getExperimentGroup(userId: string, config: ExperimentConfig): string {
    const { inExperiment } = this.isInExperiment(userId, config)
    return inExperiment ? "treatment" : "control"
  }

  /**
   * Force a user into or out of an experiment (for QA/Preview)
   * This should only be used via override, not in the main logic
   */
  forceExperiment(
    userId: string,
    config: ExperimentConfig,
    forceEnabled: boolean
  ): ExperimentBucket {
    // Even when forced, maintain consistent bucket for analytics
    const bucket = this.getBucket(userId, config.seed)

    return {
      inExperiment: forceEnabled,
      bucket,
    }
  }
}

// ============================================================================
// STATIC ANALYTICS METHODS
// ============================================================================

/**
 * Calculate expected distribution for an experiment
 * Useful for validating that percentage is set correctly
 */
export function calculateExpectedDistribution(
  percentage: number,
  totalUsers: number
): { control: number; treatment: number } {
  const treatmentCount = Math.round((totalUsers * percentage) / 100)
  return {
    control: totalUsers - treatmentCount,
    treatment: treatmentCount,
  }
}

/**
 * Validate experiment config
 */
export function validateExperimentConfig(
  config: ExperimentConfig
): { valid: boolean; error?: string } {
  if (config.percentage < 0 || config.percentage > 100) {
    return {
      valid: false,
      error: "Percentage must be between 0 and 100",
    }
  }

  if (!config.seed || config.seed.length === 0) {
    return {
      valid: false,
      error: "Seed is required for experiment",
    }
  }

  return { valid: true }
}

// ============================================================================
// SINGLETON
// ============================================================================

let experimentServiceInstance: ExperimentService | null = null

export function getExperimentService(): ExperimentService {
  if (!experimentServiceInstance) {
    experimentServiceInstance = new ExperimentService()
  }
  return experimentServiceInstance
}

export function setExperimentService(service: ExperimentService): void {
  experimentServiceInstance = service
}

// For testing
export function resetExperimentService(): void {
  experimentServiceInstance = null
}
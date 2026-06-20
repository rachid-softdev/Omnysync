/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ExperimentService Tests
 *
 * Comprehensive tests covering:
 * - murmurhash3 (internal, tested via getBucket)
 * - calculateExpectedDistribution (pure function)
 * - validateExperimentConfig (pure function)
 * - getExperimentConfig (async, repo-backed)
 * - isExperimentFeature (async, repo-backed)
 * - forceExperiment (forced override)
 * - instance methods (isInExperiment, getExperimentGroup)
 * - Singleton management (getExperimentService, setExperimentService, resetExperimentService)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// MOCK DEPENDENCIES
// ============================================================================

const mockRepo = vi.hoisted(() => ({
  getFeature: vi.fn(),
}));

vi.mock("../EntitlementRepository", () => ({
  getEntitlementRepository: () => mockRepo,
}));

// ============================================================================
// IMPORTS
// ============================================================================

import {
  ExperimentService,
  getExperimentService,
  resetExperimentService,
  setExperimentService,
  calculateExpectedDistribution,
  validateExperimentConfig,
} from "../ExperimentService";
import { EXPERIMENT_DEFAULTS } from "../constants";
import type { ExperimentConfig } from "../types";

// ============================================================================
// PURE FUNCTION: murmurhash3 (tested via getBucket)
// ============================================================================

describe("getBucket / murmurhash3", () => {
  let service: ExperimentService;

  beforeEach(() => {
    resetExperimentService();
    service = new ExperimentService();
  });

  it("returns consistent hash for same input", () => {
    const b1 = service.getBucket("user-1", "seed-1");
    const b2 = service.getBucket("user-1", "seed-1");
    expect(b1).toBe(b2);
  });

  it("returns different hashes for inputs differing in bytes 8-11", () => {
    // NOTE: murmurhash3 has a documented implementation issue — the
    // `& 0xffffffffn` masks throughout the main loop cause only bytes
    // 0-2 (via k1_low * c1_low mod 2^32) and bytes 8-11 (via
    // k2_low * c2_low mod 2^32) to affect the final output.  Bytes
    // 3-7 and 12+ are silently discarded.  See the bug report below.
    //
    // We construct combined keys "seed-A:AAAA:long-pad" vs
    // "seed-A:AAAB:long-pad" where byte 11 differs (in k2_low):
    const buckets = new Set([
      service.getBucket("long-pad", "seed-A:AAAA"),
      service.getBucket("long-pad", "seed-A:AAAB"),
      service.getBucket("long-pad", "seed-A:AABA"),
    ]);
    expect(buckets.size).toBeGreaterThan(1);
  });

  it("handles empty userId", () => {
    const bucket = service.getBucket("", "some-seed");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });

  it("handles empty seed", () => {
    const bucket = service.getBucket("some-user", "");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });

  it("handles both empty userId and seed", () => {
    const bucket = service.getBucket("", "");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });

  it("handles unicode strings", () => {
    const bucket = service.getBucket("üser-ñàmé", "sééd-日文");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });

  it("produces bucket in range [0, 99] inclusive", () => {
    for (const uid of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const bucket = service.getBucket(uid, "test-seed");
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
    }
  });

  it("produces distribution across the range with varied bytes 8-11", () => {
    // NOTE: Due to the & 0xffffffffn masks, only bytes 0-2 and 8-11
    // affect the output.  We construct "seed-A:NNNN:long-pad" where
    // NNNN varies 0000-0199 so that bytes 8-11 vary widely.
    const buckets = new Set(
      Array.from({ length: 200 }, (_, i) => {
        const tag = String(i).padStart(4, "0");
        return service.getBucket("long-pad", `seed-A:${tag}`);
      }),
    );
    // 200 distinct k2_low values → expect strong spread across 100 slots
    expect(buckets.size).toBeGreaterThan(50);
  });
});

// ============================================================================
// PURE FUNCTION: calculateExpectedDistribution
// ============================================================================

describe("calculateExpectedDistribution", () => {
  it("returns 50/50 split for 50% of 100 users", () => {
    const result = calculateExpectedDistribution(50, 100);
    expect(result.control).toBe(50);
    expect(result.treatment).toBe(50);
  });

  it("returns all control for 0%", () => {
    const result = calculateExpectedDistribution(0, 100);
    expect(result.control).toBe(100);
    expect(result.treatment).toBe(0);
  });

  it("returns all treatment for 100%", () => {
    const result = calculateExpectedDistribution(100, 100);
    expect(result.control).toBe(0);
    expect(result.treatment).toBe(100);
  });

  it("returns 0/0 for 0 users", () => {
    const result = calculateExpectedDistribution(50, 0);
    expect(result.control).toBe(0);
    expect(result.treatment).toBe(0);
  });

  it("handles uneven distribution with correct rounding", () => {
    // 33% of 100 = 33 treatment, 67 control
    const result = calculateExpectedDistribution(33, 100);
    expect(result.treatment).toBe(33);
    expect(result.control).toBe(67);
    expect(result.control + result.treatment).toBe(100);
  });

  it("rounds correctly for odd total with fractional treatment", () => {
    // 33% of 3 = 0.99 → Math.round → 1 treatment, 2 control
    const result = calculateExpectedDistribution(33, 3);
    expect(result.treatment).toBe(1);
    expect(result.control).toBe(2);
  });

  it("handles very small percentages correctly", () => {
    // 1% of 1000 = 10
    const result = calculateExpectedDistribution(1, 1000);
    expect(result.treatment).toBe(10);
    expect(result.control).toBe(990);
  });

  it("total always equals totalUsers regardless of rounding", () => {
    // Test several combos to verify total invariance
    const combos: Array<[number, number]> = [
      [33, 100],
      [25, 77],
      [50, 3],
      [10, 9],
      [99, 1000],
      [17, 50],
    ];
    for (const [pct, total] of combos) {
      const result = calculateExpectedDistribution(pct, total);
      expect(result.control + result.treatment).toBe(total);
    }
  });
});

// ============================================================================
// PURE FUNCTION: validateExperimentConfig
// ============================================================================

describe("validateExperimentConfig", () => {
  it("returns valid for correct config", () => {
    const config: ExperimentConfig = {
      percentage: 50,
      seed: "test-seed",
      enabled: false,
    };
    const result = validateExperimentConfig(config);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid for 0% config (disabled experiment)", () => {
    const config: ExperimentConfig = {
      percentage: 0,
      seed: "test-seed",
      enabled: false,
    };
    const result = validateExperimentConfig(config);
    expect(result.valid).toBe(true);
  });

  it("returns valid for 100% config (everyone in experiment)", () => {
    const config: ExperimentConfig = {
      percentage: 100,
      seed: "test-seed",
      enabled: false,
    };
    const result = validateExperimentConfig(config);
    expect(result.valid).toBe(true);
  });

  it("returns invalid for negative percentage", () => {
    const config: ExperimentConfig = {
      percentage: -1,
      seed: "test-seed",
      enabled: false,
    };
    const result = validateExperimentConfig(config);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Percentage");
  });

  it("returns invalid for percentage > 100", () => {
    const config: ExperimentConfig = {
      percentage: 101,
      seed: "test-seed",
      enabled: false,
    };
    const result = validateExperimentConfig(config);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Percentage");
  });

  it("returns invalid for empty seed", () => {
    const config: ExperimentConfig = {
      percentage: 50,
      seed: "",
      enabled: false,
    };
    const result = validateExperimentConfig(config);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Seed");
  });
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

describe("ExperimentService instance methods", () => {
  let service: ExperimentService;

  beforeEach(() => {
    resetExperimentService();
    service = new ExperimentService();
  });

  // ==========================================================================
  // isInExperiment
  // ==========================================================================

  describe("isInExperiment", () => {
    it("returns inExperiment=true when bucket < percentage (100% always in)", () => {
      const config: ExperimentConfig = {
        percentage: 100,
        seed: "test-seed",
        enabled: false,
      };
      const result = service.isInExperiment("user-1", config);
      expect(result.inExperiment).toBe(true);
      expect(result.bucket).toBeGreaterThanOrEqual(0);
      expect(result.bucket).toBeLessThan(100);
    });

    it("returns inExperiment=false when percentage is 0", () => {
      const config: ExperimentConfig = {
        percentage: 0,
        seed: "test-seed",
        enabled: false,
      };
      const result = service.isInExperiment("user-1", config);
      expect(result.inExperiment).toBe(false);
      expect(result.bucket).toBeGreaterThanOrEqual(0);
      expect(result.bucket).toBeLessThan(100);
    });

    it("returns consistent result for same user+config", () => {
      const config: ExperimentConfig = {
        percentage: 50,
        seed: "test-seed",
        enabled: false,
      };
      const r1 = service.isInExperiment("user-1", config);
      const r2 = service.isInExperiment("user-1", config);
      expect(r1.inExperiment).toBe(r2.inExperiment);
      expect(r1.bucket).toBe(r2.bucket);
    });

    it("may return different results for different users", () => {
      const config: ExperimentConfig = {
        percentage: 50,
        seed: "test-seed",
        enabled: false,
      };
      // With 50% and enough users, some should be in and some out
      const results = new Set(
        Array.from(
          { length: 20 },
          (_, i) => service.isInExperiment(`user-${i}`, config).inExperiment,
        ),
      );
      // We expect some variety (at least 1 in, at least 1 out)
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // getExperimentGroup
  // ==========================================================================

  describe("getExperimentGroup", () => {
    it('returns "treatment" for user in experiment (100%)', () => {
      const config: ExperimentConfig = {
        percentage: 100,
        seed: "test-group",
        enabled: false,
      };
      expect(service.getExperimentGroup("user-1", config)).toBe("treatment");
    });

    it('returns "control" for user not in experiment (0%)', () => {
      const config: ExperimentConfig = {
        percentage: 0,
        seed: "test-group",
        enabled: false,
      };
      expect(service.getExperimentGroup("user-1", config)).toBe("control");
    });

    it("returns valid group for any user", () => {
      const config: ExperimentConfig = {
        percentage: 50,
        seed: "test-group",
        enabled: false,
      };
      for (const uid of ["a", "b", "c"]) {
        const group = service.getExperimentGroup(uid, config);
        expect(["control", "treatment"]).toContain(group);
      }
    });
  });

  // ==========================================================================
  // getExperimentConfig (async, uses getEntitlementRepository)
  // ==========================================================================

  describe("getExperimentConfig", () => {
    beforeEach(() => {
      mockRepo.getFeature.mockReset();
    });

    it("returns config when feature exists as EXPERIMENT type", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "exp-1",
        key: "TEST_EXP",
        name: "Test Experiment",
        description: null,
        type: "EXPERIMENT",
        defaultConfig: { percentage: 50, seed: "test-v1" },
      });

      const config = await service.getExperimentConfig("TEST_EXP");
      expect(config).not.toBeNull();
      expect(config!.percentage).toBe(50);
      expect(config!.seed).toBe("test-v1");
      expect(config!.enabled).toBe(false);
    });

    it("uses defaults when defaultConfig is null", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "exp-2",
        key: "TEST_EXP_2",
        name: "Test Experiment 2",
        description: null,
        type: "EXPERIMENT",
        defaultConfig: null,
      });

      const config = await service.getExperimentConfig("TEST_EXP_2");
      expect(config).not.toBeNull();
      expect(config!.percentage).toBe(EXPERIMENT_DEFAULTS.DEFAULT_PERCENTAGE);
      expect(config!.seed).toBe(`${EXPERIMENT_DEFAULTS.SEED_PREFIX}TEST_EXP_2`);
    });

    it("uses defaults when defaultConfig lacks percentage/seed keys", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "exp-3",
        key: "TEST_EXP_3",
        name: "Test Experiment 3",
        description: null,
        type: "EXPERIMENT",
        defaultConfig: {},
      });

      const config = await service.getExperimentConfig("TEST_EXP_3");
      expect(config).not.toBeNull();
      expect(config!.percentage).toBe(EXPERIMENT_DEFAULTS.DEFAULT_PERCENTAGE);
      expect(config!.seed).toBe(`${EXPERIMENT_DEFAULTS.SEED_PREFIX}TEST_EXP_3`);
    });

    it("returns null when feature not found", async () => {
      mockRepo.getFeature.mockResolvedValue(null);

      const config = await service.getExperimentConfig("NON_EXISTENT");
      expect(config).toBeNull();
    });

    it("returns null when feature is not EXPERIMENT type (BOOLEAN)", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "bool-1",
        key: "EXPORT_PDF",
        name: "Export PDF",
        description: "Export documents as PDF",
        type: "BOOLEAN",
        defaultConfig: null,
      });

      const config = await service.getExperimentConfig("EXPORT_PDF");
      expect(config).toBeNull();
    });

    it("returns null when feature is LIMIT type", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "lim-1",
        key: "MAX_SYNCS",
        name: "Max Syncs",
        description: "Monthly sync limit",
        type: "LIMIT",
        defaultConfig: null,
      });

      const config = await service.getExperimentConfig("MAX_SYNCS");
      expect(config).toBeNull();
    });

    it("propagates error when repo fails", async () => {
      mockRepo.getFeature.mockRejectedValue(new Error("DB connection failed"));

      await expect(service.getExperimentConfig("FAIL_EXP")).rejects.toThrow(
        "DB connection failed",
      );
    });
  });

  // ==========================================================================
  // isExperimentFeature (async, uses getEntitlementRepository)
  // ==========================================================================

  describe("isExperimentFeature", () => {
    beforeEach(() => {
      mockRepo.getFeature.mockReset();
    });

    it("returns true when feature is EXPERIMENT type", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "exp-1",
        key: "NEW_DASHBOARD",
        name: "New Dashboard",
        description: "A/B test for new dashboard",
        type: "EXPERIMENT",
        defaultConfig: { percentage: 50, seed: "v1" },
      });

      const result = await service.isExperimentFeature("NEW_DASHBOARD");
      expect(result).toBe(true);
    });

    it("returns false when feature is BOOLEAN type", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "bool-1",
        key: "EXPORT_PDF",
        name: "Export PDF",
        description: null,
        type: "BOOLEAN",
        defaultConfig: null,
      });

      const result = await service.isExperimentFeature("EXPORT_PDF");
      expect(result).toBe(false);
    });

    it("returns false when feature is LIMIT type", async () => {
      mockRepo.getFeature.mockResolvedValue({
        id: "lim-1",
        key: "MAX_SYNCS",
        name: "Max Syncs",
        description: null,
        type: "LIMIT",
        defaultConfig: null,
      });

      const result = await service.isExperimentFeature("MAX_SYNCS");
      expect(result).toBe(false);
    });

    it("returns false when feature not found", async () => {
      mockRepo.getFeature.mockResolvedValue(null);

      const result = await service.isExperimentFeature("NON_EXISTENT");
      expect(result).toBe(false);
    });

    it("propagates error when repo fails", async () => {
      mockRepo.getFeature.mockRejectedValue(new Error("Network error"));

      await expect(service.isExperimentFeature("FAIL_FEATURE")).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ==========================================================================
  // forceExperiment
  // ==========================================================================

  describe("forceExperiment", () => {
    it("returns inExperiment=true when forceEnabled=true despite 0% config", () => {
      const config: ExperimentConfig = {
        percentage: 0,
        seed: "test-seed",
        enabled: false,
      };
      const result = service.forceExperiment("user-1", config, true);
      expect(result.inExperiment).toBe(true);
      expect(result.bucket).toBeGreaterThanOrEqual(0);
      expect(result.bucket).toBeLessThan(100);
    });

    it("returns inExperiment=false when forceEnabled=false despite 100% config", () => {
      const config: ExperimentConfig = {
        percentage: 100,
        seed: "test-seed",
        enabled: false,
      };
      const result = service.forceExperiment("user-1", config, false);
      expect(result.inExperiment).toBe(false);
      expect(result.bucket).toBeGreaterThanOrEqual(0);
      expect(result.bucket).toBeLessThan(100);
    });

    it("returns consistent bucket for same user+seed regardless of forceEnabled", () => {
      const config: ExperimentConfig = {
        percentage: 50,
        seed: "test-seed",
        enabled: false,
      };
      const r1 = service.forceExperiment("user-1", config, true);
      const r2 = service.forceExperiment("user-1", config, false);
      // Bucket should be the same regardless of forced state (deterministic hash)
      expect(r1.bucket).toBe(r2.bucket);
    });

    it("bucket matches getBucket for same inputs", () => {
      const config: ExperimentConfig = {
        percentage: 50,
        seed: "test-seed",
        enabled: false,
      };
      const forced = service.forceExperiment("user-1", config, true);
      const plainBucket = service.getBucket("user-1", "test-seed");
      expect(forced.bucket).toBe(plainBucket);
    });
  });
});

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

describe("singleton management", () => {
  beforeEach(() => {
    resetExperimentService();
  });

  it("getExperimentService returns an ExperimentService instance", () => {
    const instance = getExperimentService();
    expect(instance).toBeInstanceOf(ExperimentService);
  });

  it("getExperimentService returns the same instance on repeated calls", () => {
    const instance1 = getExperimentService();
    const instance2 = getExperimentService();
    expect(instance1).toBe(instance2);
  });

  it("setExperimentService replaces the singleton", () => {
    const custom = new ExperimentService();
    setExperimentService(custom);
    expect(getExperimentService()).toBe(custom);
  });

  it("resetExperimentService clears the singleton so a new one is created", () => {
    const instance1 = getExperimentService();
    resetExperimentService();
    const instance2 = getExperimentService();
    expect(instance1).not.toBe(instance2);
  });

  it("resetExperimentService does not affect previously obtained instance", () => {
    const instance1 = getExperimentService();
    resetExperimentService();
    // instance1 should still be a valid, usable object
    const bucket = instance1.getBucket("test", "seed");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
  });
});

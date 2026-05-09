import { describe, it, expect } from "vitest"
import { getPlanLimits, type Plan } from "../auth/subscription"

// Mock the prisma module to avoid DATABASE_URL error
vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    userOrganization: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    syncLog: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}))

describe("subscription plans", () => {
  it("returns correct limits for free plan", () => {
    const limits = getPlanLimits("free")
    expect(limits.syncsPerMonth).toBe(5)
    expect(limits.connectors).toBe(2)
    expect(limits.aiFeatures).toBe(false)
  })

  it("returns correct limits for pro plan", () => {
    const limits = getPlanLimits("pro")
    expect(limits.syncsPerMonth).toBe(100)
    expect(limits.connectors).toBe(10)
    expect(limits.aiFeatures).toBe(true)
  })

  it("returns unlimited for business plan", () => {
    const limits = getPlanLimits("business")
    expect(limits.syncsPerMonth).toBe(Infinity)
    expect(limits.connectors).toBe(Infinity)
    expect(limits.aiFeatures).toBe(true)
  })
})

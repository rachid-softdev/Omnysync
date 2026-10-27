import { describe, it, expect } from "vitest";
import { getRedisRestConfig } from "../redis-config";

describe("getRedisRestConfig", () => {
  it("returns null when only QStash credentials are set", () => {
    expect(
      getRedisRestConfig({
        QSTASH_URL: "https://qstash.upstash.io",
        QSTASH_TOKEN: "qstash-token",
      }),
    ).toBeNull();
  });

  it("returns null when the Redis URL or token is missing", () => {
    expect(
      getRedisRestConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      }),
    ).toBeNull();

    expect(
      getRedisRestConfig({
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
      }),
    ).toBeNull();
  });

  it("returns dedicated Redis credentials when both are set", () => {
    expect(
      getRedisRestConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
      }),
    ).toEqual({
      url: "https://redis.example.com",
      token: "redis-token",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(
      getRedisRestConfig({
        UPSTASH_REDIS_REST_URL: " https://redis.example.com ",
        UPSTASH_REDIS_REST_TOKEN: " redis-token ",
      }),
    ).toEqual({
      url: "https://redis.example.com",
      token: "redis-token",
    });
  });
});

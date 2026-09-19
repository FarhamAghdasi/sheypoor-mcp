import { describe, it, expect, vi } from "vitest";
import { TokenBucket, sleep, jitter } from "../../src/util/throttle.js";

describe("throttle", () => {
  it("TokenBucket takes immediately when full", async () => {
    const b = new TokenBucket(2, 1);
    const start = Date.now();
    await b.take();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("TokenBucket waits when empty", async () => {
    const b = new TokenBucket(1, 10); // 1 token, refill 10/sec -> 100ms per token
    await b.take();
    const start = Date.now();
    await b.take();
    expect(Date.now() - start).toBeGreaterThanOrEqual(80);
  });

  it("jitter stays within bounds", () => {
    for (let i = 0; i < 100; i++) {
      const v = jitter(0, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it("sleep resolves after delay", async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { createRateLimiter } from "../middleware/rateLimit.js";

test("rate limiter rejects requests over the limit with standard headers", async (t) => {
  const app = express();
  app.use("/limited", createRateLimiter({
    limit: 2,
    windowMs: 60_000,
    message: "Too many test requests.",
  }));
  app.get("/limited", (req, res) => res.json({ ok: true }));

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/limited`;
  const first = await fetch(url);
  const second = await fetch(url);
  const blocked = await fetch(url);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { message: "Too many test requests." });
  assert.ok(blocked.headers.get("ratelimit"));
  assert.ok(blocked.headers.get("retry-after"));
  assert.equal(blocked.headers.get("x-ratelimit-limit"), null);
});

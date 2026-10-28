import assert from "node:assert/strict";
import test from "node:test";
import { removeLegacyOrderNumberIndex } from "../utils/orderIndexes.js";

function createDatabase(indexes, { collectionExists = true, dropError } = {}) {
  const calls = [];
  const database = {
    listCollections: () => ({
      toArray: async () => collectionExists ? [{ name: "orders" }] : [],
    }),
    collection: () => ({
      indexes: async () => indexes,
      dropIndex: async (name) => {
        calls.push(name);
        if (dropError) throw dropError;
      },
    }),
  };
  return { database, calls };
}

test("drops the obsolete unique order number index", async () => {
  const { database, calls } = createDatabase([
    { name: "_id_", key: { _id: 1 } },
    { name: "orderNumber_1", key: { orderNumber: 1 }, unique: true },
  ]);

  assert.equal(await removeLegacyOrderNumberIndex(database, "orders"), true);
  assert.deepEqual(calls, ["orderNumber_1"]);
});

test("leaves unrelated indexes unchanged", async () => {
  const { database, calls } = createDatabase([
    { name: "_id_", key: { _id: 1 } },
    { name: "orderNumber_1", key: { orderNumber: 1 } },
    { name: "customer_1", key: { customer: 1 } },
  ]);

  assert.equal(await removeLegacyOrderNumberIndex(database, "orders"), false);
  assert.deepEqual(calls, []);
});

test("does not request indexes when the orders collection is new", async () => {
  const { database, calls } = createDatabase([], { collectionExists: false });

  assert.equal(await removeLegacyOrderNumberIndex(database, "orders"), false);
  assert.deepEqual(calls, []);
});

test("ignores an index already removed by another server instance", async () => {
  const { database, calls } = createDatabase(
    [{ name: "orderNumber_1", key: { orderNumber: 1 }, unique: true }],
    { dropError: Object.assign(new Error("index not found"), { code: 27 }) }
  );

  assert.equal(await removeLegacyOrderNumberIndex(database, "orders"), false);
  assert.deepEqual(calls, ["orderNumber_1"]);
});

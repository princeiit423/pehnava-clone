import test from "node:test";
import assert from "node:assert/strict";
import { buildProductSearchQuery, rankProductsBySearch } from "../utils/productSearch.js";

const products = [
  {
    _id: "shirt",
    title: "Classic Cotton Shirt",
    description: "A comfortable everyday button-down",
    categories: ["daily-wear"],
    colors: [{ name: "Blue" }],
  },
  {
    _id: "tee",
    title: "Graphic Cotton T-Shirt",
    description: "Soft cotton everyday tee",
    categories: ["trending"],
    colors: [{ name: "Black" }],
  },
  {
    _id: "trousers",
    title: "Relaxed Fit Trousers",
    description: "Lightweight cotton pants",
    categories: ["daily-wear"],
    colors: [{ name: "Black" }],
  },
];

test("ranks exact and partial product matches across searchable product details", () => {
  const results = rankProductsBySearch(products, "cotton shirt");
  assert.deepEqual(results.map((product) => product._id), ["shirt", "tee"]);
});

test("finds close spellings and searches product descriptions and colors", () => {
  assert.equal(rankProductsBySearch(products, "classik shrit")[0]._id, "shirt");
  assert.equal(rankProductsBySearch(products, "black")[0]._id, "tee");
  assert.equal(rankProductsBySearch(products, "button")[0]._id, "shirt");
});

test("builds database search expressions for every normalized query term", () => {
  const query = buildProductSearchQuery("red shirt");
  assert.equal(query.$or.length, 20);
  assert.equal(query.$or[0].title.source, "red");
  assert.equal(query.$or[10].title.source, "shirt");
});

test("does not return unrelated products for unmatched terms", () => {
  assert.deepEqual(rankProductsBySearch(products, "spaceship"), []);
});

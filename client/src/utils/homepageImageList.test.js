import { describe, expect, it } from "vitest";
import { parseHomepageImageList } from "./homepageImageList.js";

describe("parseHomepageImageList", () => {
  it("parses URLs separated by commas or newlines", () => {
    expect(parseHomepageImageList("https://cdn.example/one.jpg, https://cdn.example/two.jpg\nhttps://cdn.example/three.jpg"))
      .toEqual([
        "https://cdn.example/one.jpg",
        "https://cdn.example/two.jpg",
        "https://cdn.example/three.jpg",
      ]);
  });

  it("preserves commas within a URL and recovers comma-joined stored entries", () => {
    expect(parseHomepageImageList(["https://cdn.example/image/upload/c_fill,w_800/photo.jpg,https://cdn.example/second.jpg"]))
      .toEqual([
        "https://cdn.example/image/upload/c_fill,w_800/photo.jpg",
        "https://cdn.example/second.jpg",
      ]);
  });
});

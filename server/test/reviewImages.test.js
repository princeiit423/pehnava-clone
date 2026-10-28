import test from "node:test";
import assert from "node:assert/strict";
import { detectReviewImageFormat, MAX_IMAGE_SIZE, uploadReviewImage } from "../services/reviewImages.js";

test("detects JPEG, PNG, and WebP review image signatures", () => {
  assert.equal(detectReviewImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(
    detectReviewImageFormat(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png"
  );
  assert.equal(
    detectReviewImageFormat(Buffer.from("RIFF0000WEBP", "ascii")),
    "image/webp"
  );
  assert.equal(detectReviewImageFormat(Buffer.from("not an image")), null);
});

test("rejects oversized review images before contacting Cloudinary", async () => {
  await assert.rejects(
    uploadReviewImage({
      buffer: Buffer.alloc(MAX_IMAGE_SIZE + 1),
      mimetype: "image/jpeg",
    }),
    (error) => error.status === 400 && /5 MB/.test(error.message)
  );
});

test("rejects file extensions or MIME types that do not match image content", async () => {
  await assert.rejects(
    uploadReviewImage({
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      mimetype: "image/png",
    }),
    (error) => error.status === 400 && /valid JPEG, PNG, or WebP/.test(error.message)
  );
});

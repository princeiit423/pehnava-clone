import { v2 as cloudinary } from "cloudinary";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function detectReviewImageFormat(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) return "image/png";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";
  return null;
}

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error("Cloudinary is not configured. Add its credentials to the server environment.");
    error.status = 503;
    throw error;
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export async function uploadReviewImage(file) {
  if (file.buffer.length > MAX_IMAGE_SIZE) {
    const error = new Error("Each review image must be 5 MB or smaller.");
    error.status = 400;
    throw error;
  }
  const detectedType = detectReviewImageFormat(file.buffer);
  if (!detectedType || detectedType !== file.mimetype || !IMAGE_TYPES.has(file.mimetype)) {
    const error = new Error("Review images must be valid JPEG, PNG, or WebP files.");
    error.status = 400;
    throw error;
  }

  const client = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      { folder: "pehnava/reviews", resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary returned an incomplete image upload response."));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(file.buffer);
  });
}

export async function deleteReviewImages(images = []) {
  if (!images.length) return;
  const client = getCloudinary();
  const results = await Promise.all(
    images.map(({ publicId }) => client.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    }))
  );
  if (results.some((result) => !["ok", "not found"].includes(result?.result))) {
    throw new Error("Cloudinary could not delete one or more review images.");
  }
}

export { IMAGE_TYPES, MAX_IMAGE_SIZE };

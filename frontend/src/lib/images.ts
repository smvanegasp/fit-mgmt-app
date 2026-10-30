/** Resize a photo on the device before upload: phone photos are 3–10 MB, these are ~100 KB. */
export async function resizeImage(file: Blob, maxSide: number, quality = 0.82): Promise<Blob> {
  // "from-image" applies the EXIF rotation, so portrait phone photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process photos");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process the photo"))),
      "image/jpeg",
      quality,
    ),
  );
}

export const PHOTO_SIDE = 1024;
export const THUMB_SIDE = 256;

/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * Phones produce 4-12 MB images at 4000px and more; a salon cover is shown at
 * most around 1600px wide. Resizing here makes the upload fast on a salon's
 * wifi, keeps the bucket small, and strips the camera's EXIF (location
 * included) because a canvas re-encode does not carry it over.
 *
 * Falls back to the original file if the browser cannot decode it.
 */
export async function prepareImage(file: File, maxSide: number): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

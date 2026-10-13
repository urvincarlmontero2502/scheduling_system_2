/**
 * Compress an image file to a max width/height while preserving aspect ratio.
 * Returns a Blob that can be appended to FormData.
 */
export const compressImage = (file, maxSize = 1200, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const { width, height } = img;
      let { width: newWidth, height: newHeight } = { width, height };

      if (width > height) {
        if (width > maxSize) {
          newWidth = maxSize;
          newHeight = (height * maxSize) / width;
        }
      } else {
        if (height > maxSize) {
          newHeight = maxSize;
          newWidth = (width * maxSize) / height;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          resolve(blob);
        },
        mimeType,
        quality
      );
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };

    img.src = objectUrl;
  });
};

/**
 * Compress an image and return a File for FormData appending.
 */
export const compressImageFile = async (file, maxSize = 1200, quality = 0.85) => {
  const blob = await compressImage(file, maxSize, quality);
  return new File([blob], file.name, {
    type: blob.type,
    lastModified: Date.now(),
  });
};

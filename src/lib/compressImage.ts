export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name);
}

export function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("La imagen tardó demasiado. Prueba un JPG o PNG."));
    }, 20_000);
    const done = (fn: () => void) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      fn();
    };
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        done(() => reject(new Error("No se pudo leer la imagen.")));
        return;
      }
      ctx.fillStyle = "#f7f5fb";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      done(() => resolve(canvas.toDataURL("image/jpeg", quality)));
    };
    img.onerror = () => {
      done(() =>
        reject(
          new Error(
            "No se pudo leer esa foto. Si es HEIC del iPhone, expórtala como JPG o PNG.",
          ),
        ),
      );
    };
    img.src = url;
  });
}

export async function compressImageBlob(
  file: File,
  maxSize = 1600,
  quality = 0.82,
): Promise<Blob> {
  const dataUrl = await compressImage(file, maxSize, quality);
  const res = await fetch(dataUrl);
  return res.blob();
}

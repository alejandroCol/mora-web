export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("La imagen tardó demasiado. Prueba un JPG o PNG."));
    }, 20_000);
    img.onload = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer esa foto. Prueba un JPG o PNG."));
    };
    img.src = url;
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through */
    }
  }
  return loadImage(file);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error("No se pudo optimizar la imagen."));
      },
      type,
      quality,
    );
  });
}

async function encodePhoto(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  try {
    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp.type === "image/webp" && webp.size > 0) return webp;
  } catch {
    /* Safari viejo u otro motor sin webp */
  }
  return canvasToBlob(canvas, "image/jpeg", Math.min(0.95, quality + 0.02));
}

export async function compressImageBlob(
  file: File,
  maxSize = 2560,
  quality = 0.92,
): Promise<Blob> {
  const source = await loadBitmap(file);
  const width = source.width;
  const height = source.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo leer la imagen.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fbfbfd";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  return encodePhoto(canvas, quality);
}

export async function compressImage(
  file: File,
  maxSize = 1600,
  quality = 0.82,
): Promise<string> {
  const blob = await compressImageBlob(file, maxSize, quality);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

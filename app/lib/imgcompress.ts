// Client-side image compressor for coin logos. Re-encodes to WebP,
// quality-first, landing under ~95 KB so the Irys upload stays on the FREE
// tier (no funding, just a wallet signature). We keep a generous 768px longest
// side and high quality, only easing quality then shrinking as a last resort,
// so even a big 2 MB photo comes out sharp but free. Non-image files pass
// through unchanged.

const FREE_LIMIT = 95_000; // bytes; stay under Irys' 100 KiB free threshold
const MAX_DIM = 768;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", q)
  );
}

/** Compress an image File to a small square-friendly WebP under the free tier. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  let img: HTMLImageElement;
  try { img = await loadImage(file); } catch { return file; }

  // Quality-first: hold resolution high and ease quality before shrinking.
  const dims = [MAX_DIM, 576, 448, 320];
  const qualities = [0.92, 0.86, 0.8, 0.72];
  let best: Blob | null = null;

  outer:
  for (const d of dims) {
    const scale = Math.min(1, d / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of qualities) {
      best = await toBlob(canvas, q);
      if (best.size <= FREE_LIMIT) break outer;
    }
  }

  if (!best) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([best], name, { type: "image/webp" });
}

export const IMG_FREE_LIMIT = FREE_LIMIT;

/* Shrinking a picture in the browser, before it goes up.

   The ceiling is a megabyte and a phone photograph is several, so without
   this every camera roll picture is a refusal. Downscaling first is what
   does the real work: the round draws the picture at 460 CSS pixels, so
   1400 on the longest side is retina and everything past it is detail
   nobody will ever see. The quality ladder only exists for what is still
   over after that.

   Encoding starts high on purpose. The backend re-encodes what it stores
   at quality 72, so this pass is not the final one, and squeezing hard
   here would mean two lossy passes stacked on the same pixels. The job
   here is only to get under the wire limit.
*/

import { MAX_PICTURE_BYTES } from "@/lib/owned";

/* In step with `MAX_SIDE` in backend/apps/topics/pictures.py, so the
   browser hands up the same picture the backend would have made anyway
   and the resize happens once rather than twice. */
export const MAX_SIDE = 1400;

/* Tried in order, stopping at the first that fits. 0.9 is where most
   photographs land and is visually indistinguishable at this size; 0.6 is
   the floor, below which the artefacts start showing on skin and sky. */
const QUALITIES = [0.9, 0.8, 0.7, 0.6];

/** The size to draw at: never larger than `max` on the longest side, and
    never larger than the picture already is, because upscaling would add
    bytes and no detail. */
export function fit(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** A picture ready to upload, or null when no amount of squeezing gets it
    under the ceiling and the caller should say so.

    A file that already fits and is already small enough on the side comes
    back untouched: re-encoding one that needs nothing only loses pixels.
    Anything the browser cannot decode comes back untouched too, so the
    backend stays the one that decides what is and is not an image. */
export async function compress(file: File): Promise<File | null> {
  const fits = file.size <= MAX_PICTURE_BYTES;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return fits ? file : null;
  }

  const size = fit(bitmap.width, bitmap.height, MAX_SIDE);
  if (fits && size.width === bitmap.width && size.height === bitmap.height) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return fits ? file : null;
  }
  /* Onto white, not onto nothing: a PNG with transparency drawn on an
     empty canvas keeps its alpha, and WebP would carry the hole through
     to a round that draws it on the page's own background. The backend
     flattens for the same reason. */
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    /* A browser without a WebP encoder answers with a PNG, which can come
       out larger than the file we started with. The size check below
       catches that on its own, and the last rung falls through to null. */
    if (blob && blob.size <= MAX_PICTURE_BYTES) {
      return new File([blob], renamed(file.name), { type: blob.type });
    }
  }
  return null;
}

function renamed(name: string): string {
  const stem = name.replace(/\.[^./\\]+$/, "") || "picture";
  return `${stem}.webp`;
}

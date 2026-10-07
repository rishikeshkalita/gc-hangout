import { GC_HANGOUT_PHOTO_DATA_URL } from "../../../lib/gc-hangout-photo.mjs";

export const dynamic = "force-static";

export function GET() {
  const [, encoded] = GC_HANGOUT_PHOTO_DATA_URL.split(",", 2);
  const body = Buffer.from(encoded, "base64");

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/jpeg",
    },
  });
}

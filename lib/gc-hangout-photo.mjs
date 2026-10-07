import { GC_HANGOUT_PHOTO_CHUNK_1 } from "./gc-hangout-photo-01.mjs";
import { GC_HANGOUT_PHOTO_CHUNK_2 } from "./gc-hangout-photo-02.mjs";
import { GC_HANGOUT_PHOTO_CHUNK_3 } from "./gc-hangout-photo-03.mjs";
import { GC_HANGOUT_PHOTO_CHUNK_4 } from "./gc-hangout-photo-04.mjs";
import { GC_HANGOUT_PHOTO_CHUNK_5 } from "./gc-hangout-photo-05.mjs";
import { GC_HANGOUT_PHOTO_CHUNK_6 } from "./gc-hangout-photo-06.mjs";
import { GC_HANGOUT_PHOTO_CHUNK_7 } from "./gc-hangout-photo-07.mjs";

export const GC_HANGOUT_PHOTO_DATA_URL = "data:image/jpeg;base64," +
  GC_HANGOUT_PHOTO_CHUNK_1 +
  GC_HANGOUT_PHOTO_CHUNK_2 +
  GC_HANGOUT_PHOTO_CHUNK_3 +
  GC_HANGOUT_PHOTO_CHUNK_4 +
  GC_HANGOUT_PHOTO_CHUNK_5 +
  GC_HANGOUT_PHOTO_CHUNK_6 +
  GC_HANGOUT_PHOTO_CHUNK_7;

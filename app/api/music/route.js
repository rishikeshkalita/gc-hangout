import { NextResponse } from "next/server";
import { parseYouTubeDuration } from "../../../lib/social-state.mjs";

const CACHE_SECONDS = 300;

function clean(value, max = 100) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}

export async function GET(request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const query = clean(request.nextUrl.searchParams.get("search") || "", 80);
  if (!apiKey) {
    return NextResponse.json({ configured: false, tracks: [], error: "YouTube search is not configured. Set YOUTUBE_API_KEY on the server." }, { status: 503 });
  }
  if (query.length < 2) {
    return NextResponse.json({ configured: true, tracks: [], error: "Search for at least 2 characters." }, { status: 400 });
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("videoSyndicated", "true");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("q", query);

  try {
    const response = await fetch(url, { next: { revalidate: CACHE_SECONDS } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ configured: true, tracks: [], error: data?.error?.message || "YouTube search failed." }, { status: response.status });
    }

    const ids = (Array.isArray(data.items) ? data.items : [])
      .map((item) => String(item?.id?.videoId || ""))
      .filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id));

    if (!ids.length) return NextResponse.json({ configured: true, tracks: [] });

    const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailUrl.searchParams.set("key", apiKey);
    detailUrl.searchParams.set("part", "contentDetails,status");
    detailUrl.searchParams.set("id", ids.join(","));
    const detailResponse = await fetch(detailUrl, { next: { revalidate: CACHE_SECONDS } });
    const detailData = await detailResponse.json().catch(() => ({}));
    if (!detailResponse.ok) {
      return NextResponse.json({ configured: true, tracks: [], error: detailData?.error?.message || "Could not verify YouTube videos." }, { status: detailResponse.status });
    }

    const details = new Map((Array.isArray(detailData.items) ? detailData.items : []).map((item) => [item.id, item]));
    const tracks = (Array.isArray(data.items) ? data.items : []).map((item) => {
      const videoId = String(item?.id?.videoId || "");
      const detail = details.get(videoId);
      if (!detail || detail.status?.embeddable === false || detail.status?.madeForKids === true) return null;
      return {
        id: `yt-${videoId}`,
        videoId,
        title: clean(item?.snippet?.title || "YouTube video"),
        artist: clean(item?.snippet?.channelTitle || "YouTube"),
        channelTitle: clean(item?.snippet?.channelTitle || "YouTube"),
        album: "YouTube",
        duration: parseYouTubeDuration(detail?.contentDetails?.duration),
        thumbnail: String(item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
      };
    }).filter(Boolean);

    return NextResponse.json({ configured: true, tracks });
  } catch (error) {
    console.error("YouTube search failed", error);
    return NextResponse.json({ configured: true, tracks: [], error: "YouTube search is temporarily unavailable." }, { status: 502 });
  }
}

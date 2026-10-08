import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response(JSON.stringify({ error: "Supabase service configuration missing" }), { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();

  const { data: stateBefore } = await admin.from("gc_music_state").select("*").eq("room_id", "main").maybeSingle();
  const { data: expired, error } = await admin
    .from("gc_music_tracks")
    .select("id,storage_path")
    .lte("expires_at", now)
    .in("status", ["uploading", "ready"]);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const rows = expired || [];
  const expiredIds = rows.map((row) => row.id);
  const currentExpired = Boolean(stateBefore?.current_track_id && expiredIds.includes(stateBefore.current_track_id));
  const paths = rows.map((row) => row.storage_path).filter(Boolean);

  if (paths.length) await admin.storage.from("gc-music").remove(paths);
  if (expiredIds.length) {
    await admin.from("gc_music_queue").delete().in("track_id", expiredIds);
    await admin.from("gc_music_votes").delete().in("track_id", expiredIds);
    await admin.from("gc_music_tracks").delete().in("id", expiredIds);
  }

  if (currentExpired) {
    const { data: next } = await admin
      .from("gc_music_queue")
      .select("track_id,gc_music_tracks!inner(status,expires_at)")
      .eq("room_id", "main")
      .eq("gc_music_tracks.status", "ready")
      .gt("gc_music_tracks.expires_at", now)
      .order("queue_position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next?.track_id) {
      await admin.from("gc_music_queue").delete().eq("room_id", "main").eq("track_id", next.track_id);
      await admin.from("gc_music_state").update({
        current_track_id: next.track_id,
        status: "playing",
        position: 0,
        started_at: new Date().toISOString(),
        revision: Number(stateBefore?.revision || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("room_id", "main");
    } else {
      await admin.from("gc_music_state").update({
        current_track_id: null,
        status: "stopped",
        position: 0,
        started_at: null,
        revision: Number(stateBefore?.revision || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("room_id", "main");
    }
  }

  await admin.from("gc_room_sessions").delete().lt("last_seen", new Date(Date.now() - 20000).toISOString());

  return new Response(JSON.stringify({ ok: true, deleted: expiredIds.length, advanced: currentExpired }), {
    headers: { "content-type": "application/json" },
  });
});

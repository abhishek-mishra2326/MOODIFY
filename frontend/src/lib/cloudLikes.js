
import { supabase } from "./supabase";

const TABLE_NAME = "user_likes";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=500";

// Convert Supabase row into MOODIFY track
function databaseToTrack(row) {
  return {
    id: String(row.track_id),
    name: row.title,
    artist: row.artist || "Unknown Artist",
    image: row.album_image || DEFAULT_IMAGE,
    audio: row.audio_url,
    duration: Number(row.duration) || 0,
    licenseName: row.license || "Creative Commons",
    licenseUrl: "",
    shareUrl: "",
    album: "Single"
  };
}

// Load logged-in user's liked songs
export async function fetchCloudLikes(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(databaseToTrack);
}

// Add a song to user_likes
export async function addCloudLike(userId, track) {
  if (!userId || !track) {
    throw new Error("User or track information is missing.");
  }

  const row = {
    user_id: userId,
    track_id: String(track.id),
    title: track.name,
    artist: track.artist || "",
    album_image: track.image || DEFAULT_IMAGE,
    audio_url: track.audio,
    duration: Math.round(Number(track.duration) || 0),
    license: track.licenseName || "Creative Commons"
  };

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(row, {
      onConflict: "user_id,track_id"
    });

  if (error) throw error;

  return true;
}

// Remove a song from user_likes
export async function removeCloudLike(userId, trackId) {
  if (!userId || !trackId) {
    throw new Error("User or track ID is missing.");
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("user_id", userId)
    .eq("track_id", String(trackId));

  if (error) throw error;

  return true;
}

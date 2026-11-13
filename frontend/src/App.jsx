
import { useEffect, useRef, useState } from "react";
import {
  Home, Search, Library, Plus, Heart, Play, Pause,
  SkipBack, SkipForward, Shuffle, Repeat, Volume2,
  ListMusic, Maximize2, MoreHorizontal, ChevronLeft,
  ChevronRight, ChevronDown, Music2, Disc3, X,
  Trash2, Check, LoaderCircle, ExternalLink, LogOut
} from "lucide-react";

import Auth from "./components/Auth";
import { supabase } from "./lib/supabase";
import {
  fetchCloudLikes,
  addCloudLike,
  removeCloudLike
} from "./lib/cloudLikes";

import "./index.css";

/* =========================================
   MOODIFY CONFIGURATION
========================================= */

const CLIENT_ID = import.meta.env.VITE_JAMENDO_CLIENT_ID;

const STORAGE_KEYS = {
  recent: "moodify_recent_tracks_v1"
};

const QUICK_MIXES = [
  {
    name: "Chill",
    tag: "chill",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400"
  },
  {
    name: "Electronic",
    tag: "electronic",
    image: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=400"
  },
  {
    name: "Acoustic",
    tag: "acoustic",
    image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400"
  },
  {
    name: "Jazz",
    tag: "jazz",
    image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400"
  }
];

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=500";

/* =========================================
   STORAGE HELPERS
========================================= */

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("MOODIFY storage error:", error);
  }
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function getLicenseName(url = "") {
  const value = url.toLowerCase();

  if (value.includes("publicdomain/zero")) return "CC0";
  if (value.includes("/by-sa/")) return "CC BY-SA";
  if (value.includes("/by/")) return "CC BY";

  return "Creative Commons";
}

function isAllowedLicense(url = "") {
  const value = url.toLowerCase();

  return (
    /creativecommons\.org\/licenses\/by(-sa)?\//.test(value) ||
    value.includes("creativecommons.org/publicdomain/zero")
  );
}

/* =========================================
   JAMENDO API
========================================= */

async function getTracks(query = "", signal) {
  if (!CLIENT_ID) {
    throw new Error(
      "Jamendo Client ID is missing in your .env file."
    );
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    format: "json",
    limit: "30",
    imagesize: "300",
    audioformat: "mp32",
    include: "licenses",
    type: "single albumtrack",
    ccnc: "false",
    ccnd: "false"
  });

  if (query.trim()) {
    params.set("search", query.trim());
  } else {
    params.set("order", "popularity_month");
  }

  const response = await fetch(
    `https://api.jamendo.com/v3.0/tracks/?${params}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error("Unable to connect to Jamendo.");
  }

  const result = await response.json();

  if (result.headers?.status !== "success") {
    throw new Error(
      result.headers?.error_message ||
      "Jamendo API request failed."
    );
  }

  return (result.results || [])
    .filter(track =>
      track.audio &&
      track.name &&
      track.artist_name &&
      isAllowedLicense(track.license_ccurl)
    )
    .map(track => ({
      id: String(track.id),
      name: track.name,
      artist: track.artist_name,
      image: track.image || track.album_image || DEFAULT_IMAGE,
      audio: track.audio,
      duration: Number(track.duration) || 0,
      licenseUrl: track.license_ccurl || "",
      licenseName: getLicenseName(track.license_ccurl),
      shareUrl: track.shareurl || "",
      album: track.album_name || "Single"
    }));
}

/* =========================================
   PLAYLIST DATABASE HELPERS
========================================= */

function databaseTrackToAppTrack(row) {
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

function appTrackToDatabaseTrack(track, playlistId) {
  return {
    playlist_id: playlistId,
    track_id: String(track.id),
    title: track.name,
    artist: track.artist || "",
    album_image: track.image || DEFAULT_IMAGE,
    audio_url: track.audio,
    duration: Math.round(Number(track.duration) || 0),
    license: track.licenseName || "Creative Commons"
  };
}

/* =========================================
   MAIN APP
========================================= */

export default function App() {
  const audioRef = useRef(null);

  /* =========================================
     AUTHENTICATION
  ========================================= */

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Session error:", error.message);
      }

      setUser(data?.session?.user ?? null);
      setAuthLoading(false);
    }

    checkSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =========================================
     NAVIGATION
  ========================================= */

  const [activeNav, setActiveNav] = useState("Home");
  const [search, setSearch] = useState("");

  /* =========================================
     MUSIC
  ========================================= */

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  /* =========================================
     CLOUD LIKED SONGS
  ========================================= */

  const [likedTracks, setLikedTracks] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likeBusy, setLikeBusy] = useState({});

  /* =========================================
     CLOUD PLAYLISTS
  ========================================= */

  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState("");

  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null);

  /* =========================================
     RECENTLY PLAYED
  ========================================= */

  const [recentTracks, setRecentTracks] = useState(() =>
    readStorage(STORAGE_KEYS.recent, [])
  );

  /* =========================================
     NOTIFICATIONS
  ========================================= */

  const [toast, setToast] = useState("");

  function showToast(message) {
    setToast(message);
  }

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 2600);

    return () => clearTimeout(timer);
  }, [toast]);

  /* =========================================
     SAVE RECENTLY PLAYED
========================================= */

  useEffect(() => {
    saveStorage(STORAGE_KEYS.recent, recentTracks);
  }, [recentTracks]);

  /* =========================================
     LOAD CLOUD LIKED SONGS
========================================= */

  useEffect(() => {
    if (!user?.id) {
      setLikedTracks([]);
      setLikesLoading(false);
      return;
    }

    let cancelled = false;

    async function loadLikedSongs() {
      setLikesLoading(true);

      try {
        const data = await fetchCloudLikes(user.id);

        if (!cancelled) {
          setLikedTracks(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Cloud likes loading error:", error);
          showToast(
            error.message || "Unable to load your liked songs."
          );
        }
      } finally {
        if (!cancelled) {
          setLikesLoading(false);
        }
      }
    }

    loadLikedSongs();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /* =========================================
     LOAD CLOUD PLAYLISTS
========================================= */

  useEffect(() => {
    if (!user?.id) {
      setPlaylists([]);
      setPlaylistsLoading(false);
      setPlaylistError("");
      return;
    }

    let cancelled = false;

    async function loadCloudPlaylists() {
      setPlaylistsLoading(true);
      setPlaylistError("");

      try {
        const {
          data: playlistRows,
          error: playlistFetchError
        } = await supabase
          .from("playlists")
          .select("*")
          .order("created_at", { ascending: false });

        if (playlistFetchError) {
          throw playlistFetchError;
        }

        const rows = playlistRows || [];
        let trackRows = [];

        if (rows.length > 0) {
          const playlistIds = rows.map(item => item.id);

          const {
            data,
            error: tracksFetchError
          } = await supabase
            .from("playlist_tracks")
            .select("*")
            .in("playlist_id", playlistIds)
            .order("position", { ascending: true });

          if (tracksFetchError) {
            throw tracksFetchError;
          }

          trackRows = data || [];
        }

        if (cancelled) return;

        const updatedPlaylists = rows.map(playlist => {
          const playlistTracks = trackRows
            .filter(track => track.playlist_id === playlist.id)
            .map(databaseTrackToAppTrack);

          return {
            id: playlist.id,
            name: playlist.name,
            description: playlist.description || "",
            createdAt: playlist.created_at,
            tracks: playlistTracks
          };
        });

        setPlaylists(updatedPlaylists);
      } catch (error) {
        if (!cancelled) {
          console.error("Playlist loading error:", error);
          setPlaylistError(
            error.message || "Unable to load your playlists."
          );
        }
      } finally {
        if (!cancelled) {
          setPlaylistsLoading(false);
        }
      }
    }

    loadCloudPlaylists();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /* =========================================
     FETCH MUSIC
========================================= */

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setApiError("");

      try {
        const data = await getTracks(
          activeNav === "Search" ? search : "",
          controller.signal
        );

        setTracks(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          setApiError(error.message);
          setTracks([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, activeNav === "Search" ? 400 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeNav, search]);

  /* =========================================
     PLAYER
========================================= */

  const [activeTrack, setActiveTrack] = useState(null);
  const [playQueue, setPlayQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);

  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  /* =========================================
     LOGOUT
========================================= */

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      showToast(error.message);
      return;
    }

    setUser(null);
    setPlaylists([]);
    setLikedTracks([]);
    setSelectedPlaylist(null);
    setActiveTrack(null);
    setPlayQueue([]);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    showToast("Logged out successfully");
  }

  /* =========================================
     AUDIO ENGINE
========================================= */

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !activeTrack) return;

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
        setPlaybackError(
          "Unable to play this track. Try another song."
        );
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, activeTrack]);

  /* =========================================
     RECENTLY PLAYED
========================================= */

  function recordRecentlyPlayed(track) {
    if (!track) return;

    setRecentTracks(current => {
      const updated = [
        track,
        ...current.filter(item => item.id !== track.id)
      ];

      return updated.slice(0, 12);
    });
  }

  /* =========================================
     PLAYBACK QUEUE
========================================= */

  function getQueueIndex() {
    return playQueue.findIndex(
      track => String(track.id) === String(activeTrack?.id)
    );
  }

  /* =========================================
     PLAYBACK CONTROLS
========================================= */

  function playTrack(track, queue = tracks) {
    if (!track?.audio) return;

    const validQueue = queue?.length ? queue : [track];

    setPlaybackError("");
    setPlayQueue(validQueue);

    if (
      String(activeTrack?.id) === String(track.id) &&
      audioRef.current
    ) {
      audioRef.current.currentTime = 0;

      audioRef.current.play().catch(() => {
        setIsPlaying(false);
        setPlaybackError(
          "Unable to play this track. Try another song."
        );
      });

      setCurrentTime(0);
      setDuration(track.duration || 0);
      setIsPlaying(true);

      recordRecentlyPlayed(track);
      return;
    }

    setActiveTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    setIsPlaying(true);

    recordRecentlyPlayed(track);
  }

  function togglePlay() {
    if (!activeTrack) {
      if (tracks.length) {
        playTrack(tracks[0], tracks);
      }

      return;
    }

    setIsPlaying(value => !value);
  }

  function nextTrack() {
    if (!playQueue.length) return;

    const index = getQueueIndex();

    if (index === -1) {
      playTrack(playQueue[0], playQueue);
      return;
    }

    let nextIndex;

    if (isShuffle && playQueue.length > 1) {
      const candidates = playQueue
        .map((_, i) => i)
        .filter(i => i !== index);

      nextIndex =
        candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      nextIndex = (index + 1) % playQueue.length;
    }

    playTrack(playQueue[nextIndex], playQueue);
  }

  function previousTrack() {
    if (
      audioRef.current &&
      audioRef.current.currentTime > 3
    ) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (!playQueue.length) return;

    const index = getQueueIndex();

    const previousIndex =
      index <= 0
        ? playQueue.length - 1
        : index - 1;

    playTrack(playQueue[previousIndex], playQueue);
  }

  function handleEnded() {
    if (repeatMode === "one") {
      const audio = audioRef.current;

      if (audio) {
        audio.currentTime = 0;

        audio.play().catch(() => {
          setIsPlaying(false);
          setPlaybackError("Unable to replay this track.");
        });
      }

      return;
    }

    const index = getQueueIndex();

    if (index === -1) {
      setIsPlaying(false);
      return;
    }

    const isLastTrack = index === playQueue.length - 1;

    if (repeatMode === "all" || !isLastTrack) {
      nextTrack();
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }

  function toggleRepeat() {
    setRepeatMode(mode => {
      if (mode === "off") return "all";
      if (mode === "all") return "one";
      return "off";
    });
  }

  /* =========================================
     CLOUD LIKED SONG FUNCTIONS
========================================= */

  function isLiked(trackId) {
    return likedTracks.some(
      track => String(track.id) === String(trackId)
    );
  }

  async function toggleLike(track) {
    if (!track || !user?.id) {
      showToast("Please log in to save liked songs.");
      return;
    }

    const trackId = String(track.id);

    if (likeBusy[trackId]) return;

    const exists = isLiked(trackId);

    setLikeBusy(current => ({
      ...current,
      [trackId]: true
    }));

    try {
      if (exists) {
        await removeCloudLike(user.id, trackId);

        setLikedTracks(current =>
          current.filter(
            item => String(item.id) !== trackId
          )
        );

        showToast("Removed from Liked Songs");
      } else {
        await addCloudLike(user.id, track);

        setLikedTracks(current => {
          const alreadyExists = current.some(
            item => String(item.id) === trackId
          );

          if (alreadyExists) return current;

          return [track, ...current];
        });

        showToast("Added to Liked Songs");
      }
    } catch (error) {
      console.error("Cloud like error:", error);

      showToast(
        error.message || "Unable to update Liked Songs."
      );
    } finally {
      setLikeBusy(current => ({
        ...current,
        [trackId]: false
      }));
    }
  }

  /* =========================================
     CREATE CLOUD PLAYLIST
========================================= */

  async function createPlaylist() {
    const name = newPlaylistName.trim();

    if (!name || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from("playlists")
        .insert({
          user_id: user.id,
          name,
          description: ""
        })
        .select()
        .single();

      if (error) throw error;

      const playlist = {
        id: data.id,
        name: data.name,
        description: data.description || "",
        createdAt: data.created_at,
        tracks: []
      };

      setPlaylists(current => [
        playlist,
        ...current
      ]);

      setNewPlaylistName("");
      setShowCreateModal(false);
      setSelectedPlaylist(playlist.id);
      setActiveNav("Library");

      showToast(`Playlist "${name}" created in cloud`);
    } catch (error) {
      console.error("Create playlist error:", error);
      showToast(error.message || "Unable to create playlist");
    }
  }

  /* =========================================
     ADD TRACK TO CLOUD PLAYLIST
========================================= */

  async function addTrackToPlaylist(playlistId, track) {
    const playlist = playlists.find(
      item => item.id === playlistId
    );

    if (!playlist || !track || !user?.id) return;

    const alreadyAdded = playlist.tracks.some(
      item => String(item.id) === String(track.id)
    );

    if (alreadyAdded) {
      showToast("Song is already in this playlist");
      return;
    }

    try {
      const row = appTrackToDatabaseTrack(track, playlistId);

      row.position = playlist.tracks.length;

      const { error } = await supabase
        .from("playlist_tracks")
        .insert(row);

      if (error) throw error;

      setPlaylists(current =>
        current.map(item =>
          item.id === playlistId
            ? {
                ...item,
                tracks: [...item.tracks, track]
              }
            : item
        )
      );

      setAddToPlaylistTrack(null);

      showToast(`Added to "${playlist.name}"`);
    } catch (error) {
      console.error("Add track error:", error);
      showToast(error.message || "Unable to add song");
    }
  }

  /* =========================================
     REMOVE TRACK FROM CLOUD PLAYLIST
========================================= */

  async function removeTrackFromPlaylist(playlistId, trackId) {
    try {
      const { error } = await supabase
        .from("playlist_tracks")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("track_id", String(trackId));

      if (error) throw error;

      setPlaylists(current =>
        current.map(playlist =>
          playlist.id === playlistId
            ? {
                ...playlist,
                tracks: playlist.tracks.filter(
                  track => String(track.id) !== String(trackId)
                )
              }
            : playlist
        )
      );

      showToast("Song removed from playlist");
    } catch (error) {
      console.error("Remove track error:", error);
      showToast(error.message || "Unable to remove song");
    }
  }

  /* =========================================
     DELETE CLOUD PLAYLIST
========================================= */

  async function deletePlaylist(playlistId) {
    const playlist = playlists.find(
      item => item.id === playlistId
    );

    if (!playlist) return;

    const confirmed = window.confirm(
      `Delete "${playlist.name}" playlist?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("playlists")
        .delete()
        .eq("id", playlistId);

      if (error) throw error;

      setPlaylists(current =>
        current.filter(item => item.id !== playlistId)
      );

      if (selectedPlaylist === playlistId) {
        setSelectedPlaylist(null);
      }

      showToast(`"${playlist.name}" deleted`);
    } catch (error) {
      console.error("Delete playlist error:", error);
      showToast(error.message || "Unable to delete playlist");
    }
  }

  /* =========================================
     HELPERS
========================================= */

  function openMood(mood) {
    setSearch(mood);
    setActiveNav("Search");
  }

  function getSelectedPlaylist() {
    return playlists.find(
      playlist => playlist.id === selectedPlaylist
    );
  }

  function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";

    return "Good evening";
  }

  /* =========================================
     TRACK CARD
========================================= */

  function TrackCard({ track, queue = tracks }) {
    const liked = isLiked(track.id);

    return (
      <div className="album-card moodify-track-card">
        <button
          className="track-card-main"
          onClick={() => playTrack(track, queue)}
        >
          <div className="album-art">
            <img
              src={track.image}
              alt={track.name}
              loading="lazy"
            />

            <span className="card-play">
              <Play size={20} fill="black" />
            </span>
          </div>

          <strong>{track.name}</strong>
          <p>{track.artist}</p>
        </button>

        <div className="track-card-actions">
          <button
            className={liked ? "liked" : ""}
            onClick={() => toggleLike(track)}
            title="Like song"
            aria-label="Like song"
            disabled={!!likeBusy[String(track.id)]}
          >
            <Heart
              size={17}
              fill={liked ? "#A78BFA" : "none"}
            />
          </button>

          <button
            onClick={() => setAddToPlaylistTrack(track)}
            title="Add to playlist"
            aria-label="Add to playlist"
          >
            <Plus size={18} />
          </button>
        </div>

        <span className="track-license">
          {track.licenseName} · Jamendo
        </span>
      </div>
    );
  }

  /* =========================================
     TRACK LIST
========================================= */

  function TrackList({ items, playlistId }) {
    if (!items.length) {
      return (
        <div className="library-placeholder">
          <Music2 size={42} />
          <h3>No songs here yet</h3>
          <p>
            Discover music and add your favourite songs.
          </p>

          <button onClick={() => setActiveNav("Search")}>
            Discover Music
          </button>
        </div>
      );
    }

    return (
      <div className="moodify-track-list">
        {items.map((track, index) => {
          const liked = isLiked(track.id);

          return (
            <div
              className="moodify-track-row"
              key={track.id}
            >
              <span className="track-number">
                {index + 1}
              </span>

              <img
                src={track.image}
                alt=""
                loading="lazy"
                onClick={() => playTrack(track, items)}
              />

              <button
                className="track-row-title"
                onClick={() => playTrack(track, items)}
              >
                <strong>{track.name}</strong>
                <span>{track.artist}</span>
              </button>

              <button
                className={liked ? "liked" : ""}
                onClick={() => toggleLike(track)}
                aria-label="Like song"
                disabled={!!likeBusy[String(track.id)]}
              >
                <Heart
                  size={18}
                  fill={liked ? "#A78BFA" : "none"}
                />
              </button>

              {playlistId && (
                <button
                  onClick={() =>
                    removeTrackFromPlaylist(
                      playlistId,
                      track.id
                    )
                  }
                  aria-label="Remove song"
                >
                  <Trash2 size={17} />
                </button>
              )}

              <span className="track-duration">
                {formatTime(track.duration)}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  /* =========================================
     AUTH LOADING
========================================= */

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#090D0B] flex flex-col items-center justify-center gap-4 text-white">
        <Music2 size={42} className="text-[#1ED760]" />
        <p>Loading MOODIFY...</p>
      </div>
    );
  }

  /* =========================================
     LOGIN / SIGNUP SCREEN
========================================= */

  if (!user) {
    return <Auth onAuthSuccess={setUser} />;
  }

  /* =========================================
     MAIN RENDER
========================================= */

  return (
    <div className="app-shell">

      {/* AUDIO ELEMENT */}

      <audio
        ref={audioRef}
        src={activeTrack?.audio || undefined}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          const audio = audioRef.current;

          if (audio && Number.isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        }}
        onEnded={handleEnded}
        onError={() => {
          if (activeTrack) {
            setIsPlaying(false);

            setPlaybackError(
              "This track is unavailable. Try another."
            );
          }
        }}
      />

      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon moodify-logo">
            M<span>♫</span>
          </div>

          <span>MOODIFY</span>
        </div>

        <nav className="main-navigation">
          <button
            className={
              activeNav === "Home"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() => {
              setActiveNav("Home");
              setSelectedPlaylist(null);
            }}
          >
            <Home size={21} />
            Home
          </button>

          <button
            className={
              activeNav === "Search"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() => {
              setActiveNav("Search");
              setSelectedPlaylist(null);
            }}
          >
            <Search size={21} />
            Search
          </button>

          <button
            className={
              activeNav === "Library"
                ? "nav-link active"
                : "nav-link"
            }
            onClick={() => setActiveNav("Library")}
          >
            <Library size={21} />
            Your Library
          </button>
        </nav>

        <div className="sidebar-actions">
          <button
            className="create-button"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} />
            Create Playlist
          </button>

          <button
            className="liked-button"
            onClick={() => {
              setActiveNav("Library");
              setSelectedPlaylist("liked");
            }}
          >
            <span className="liked-icon">
              <Heart size={17} fill="white" />
            </span>
            Liked Songs
          </button>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-playlists">
          <p>Your playlists</p>

          {playlistsLoading && (
            <span className="sidebar-empty">
              Loading playlists...
            </span>
          )}

          {playlists.map(playlist => (
            <button
              key={playlist.id}
              onClick={() => {
                setActiveNav("Library");
                setSelectedPlaylist(playlist.id);
              }}
            >
              {playlist.name}
            </button>
          ))}

          {!playlistsLoading && playlists.length === 0 && (
            <span className="sidebar-empty">
              Your playlists appear here.
            </span>
          )}
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">
            {(user.email?.[0] || "U").toUpperCase()}
          </div>

          <div className="profile-user-details">
            <strong>
              {user.user_metadata?.full_name || "Music Lover"}
            </strong>
            <span>{user.email}</span>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">
        <header className="topbar">
          <div className="history-buttons">
            <button onClick={() => setActiveNav("Home")}>
              <ChevronLeft size={20} />
            </button>

            <button onClick={() => setActiveNav("Search")}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="topbar-actions">
            <div className="user-avatar">
              {(user.email?.[0] || "U").toUpperCase()}
            </div>
          </div>
        </header>

        <div className="dashboard">

          {/* HOME PAGE */}

          {activeNav === "Home" && (
            <>
              <section className="greeting-section">
                <p className="greeting-label">
                  WELCOME TO MOODIFY
                </p>

                <h1>{getGreeting()}</h1>

                <p className="greeting-subtitle">
                  Your music. Your mood. Your world.
                </p>
              </section>

              {/* QUICK MOODS */}

              <section className="quick-grid">
                {QUICK_MIXES.map(mix => (
                  <button
                    className="quick-card"
                    key={mix.name}
                    onClick={() => openMood(mix.tag)}
                  >
                    <img src={mix.image} alt="" />
                    <span>{mix.name}</span>

                    <span className="quick-play">
                      <Play size={19} fill="black" />
                    </span>
                  </button>
                ))}
              </section>

              {/* FEATURED MUSIC */}

              <section className="featured-music-banner">
                {tracks.length > 0 ? (
                  <>
                    <div className="featured-banner-content">
                      <span className="featured-label">
                        <Disc3 size={15} />
                        MOODIFY FEATURED
                      </span>

                      <h2>Discover Your Next Favourite</h2>

                      <p>
                        Explore independent artists, fresh sounds
                        and music that matches your mood.
                      </p>

                      <button
                        className="featured-play-button"
                        onClick={() => playTrack(tracks[0], tracks)}
                      >
                        <Play size={18} fill="black" />
                        Play Featured Track
                      </button>
                    </div>

                    <div className="featured-banner-art">
                      <img
                        src={tracks[0].image}
                        alt={tracks[0].name}
                      />

                      <div className="featured-banner-track">
                        <strong>{tracks[0].name}</strong>
                        <span>{tracks[0].artist}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="featured-banner-loading">
                    <span>MOODIFY FEATURED</span>
                    <h2>Your next favourite is waiting.</h2>
                    <p>Loading music discovery...</p>
                  </div>
                )}
              </section>

              {/* RECENTLY PLAYED */}

              {recentTracks.length > 0 && (
                <section className="content-section recently-played-section">
                  <div className="section-heading">
                    <div>
                      <h2>Recently Played</h2>
                      <p>
                        Pick up where your music journey left off.
                      </p>
                    </div>
                  </div>

                  <div className="album-grid">
                    {recentTracks.slice(0, 6).map(track => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        queue={recentTracks}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* DISCOVER MUSIC */}

              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h2>Discover Music</h2>
                    <p>
                      Discover independent artists and new sounds.
                    </p>
                  </div>

                  <button
                    className="show-all"
                    onClick={() => setActiveNav("Search")}
                  >
                    Explore
                  </button>
                </div>

                {loading && (
                  <p className="api-message">
                    <LoaderCircle size={17} />
                    Loading music...
                  </p>
                )}

                {apiError && (
                  <p className="api-error">{apiError}</p>
                )}

                <div className="album-grid">
                  {tracks.slice(0, 8).map(track => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      queue={tracks}
                    />
                  ))}
                </div>
              </section>

              {/* TRENDING MUSIC */}

              {tracks.length > 8 && (
                <section className="content-section trending-section">
                  <div className="section-heading">
                    <div>
                      <h2>Trending On MOODIFY</h2>
                      <p>
                        More independent sounds worth discovering.
                      </p>
                    </div>
                  </div>

                  <div className="album-grid">
                    {tracks.slice(8, 16).map(track => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        queue={tracks}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* MADE FOR YOUR MOOD */}

              <section className="content-section">
                <div className="section-heading">
                  <div>
                    <h2>Made For Your Mood</h2>
                    <p>Choose a mood to discover music.</p>
                  </div>
                </div>

                <div className="mix-grid">
                  {QUICK_MIXES.map(mix => (
                    <button
                      className="mix-card"
                      key={mix.name}
                      onClick={() => openMood(mix.tag)}
                    >
                      <img src={mix.image} alt="" />
                      <strong>{mix.name}</strong>
                      <p>Explore {mix.name} music</p>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* SEARCH PAGE */}

          {activeNav === "Search" && (
            <section className="search-page">
              <h1>Search Music</h1>

              <div className="search-box">
                <Search size={21} />

                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search songs, artists or moods..."
                />
              </div>

              {loading && (
                <p className="api-message">
                  <LoaderCircle size={17} />
                  Searching...
                </p>
              )}

              {apiError && (
                <p className="api-error">{apiError}</p>
              )}

              {!loading && !apiError && tracks.length === 0 && (
                <p className="empty-message">
                  No music found. Try another search.
                </p>
              )}

              <div className="album-grid">
                {tracks.map(track => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    queue={tracks}
                  />
                ))}
              </div>
            </section>
          )}

          {/* LIBRARY PAGE */}

          {activeNav === "Library" && (
            <section className="library-page">

              {playlistError && (
                <p className="api-error">
                  Playlist error: {playlistError}
                </p>
              )}

              {selectedPlaylist === "liked" ? (
                <>
                  <div className="library-hero liked-hero">
                    <Heart size={42} fill="white" />

                    <div>
                      <span>YOUR CLOUD COLLECTION</span>
                      <h1>Liked Songs</h1>
                      <p>
                        {likesLoading
                          ? "Loading your saved songs..."
                          : `${likedTracks.length} saved songs`}
                      </p>
                    </div>
                  </div>

                  {likesLoading ? (
                    <p className="api-message">
                      <LoaderCircle size={17} />
                      Loading your cloud liked songs...
                    </p>
                  ) : (
                    <TrackList items={likedTracks} />
                  )}
                </>
              ) : getSelectedPlaylist() ? (
                <>
                  <div className="playlist-heading">
                    <div className="playlist-cover">
                      <ListMusic size={45} />
                    </div>

                    <div>
                      <span>YOUR CLOUD PLAYLIST</span>
                      <h1>{getSelectedPlaylist().name}</h1>

                      <p>
                        {getSelectedPlaylist().tracks.length} songs
                      </p>
                    </div>

                    <button
                      className="delete-playlist-button"
                      onClick={() => deletePlaylist(selectedPlaylist)}
                    >
                      <Trash2 size={18} />
                      Delete
                    </button>
                  </div>

                  <TrackList
                    items={getSelectedPlaylist().tracks}
                    playlistId={selectedPlaylist}
                  />
                </>
              ) : (
                <>
                  <div className="section-heading">
                    <div>
                      <h1>Your Library</h1>
                      <p>Your saved songs and cloud playlists.</p>
                    </div>

                    <button
                      className="create-button"
                      onClick={() => setShowCreateModal(true)}
                    >
                      <Plus size={18} />
                      Create
                    </button>
                  </div>

                  <button
                    className="library-item"
                    onClick={() => setSelectedPlaylist("liked")}
                  >
                    <div className="liked-icon library-item-icon">
                      <Heart size={24} fill="white" />
                    </div>

                    <div>
                      <strong>Liked Songs</strong>
                      <p>
                        {likesLoading
                          ? "Loading..."
                          : `${likedTracks.length} saved songs · Cloud`}
                      </p>
                    </div>

                    <ChevronRight size={19} />
                  </button>

                  <h2 className="library-subheading">
                    Your Cloud Playlists
                  </h2>

                  {playlistsLoading ? (
                    <p className="api-message">
                      <LoaderCircle size={17} />
                      Loading your cloud playlists...
                    </p>
                  ) : playlists.length === 0 ? (
                    <div className="library-placeholder">
                      <ListMusic size={45} />
                      <h3>No playlists yet</h3>

                      <p>
                        Create your first cloud playlist and add
                        your favourite music.
                      </p>

                      <button
                        onClick={() => setShowCreateModal(true)}
                      >
                        <Plus size={17} />
                        Create Playlist
                      </button>
                    </div>
                  ) : (
                    <div className="album-grid">
                      {playlists.map(playlist => (
                        <button
                          className="mix-card"
                          key={playlist.id}
                          onClick={() =>
                            setSelectedPlaylist(playlist.id)
                          }
                        >
                          <div className="playlist-card-icon">
                            <ListMusic size={35} />
                          </div>

                          <strong>{playlist.name}</strong>
                          <p>
                            {playlist.tracks.length} songs · Cloud
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </main>

      {/* RIGHT PANEL */}

      <aside className="right-panel">
        <div className="right-panel-heading">
          <h3>Now Playing</h3>

          <button
            onClick={() => setShowFullPlayer(true)}
            aria-label="Open player"
          >
            <MoreHorizontal size={21} />
          </button>
        </div>

        {activeTrack ? (
          <>
            <div className="featured-art">
              <img
                src={activeTrack.image}
                alt={activeTrack.name}
              />
            </div>

            <div className="featured-details">
              <div>
                <h2>{activeTrack.name}</h2>
                <p>{activeTrack.artist}</p>
              </div>

              <button
                onClick={() => toggleLike(activeTrack)}
                className={isLiked(activeTrack.id) ? "liked" : ""}
                disabled={!!likeBusy[String(activeTrack.id)]}
              >
                <Heart
                  size={21}
                  fill={
                    isLiked(activeTrack.id) ? "#A78BFA" : "none"
                  }
                />
              </button>
            </div>

            <div className="artist-info">
              <div className="artist-cover">
                <img src={activeTrack.image} alt="" />
              </div>

              <div className="artist-info-text">
                <span>TRACK INFORMATION</span>
                <h3>{activeTrack.artist}</h3>
                <p>Independent artist · Jamendo</p>

                <p className="track-license">
                  {activeTrack.licenseName}
                </p>

                {activeTrack.licenseUrl && (
                  <a
                    href={activeTrack.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View license <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="library-placeholder">
            <Music2 size={45} />
            <h3>Select a track</h3>
            <p>Your music will appear here.</p>
          </div>
        )}
      </aside>

      {/* FULLSCREEN PLAYER */}

      {showFullPlayer && activeTrack && (
        <div className="now-playing-overlay">
          <header className="now-playing-header">
            <button onClick={() => setShowFullPlayer(false)}>
              <ChevronDown size={26} />
            </button>

            <div>
              <span>NOW PLAYING</span>
              <strong>MOODIFY</strong>
            </div>

            <button onClick={() => setShowFullPlayer(false)}>
              <X size={23} />
            </button>
          </header>

          <div className="now-playing-content">
            <div className="now-playing-art">
              <img
                src={activeTrack.image}
                alt={activeTrack.name}
              />
            </div>

            <div className="now-playing-info">
              <div>
                <h1>{activeTrack.name}</h1>
                <p>{activeTrack.artist}</p>
              </div>

              <button
                onClick={() => toggleLike(activeTrack)}
                className={isLiked(activeTrack.id) ? "liked" : ""}
                disabled={!!likeBusy[String(activeTrack.id)]}
              >
                <Heart
                  size={27}
                  fill={
                    isLiked(activeTrack.id) ? "#A78BFA" : "none"
                  }
                />
              </button>
            </div>

            <div className="np-progress">
              <input
                type="range"
                min="0"
                max={
                  Number.isFinite(duration) && duration > 0
                    ? duration
                    : 1
                }
                value={Math.min(currentTime, duration || 0)}
                onChange={event => {
                  const value = Number(event.target.value);

                  if (audioRef.current) {
                    audioRef.current.currentTime = value;
                  }

                  setCurrentTime(value);
                }}
              />

              <div className="np-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="np-controls">
              <button
                className={isShuffle ? "np-active" : ""}
                onClick={() => setIsShuffle(value => !value)}
                aria-label="Toggle shuffle"
              >
                <Shuffle size={22} />
              </button>

              <button
                onClick={previousTrack}
                aria-label="Previous track"
              >
                <SkipBack size={27} fill="currentColor" />
              </button>

              <button
                className="np-main-play"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying
                  ? <Pause size={29} fill="black" />
                  : <Play size={29} fill="black" />}
              </button>

              <button
                onClick={nextTrack}
                aria-label="Next track"
              >
                <SkipForward size={27} fill="currentColor" />
              </button>

              <button
                className={repeatMode !== "off" ? "np-active" : ""}
                onClick={toggleRepeat}
                aria-label="Toggle repeat"
              >
                <Repeat size={22} />

                {repeatMode === "one" && (
                  <span className="repeat-one">1</span>
                )}
              </button>
            </div>

            <div className="np-bottom">
              <Disc3 size={19} />
              <span>{activeTrack.licenseName} · Jamendo</span>
              <ListMusic size={19} />
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM PLAYER */}

      <footer className="player-bar">
        <div className="player-track">
          {activeTrack ? (
            <>
              <img src={activeTrack.image} alt="" />

              <div>
                <strong>{activeTrack.name}</strong>
                <span>{activeTrack.artist}</span>
              </div>

              <button
                className={
                  isLiked(activeTrack.id)
                    ? "heart-button liked"
                    : "heart-button"
                }
                onClick={() => toggleLike(activeTrack)}
                aria-label="Like current track"
                disabled={!!likeBusy[String(activeTrack.id)]}
              >
                <Heart
                  size={18}
                  fill={
                    isLiked(activeTrack.id) ? "#A78BFA" : "none"
                  }
                />
              </button>
            </>
          ) : (
            <div>
              <strong>MOODIFY</strong>
              <span>Select a song</span>
            </div>
          )}
        </div>

        <div className="player-controls">
          <div className="control-buttons">
            <button
              className={isShuffle ? "np-active" : ""}
              onClick={() => setIsShuffle(value => !value)}
              aria-label="Toggle shuffle"
            >
              <Shuffle size={18} />
            </button>

            <button
              onClick={previousTrack}
              aria-label="Previous track"
            >
              <SkipBack size={20} fill="currentColor" />
            </button>

            <button
              className="main-play-button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying
                ? <Pause size={23} fill="black" />
                : <Play size={23} fill="black" />}
            </button>

            <button
              onClick={nextTrack}
              aria-label="Next track"
            >
              <SkipForward size={20} fill="currentColor" />
            </button>

            <button
              className={repeatMode !== "off" ? "np-active" : ""}
              onClick={toggleRepeat}
              aria-label="Toggle repeat"
            >
              <Repeat size={18} />
            </button>
          </div>

          <div className="progress-container">
            <span>{formatTime(currentTime)}</span>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: duration > 0
                    ? `${Math.min((currentTime / duration) * 100, 100)}%`
                    : "0%"
                }}
              />
            </div>

            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-extra">
          <button
            onClick={() => setShowFullPlayer(true)}
            aria-label="Open playlist player"
          >
            <ListMusic size={19} />
          </button>

          <Volume2 size={19} />

          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={event =>
              setVolume(Number(event.target.value))
            }
            aria-label="Volume"
          />

          <button
            onClick={() => setShowFullPlayer(true)}
            aria-label="Fullscreen player"
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </footer>

      {/* MOBILE NAVIGATION */}

      <nav className="mobile-navigation">
        <button
          className={
            activeNav === "Home" ? "mobile-nav-active" : ""
          }
          onClick={() => {
            setActiveNav("Home");
            setSelectedPlaylist(null);
          }}
        >
          <Home size={22} />
          <span>Home</span>
        </button>

        <button
          className={
            activeNav === "Search" ? "mobile-nav-active" : ""
          }
          onClick={() => setActiveNav("Search")}
        >
          <Search size={22} />
          <span>Search</span>
        </button>

        <button
          className={
            activeNav === "Library" ? "mobile-nav-active" : ""
          }
          onClick={() => setActiveNav("Library")}
        >
          <Library size={22} />
          <span>Library</span>
        </button>
      </nav>

      {/* CREATE PLAYLIST MODAL */}

      {showCreateModal && (
        <div
          className="moodify-modal-backdrop"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="moodify-modal"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowCreateModal(false)}
            >
              <X size={21} />
            </button>

            <div className="modal-icon">
              <ListMusic size={30} />
            </div>

            <h2>Create Playlist</h2>
            <p>Your playlist will be saved to your account.</p>

            <input
              autoFocus
              maxLength={50}
              value={newPlaylistName}
              onChange={event =>
                setNewPlaylistName(event.target.value)
              }
              onKeyDown={event => {
                if (event.key === "Enter") {
                  createPlaylist();
                }
              }}
              placeholder="My favourite songs"
            />

            <button
              className="modal-create-button"
              onClick={createPlaylist}
              disabled={!newPlaylistName.trim()}
            >
              Create Playlist
            </button>
          </div>
        </div>
      )}

      {/* ADD TO PLAYLIST MODAL */}

      {addToPlaylistTrack && (
        <div
          className="moodify-modal-backdrop"
          onClick={() => setAddToPlaylistTrack(null)}
        >
          <div
            className="moodify-modal"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setAddToPlaylistTrack(null)}
            >
              <X size={21} />
            </button>

            <h2>Add to Playlist</h2>
            <p>{addToPlaylistTrack.name}</p>

            {playlists.length === 0 ? (
              <>
                <p>
                  Create a playlist before adding songs.
                </p>

                <button
                  className="modal-create-button"
                  onClick={() => {
                    setAddToPlaylistTrack(null);
                    setShowCreateModal(true);
                  }}
                >
                  <Plus size={17} />
                  Create Playlist
                </button>
              </>
            ) : (
              <div className="playlist-choice-list">
                {playlists.map(playlist => {
                  const alreadyAdded = playlist.tracks.some(
                    track =>
                      String(track.id) ===
                      String(addToPlaylistTrack.id)
                  );

                  return (
                    <button
                      key={playlist.id}
                      disabled={alreadyAdded}
                      onClick={() =>
                        addTrackToPlaylist(
                          playlist.id,
                          addToPlaylistTrack
                        )
                      }
                    >
                      <ListMusic size={20} />
                      <span>{playlist.name}</span>

                      {alreadyAdded
                        ? <Check size={18} />
                        : <Plus size={18} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PLAYBACK ERROR */}

      {playbackError && (
        <div className="playback-error" role="alert">
          {playbackError}

          <button
            onClick={() => setPlaybackError("")}
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* TOAST NOTIFICATION */}

      {toast && (
        <div className="moodify-toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

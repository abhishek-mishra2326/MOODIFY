
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Music2, Mail, Lock, User, LoaderCircle } from "lucide-react";

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (!isLogin) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          onAuthSuccess?.(data.session.user);
        } else {
          setMessage(
            "Account created! Please check your email to confirm your account, then log in."
          );
          setIsLogin(true);
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) throw error;

        onAuthSuccess?.(data.user);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090D0B] flex items-center justify-center p-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111714] p-7 shadow-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1ED760]/10 text-[#1ED760]">
            <Music2 size={34} />
          </div>

          <h1 className="text-3xl font-extrabold tracking-wide">
            MOODIFY
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Feel the music. Live the mood.
          </p>
        </div>

        <h2 className="mb-2 text-2xl font-bold">
          {isLogin ? "Welcome back" : "Create your account"}
        </h2>

        <p className="mb-6 text-sm text-gray-400">
          {isLogin
            ? "Log in to continue your music journey."
            : "Sign up to save your playlists in the cloud."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Full Name
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4">
                <User size={18} className="text-gray-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-transparent py-3 outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Email Address
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4">
              <Mail size={18} className="text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent py-3 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Password
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4">
              <Lock size={18} className="text-gray-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-transparent py-3 outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ED760] py-3 font-bold text-black transition hover:bg-[#18c653] disabled:opacity-60"
          >
            {loading && <LoaderCircle size={18} className="animate-spin" />}
            {loading
              ? "Please wait..."
              : isLogin
                ? "Login"
                : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          {" "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setMessage("");
            }}
            className="font-semibold text-[#1ED760] hover:underline"
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </section>
    </main>
  );
}

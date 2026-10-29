import { getStore } from "@netlify/blobs";

const STORE_NAME = "moprosoft-quest";
const KEY_NAME = "leaderboard-v1";
const MAX_ENTRIES = 200;

function sortScores(list) {
  return list.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.pct !== a.pct) return b.pct - a.pct;
    return (a.timeSec || 9999) - (b.timeSec || 9999);
  });
}

export default async (req) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const store = getStore(STORE_NAME);
    let current = await store.get(KEY_NAME, { type: "json" });
    if (!Array.isArray(current)) current = [];

    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("mode");
      const sorted = sortScores(current);
      const filtered = mode && mode !== "all" ? sorted.filter(s => s.mode === mode) : sorted;
      return new Response(
        JSON.stringify({ ok: true, scores: filtered.slice(0, 50) }),
        { status: 200, headers }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const rawName = String(body.name || "Jugador").trim().slice(0, 40) || "Jugador";
      const mode = body.mode === "act" ? "act" : "ev";
      const okCount = Math.max(0, Math.min(100, Number(body.ok) || 0));
      const total = Math.max(1, Math.min(100, Number(body.total) || 1));
      const pct = Math.max(0, Math.min(100, Math.round((okCount / total) * 100)));
      const timeSec = Math.max(1, Math.min(7200, Math.round(Number(body.timeSec) || 60)));
      const streak = Math.max(0, Math.min(100, Number(body.streak) || 0));
      const score = Math.max(0, Math.min(100000, Math.round(Number(body.score) || 0)));

      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: rawName,
        mode,
        score,
        ok: okCount,
        total,
        pct,
        timeSec,
        streak,
        date: new Date().toISOString()
      };

      current.push(entry);
      const sortedAll = sortScores(current).slice(0, MAX_ENTRIES);
      await store.setJSON(KEY_NAME, sortedAll);

      const modeScores = sortScores(sortedAll.filter(s => s.mode === mode));
      const rank = modeScores.findIndex(s => s.id === entry.id) + 1;

      return new Response(
        JSON.stringify({
          ok: true,
          entry,
          rank,
          scores: sortedAll.slice(0, 50)
        }),
        { status: 201, headers }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Método no permitido" }),
      { status: 405, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Error en el servidor de puntuaciones",
        details: err?.message || String(err)
      }),
      { status: 500, headers }
    );
  }
};


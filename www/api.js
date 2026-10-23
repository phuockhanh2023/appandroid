// Thay thế server.js: chạy ngay trong app. fetch() trong app Capacitor đi qua HTTP native nên không bị CORS.
(() => {
  const realFetch = window.fetch.bind(window);
  const CLIENTS = [
    { ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
      ctx: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34, osName: "Android", osVersion: "14", hl: "en" } },
    { ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
      ctx: { clientName: "IOS", clientVersion: "20.10.4", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82", hl: "en" } },
    { ua: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
      ctx: { clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER", clientVersion: "2.0", hl: "en" }, embed: true },
  ];
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

  async function getTracks(id, c) {
    const body = { context: { client: c.ctx }, videoId: id };
    if (c.embed) body.context.thirdParty = { embedUrl: "https://www.google.com" };
    const r = await realFetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST", headers: { "content-type": "application/json", "user-agent": c.ua }, body: JSON.stringify(body),
    });
    const j = await r.json();
    return (j.captions && j.captions.playerCaptionsTracklistRenderer && j.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
  }
  function pick(tracks, lang) {
    const re = new RegExp("^" + lang, "i");
    const c = tracks.filter((t) => re.test(t.languageCode || ""));
    const trad = (t) => lang === "zh" && /hant|tw|hk/i.test(t.languageCode || "");
    c.sort((a, b) => (a.kind === "asr") - (b.kind === "asr") || trad(a) - trad(b));
    return c[0];
  }
  function parseJson3(txt) {
    const j = JSON.parse(txt), cues = [];
    for (const e of j.events || []) {
      if (!e.segs) continue;
      const text = e.segs.map((s) => s.utf8).join("").replace(/\s*\n\s*/g, " ").trim();
      if (!text) continue;
      cues.push({ s: e.tStartMs / 1000, e: (e.tStartMs + (e.dDurationMs || 2000)) / 1000, t: text });
    }
    for (let i = 0; i < cues.length - 1; i++) if (cues[i].e > cues[i + 1].s) cues[i].e = cues[i + 1].s;
    return cues;
  }
  async function captions(id, lang) {
    const log = [], avail = [];
    for (const c of CLIENTS) {
      try {
        const tracks = await getTracks(id, c);
        tracks.forEach((x) => { const n = x.languageCode + (x.kind === "asr" ? " (auto)" : ""); if (!avail.includes(n)) avail.push(n); });
        const t = pick(tracks, lang);
        if (!t) { log.push(c.ctx.clientName + ": không có track"); continue; }
        const txt = await (await realFetch(t.baseUrl + "&fmt=json3", { headers: { "user-agent": c.ua } })).text();
        if (!txt) { log.push(c.ctx.clientName + ": phụ đề rỗng"); continue; }
        const cues = parseJson3(txt);
        if (cues.length) return { available: avail, track: t.languageCode, auto: t.kind === "asr", cues };
        log.push(c.ctx.clientName + ": 0 câu");
      } catch (e) { log.push(c.ctx.clientName + ": " + e.message); }
    }
    return { error: "Không lấy được phụ đề " + lang + " (" + log.join("; ") + ")", available: avail };
  }

  const TR = new Map();
  async function translate(sl, q) {
    const key = sl + "|" + q;
    if (TR.has(key)) return TR.get(key);
    const r = await realFetch("https://translate.googleapis.com/translate_a/single?client=gtx&tl=vi&dt=t&dt=rm&dt=bd&sl=" + encodeURIComponent(sl) + "&q=" + encodeURIComponent(q));
    if (!r.ok) throw new Error("Google trả về HTTP " + r.status);
    const body = await r.text();
    if (TR.size > 1500) TR.delete(TR.keys().next().value);
    TR.set(key, body);
    return body;
  }

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (typeof url === "string" && url.startsWith("/api/")) {
      const u = new URL(url, "http://x");
      try {
        if (u.pathname === "/api/captions") {
          const v = u.searchParams.get("v") || "";
          if (!/^[\w-]{11}$/.test(v)) throw new Error("ID video không hợp lệ");
          return json(await captions(v, u.searchParams.get("lang") || "zh"));
        }
        if (u.pathname === "/api/tr") {
          const q = u.searchParams.get("q") || "";
          if (q.length > 4000) throw new Error("Văn bản quá dài");
          return new Response(await translate(u.searchParams.get("sl") || "auto", q), { headers: { "content-type": "application/json" } });
        }
      } catch (e) { return json({ error: String(e.message || e) }, 500); }
    }
    return realFetch(input, init);
  };
})();

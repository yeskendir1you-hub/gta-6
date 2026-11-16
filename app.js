/* ================================================================
   Конфетти: лёгкая система частиц на canvas.
   ================================================================ */
const Confetti = (() => {
  const c = document.getElementById("confetti"), ctx = c.getContext("2d");
  const colors = ["#ff3d9a", "#ff9a3d", "#ffe46b", "#3de0ff", "#9b5cff", "#ffffff"];
  let parts = [], running = false;
  function size() { c.width = innerWidth; c.height = innerHeight; }
  size(); addEventListener("resize", size);

  function burst(n = 200, ox = 0.5, oy = 0.35) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) n = Math.min(n, 40);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 10;
      parts.push({
        x: ox * c.width, y: oy * c.height,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 10,
        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
        color: colors[(Math.random() * colors.length) | 0], life: 0
      });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function loop() {
    ctx.clearRect(0, 0, c.width, c.height);
    parts = parts.filter(p => p.y < c.height + 40 && p.life < 400);
    for (const p of parts) {
      p.life++; p.vy += .25; p.vx *= .985; p.vy *= .985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.r * 2)), p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, c.width, c.height); }
  }
  return { burst };
})();

/* ================================================================
   Основная логика страницы: таймер, часовые пояса, «сколько это в…»,
   шеринг, календарь, счётчик посетителей, опросы, трейлеры,
   конфетти, звёзды, бегущая строка, анимации появления и пасхалка.
   ================================================================ */
(() => {
  "use strict";

  // Дата релиза. Если её снова перенесут — поменяйте только эти числа.
  const RELEASE = { y: 2026, m: 11, d: 19 };

  // Публичный бесплатный сервис счётчиков (без ключей и регистрации).
  // Если он недоступен, опросы и счётчик работают в локальном режиме.
  const COUNTER_API = "https://abacus.jasoncameron.dev";
  const NS = "gta6-fan-countdown-v1";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, "0");
  const fmt = n => Math.floor(n).toLocaleString("ru-RU");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } }
  };

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  /* ---------------- Тост ---------------- */
  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------------- Часовые пояса ---------------- */
  // Смещение зоны относительно UTC (мс) в заданный момент.
  function tzOffset(tz, ts) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(ts)).reduce((o, p) => (o[p.type] = +p.value, o), {});
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - ts;
  }
  function releaseInstant(tz) {
    if (tz === "local") return new Date(RELEASE.y, RELEASE.m - 1, RELEASE.d).getTime();
    const guess = Date.UTC(RELEASE.y, RELEASE.m - 1, RELEASE.d);
    let t = guess - tzOffset(tz, guess);
    t = guess - tzOffset(tz, t);
    return t;
  }

  const tzSelect = $("#tzSelect");
  const savedTz = store.get("gta6-tz");
  if (savedTz && [...tzSelect.options].some(o => o.value === savedTz)) tzSelect.value = savedTz;
  let target = releaseInstant(tzSelect.value);
  tzSelect.addEventListener("change", () => {
    store.set("gta6-tz", tzSelect.value);
    target = releaseInstant(tzSelect.value);
    tick();
  });

  // Предпросмотр состояния «игра вышла»: добавьте ?demo=release к адресу.
  const demoRelease = new URLSearchParams(location.search).get("demo") === "release";

  /* ---------------- Таймер ---------------- */
  const els = { d: $("#d"), h: $("#h"), m: $("#m"), s: $("#s"), ld: $("#ld"), lh: $("#lh"), lm: $("#lm"), ls: $("#ls") };
  const prev = {};
  let released = false;

  function setNum(key, val) {
    if (prev[key] === val) return;
    prev[key] = val;
    const el = els[key];
    el.textContent = val;
    el.classList.remove("tick");
    void el.offsetWidth;
    el.classList.add("tick");
  }

  function tick() {
    const diff = demoRelease ? 0 : target - Date.now();
    if (diff <= 0) {
      if (!released) {
        released = true;
        document.body.classList.add("is-out");
        document.title = "GTA VI уже вышла!";
        $("#tlFinal").textContent = "Свершилось! Игра вышла.";
        ["#funMovies", "#funSongs", "#funEpisodes", "#funBeats"].forEach(id => $(id).textContent = "0");
        Confetti.burst(400);
        setTimeout(() => Confetti.burst(300), 900);
      }
      return;
    }
    if (released) { released = false; document.body.classList.remove("is-out"); }

    const total = Math.floor(diff / 1000);
    const d = Math.floor(total / 86400), h = Math.floor(total % 86400 / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
    setNum("d", String(d)); setNum("h", pad(h)); setNum("m", pad(m)); setNum("s", pad(s));
    els.ld.textContent = plural(d, "день", "дня", "дней");
    els.lh.textContent = plural(h, "час", "часа", "часов");
    els.lm.textContent = plural(m, "минута", "минуты", "минут");
    els.ls.textContent = plural(s, "секунда", "секунды", "секунд");
    document.title = `${d} ${plural(d, "день", "дня", "дней")} ${pad(h)}:${pad(m)}:${pad(s)} — GTA VI`;

    const min = diff / 60000;
    $("#funMovies").textContent = (min / 120).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
    $("#funSongs").textContent = fmt(min / 3.5);
    $("#funEpisodes").textContent = fmt(min / 45);
    $("#funBeats").textContent = fmt(min * 72);
  }
  tick();
  setInterval(tick, 1000);

  /* ---------------- Бегущая строка ---------------- */
  const phrases = [
    "Добро пожаловать в <b>Леониду</b>", "Релиз <b>19.11.2026</b>", "Вайс-Сити <b>ждёт</b>",
    "Люсия <b>&amp;</b> Джейсон", "PS5 <b>·</b> Xbox Series X|S", "Не переключайся — <b>осталось немного</b>"
  ];
  const line = phrases.map(p => `<span>${p}</span><span>✦</span>`).join("");
  $("#marquee").innerHTML = line + line;

  /* ---------------- Шеринг ---------------- */
  const pageUrl = location.href.split(/[?#]/)[0];
  function shareText() {
    const days = Math.max(0, Math.ceil((target - Date.now()) / 86400000));
    return released || days === 0
      ? "GTA VI уже вышла! 🌴"
      : `До выхода GTA VI осталось ${days} ${plural(days, "день", "дня", "дней")}! 🌴 Смотри таймер:`;
  }
  function updateShareLinks() {
    const t = encodeURIComponent(shareText()), u = encodeURIComponent(pageUrl);
    $("#shareTg").href = `https://t.me/share/url?url=${u}&text=${t}`;
    $("#shareWa").href = `https://wa.me/?text=${t}%20${u}`;
    $("#shareVk").href = `https://vk.com/share.php?url=${u}&title=${t}`;
  }
  updateShareLinks();
  setInterval(updateShareLinks, 60000);

  $("#shareCopy").addEventListener("click", async () => {
    const text = `${shareText()} ${pageUrl}`;
    if (navigator.share && matchMedia("(hover: none)").matches) {
      try { await navigator.share({ title: "Обратный отсчёт до GTA VI", text: shareText(), url: pageUrl }); return; } catch { /* отменили */ }
    }
    try { await navigator.clipboard.writeText(text); toast("Ссылка скопирована ✨"); }
    catch { prompt("Скопируй ссылку:", text); }
  });

  /* ---------------- Календарь (.ics) ---------------- */
  $("#calBtn").addEventListener("click", () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GTA VI Fan Countdown//RU", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:gta6-release-20261119@fan-countdown`,
      `DTSTAMP:${stamp}`,
      "DTSTART;VALUE=DATE:20261119", "DTEND;VALUE=DATE:20261120",
      "SUMMARY:🌴 Выход GTA VI",
      `DESCRIPTION:Сегодня выходит GTA VI на PS5 и Xbox Series X|S. Таймер: ${pageUrl}`,
      "BEGIN:VALARM", "TRIGGER:-PT12H", "ACTION:DISPLAY", "DESCRIPTION:Завтра выходит GTA VI!", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "gta6-release.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Файл календаря скачан — открой его, чтобы добавить напоминание 📅");
  });

  /* ---------------- Общие счётчики ---------------- */
  async function api(action, key) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(`${COUNTER_API}/${action}/${NS}/${key}`, { signal: ctrl.signal });
      if (r.status === 404 && action === "get") return 0; // счётчик ещё не создан
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      return typeof j.value === "number" ? j.value : 0;
    } finally { clearTimeout(to); }
  }

  /* ---------------- Посетители ---------------- */
  (async () => {
    const out = $("#visitors"), note = $("#visitorsNote");
    try {
      const seen = store.get("gta6-visited");
      const n = await api(seen ? "get" : "hit", "visits");
      if (!seen) store.set("gta6-visited", "1");
      countUp(out, Math.max(n, 1));
      note.textContent = "Уникальных посетителей этой страницы. Ты один из них 👋";
    } catch {
      out.textContent = "∞";
      note.textContent = "Счётчик сейчас недоступен — но нас точно много.";
    }
  })();

  function countUp(el, to) {
    const start = performance.now(), dur = 1600;
    (function f(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(f);
    })(start);
  }

  /* ---------------- Опросы ---------------- */
  $$(".poll").forEach(poll => {
    const id = poll.dataset.poll;
    const opts = $$(".opt", poll);
    const note = $(".poll-note", poll);
    const myKey = `gta6-poll-${id}`;
    let counts = Object.fromEntries(opts.map(o => [o.dataset.opt, 0]));
    let online = true;

    function render() {
      const mine = store.get(myKey);
      if (!mine) return;
      poll.classList.add("voted");
      const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
      opts.forEach(o => {
        const k = o.dataset.opt, pct = Math.round(counts[k] / total * 100);
        o.disabled = true;
        o.classList.toggle("mine", k === mine);
        $(".fill", o).style.width = pct + "%";
        $(".pct", o).textContent = pct + "%";
      });
      const sum = Object.values(counts).reduce((a, b) => a + b, 0);
      note.textContent = online
        ? `Всего ${fmt(sum)} ${plural(sum, "голос", "голоса", "голосов")}. Твой выбор подсвечен.`
        : "Общие результаты сейчас недоступны — показан только твой голос.";
    }

    async function load() {
      try {
        const vals = await Promise.all(opts.map(o => api("get", `${id}-${o.dataset.opt}`)));
        opts.forEach((o, i) => counts[o.dataset.opt] = vals[i]);
      } catch { online = false; }
      const mine = store.get(myKey);
      if (mine && !online) counts[mine] = Math.max(counts[mine], 1);
      render();
    }

    opts.forEach(o => o.addEventListener("click", async () => {
      if (store.get(myKey)) return;
      const k = o.dataset.opt;
      store.set(myKey, k);
      try { counts[k] = await api("hit", `${id}-${k}`); online = true; }
      catch { online = false; counts[k] += 1; }
      render();
      const r = o.getBoundingClientRect();
      Confetti.burst(90, (r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight);
    }));

    load();
  });

  /* ---------------- Трейлеры (загрузка по клику) ---------------- */
  $$(".video").forEach(v => {
    $(".poster", v).addEventListener("click", () => {
      Music.pause();
      const f = document.createElement("iframe");
      f.src = `https://www.youtube-nocookie.com/embed/${v.dataset.yt}?autoplay=1&rel=0`;
      f.title = "Трейлер GTA VI";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      v.innerHTML = "";
      v.appendChild(f);
    });
  });

  /* ---------------- Музыка ---------------- */
  const musicBtn = $("#musicBtn");
  musicBtn.addEventListener("click", () => {
    const on = Music.toggle();
    musicBtn.classList.toggle("on", on);
    musicBtn.setAttribute("aria-pressed", on);
    $("#musicLabel").textContent = on ? "Играет" : "Музыка";
  });
  Music.onStop = () => {
    musicBtn.classList.remove("on");
    musicBtn.setAttribute("aria-pressed", "false");
    $("#musicLabel").textContent = "Музыка";
  };

  /* ---------------- Появление при прокрутке ---------------- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 80 + "ms";
    io.observe(el);
  });

  /* ---------------- Звёзды в небе ---------------- */
  (() => {
    const c = $("#stars"), ctx = c.getContext("2d");
    let stars = [];
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round(c.offsetWidth * c.offsetHeight / 2600) }, () => ({
        x: Math.random() * c.offsetWidth, y: Math.random() * c.offsetHeight,
        r: Math.random() * 1.2 + .2, p: Math.random() * Math.PI * 2, s: Math.random() * 1.5 + .5
      }));
    }
    size(); addEventListener("resize", size);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    (function draw(t) {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const s of stars) {
        const a = still ? .7 : .35 + .65 * Math.abs(Math.sin(s.p + t / 1000 * s.s));
        ctx.globalAlpha = a * (1 - s.y / c.offsetHeight * .8);
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!still) requestAnimationFrame(draw);
    })(0);
  })();

  /* ---------------- Пасхалка: ↑↑↓↓←→←→BA ---------------- */
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  addEventListener("keydown", e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === code[pos] ? pos + 1 : (k === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      const car = $("#easterCar");
      car.classList.remove("go"); void car.getBoundingClientRect(); car.classList.add("go");
      Confetti.burst(250);
      toast("🚗 Секретный код принят. Уважение, ветеран!");
    }
  });
})();


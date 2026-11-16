/* ================================================================
   Мини-игра «Неоновая трасса»: оригинальная аркада на canvas.
   Три полосы, встречные машины, звёзды-бонусы, растущая скорость.
   ================================================================ */
(() => {
  "use strict";
  const c = document.getElementById("gameCanvas"), ctx = c.getContext("2d");
  const W = 480, H = 600, LANES = 3, ROAD_L = 60, ROAD_W = W - 120, LANE_W = ROAD_W / LANES;
  const overlay = document.getElementById("gameOverlay");
  const scoreEl = document.getElementById("score"), bestEl = document.getElementById("best");
  const laneX = l => ROAD_L + LANE_W * l + LANE_W / 2;
  const palette = ["#3de0ff", "#9b5cff", "#ffe46b", "#7dff9b"];

  let best = 0;
  try { best = +localStorage.getItem("gta6-game-best") || 0; } catch { /* нет хранилища */ }
  bestEl.textContent = best;

  let bonus = 0, state = "idle", player, cars, stars, speed, dist, score, spawnT, starT, last, offset = 0, shake = 0, sparks = [];

  // Чёткая отрисовка на экранах с высокой плотностью пикселей
  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();

  function reset() {
    player = { lane: 1, x: laneX(1), y: H - 110 };
    cars = []; stars = []; sparks = [];
    speed = 300; dist = 0; score = 0; bonus = 0; spawnT = 0.6; starT = 2;
  }
  reset();

  function start() {
    reset();
    state = "run";
    overlay.classList.add("hidden");
    last = performance.now();
    requestAnimationFrame(loop);
  }
  document.getElementById("gameStart").addEventListener("click", start);

  function move(dir) {
    if (state !== "run") return;
    player.lane = Math.max(0, Math.min(LANES - 1, player.lane + dir));
  }
  addEventListener("keydown", e => {
    const inView = c.getBoundingClientRect().top < innerHeight && c.getBoundingClientRect().bottom > 0;
    if (!inView) return;
    if (["ArrowLeft", "a", "A", "ф", "Ф"].includes(e.key)) { move(-1); if (state === "run") e.preventDefault(); }
    if (["ArrowRight", "d", "D", "в", "В"].includes(e.key)) { move(1); if (state === "run") e.preventDefault(); }
    if ((e.key === " " || e.key === "Enter") && state !== "run" && document.activeElement === document.body) { e.preventDefault(); start(); }
  });
  const touch = document.getElementById("touchCtrl");
  touch.hidden = false;
  touch.querySelectorAll("button").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); move(+b.dataset.dir); }));
  let sx = null;
  c.addEventListener("pointerdown", e => { sx = e.clientX; });
  c.addEventListener("pointerup", e => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 30) move(Math.sign(dx));
  });

  function spawnCar() {
    const free = [0, 1, 2].filter(l => !cars.some(cc => cc.lane === l && cc.y < 140));
    if (!free.length) return;
    // Никогда не перекрываем все три полосы сразу
    const blocked = new Set(cars.filter(cc => cc.y < 200).map(cc => cc.lane));
    const options = free.filter(l => blocked.size < 2 || blocked.has(l));
    const lane = options[(Math.random() * options.length) | 0];
    if (lane === undefined) return;
    cars.push({ lane, x: laneX(lane), y: -90, v: 60 + Math.random() * 90, color: palette[(Math.random() * palette.length) | 0] });
  }

  function loop(now) {
    if (state !== "run") return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    speed = Math.min(900, speed + dt * 14);
    dist += speed * dt;
    score = Math.floor(dist / 10) + bonus;
    scoreEl.textContent = score;
    offset = (offset + speed * dt) % 80;
    player.x += (laneX(player.lane) - player.x) * Math.min(1, dt * 14);

    spawnT -= dt;
    if (spawnT <= 0) { spawnCar(); spawnT = Math.max(.32, 1.1 - speed / 1100) * (0.7 + Math.random() * .6); }
    starT -= dt;
    if (starT <= 0) { stars.push({ lane: (Math.random() * 3) | 0, y: -40, a: 0 }); starT = 2.5 + Math.random() * 2.5; }

    for (const car of cars) car.y += (speed - car.v) * dt;
    cars = cars.filter(car => car.y < H + 100);
    for (const s of stars) { s.y += speed * dt; s.a += dt * 4; }
    stars = stars.filter(s => s.y < H + 40 && !s.taken);
    sparks = sparks.filter(p => (p.t -= dt) > 0);
    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (shake > 0) shake -= dt;

    // Столкновения
    for (const car of cars) {
      if (Math.abs(car.x - player.x) < 44 && Math.abs(car.y - player.y) < 78) return crash();
    }
    for (const s of stars) {
      if (Math.abs(laneX(s.lane) - player.x) < 44 && Math.abs(s.y - player.y) < 60) {
        s.taken = true; bonus += 50;
        for (let i = 0; i < 14; i++) sparks.push({ x: laneX(s.lane), y: s.y, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300, t: .5 });
      }
    }
  }

  function crash() {
    state = "over"; shake = .4;
    draw();
    if (score > best) {
      best = score; bestEl.textContent = best;
      try { localStorage.setItem("gta6-game-best", best); } catch { /* нет хранилища */ }
      document.getElementById("goTitle").textContent = "Новый рекорд!";
      if (typeof Confetti !== "undefined") Confetti.burst(160);
    } else {
      document.getElementById("goTitle").textContent = "Авария!";
    }
    document.getElementById("goText").textContent = `Ты набрал ${score} очков. Рекорд — ${best}.`;
    document.getElementById("gameStart").textContent = "Ещё заезд";
    setTimeout(() => overlay.classList.remove("hidden"), 450);
  }

  /* ---------------- Отрисовка ---------------- */
  function drawCar(x, y, body, glow, flip) {
    ctx.save(); ctx.translate(x, y); if (flip) ctx.rotate(Math.PI);
    ctx.shadowColor = glow; ctx.shadowBlur = 22;
    ctx.fillStyle = body;
    roundRect(-22, -40, 44, 80, 12); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(7,4,15,.75)";
    roundRect(-16, -22, 32, 18, 5); ctx.fill();
    roundRect(-16, 12, 32, 14, 5); ctx.fill();
    ctx.fillStyle = "#fff8c4"; ctx.fillRect(-18, -40, 9, 4); ctx.fillRect(9, -40, 9, 4);
    ctx.fillStyle = "#ff2d55"; ctx.fillRect(-18, 37, 9, 3); ctx.fillRect(9, 37, 9, 3);
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawStar(x, y, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.shadowColor = "#ffe46b"; ctx.shadowBlur = 20; ctx.fillStyle = "#ffe46b";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 16, ang = i * Math.PI / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * 12, (Math.random() - .5) * 12);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1d0b33"); g.addColorStop(1, "#0b0618");
    ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);

    // Обочины с пальмовыми тенями
    ctx.fillStyle = "#14071f";
    ctx.fillRect(0, 0, ROAD_L, H); ctx.fillRect(ROAD_L + ROAD_W, 0, ROAD_L, H);
    for (let y = -80 + offset * 2 % 160; y < H; y += 160) {
      ctx.fillStyle = "rgba(255,61,154,.18)";
      ctx.beginPath(); ctx.arc(20, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W - 20, y + 80, 16, 0, Math.PI * 2); ctx.fill();
    }

    // Дорога
    ctx.fillStyle = "#120a24"; ctx.fillRect(ROAD_L, 0, ROAD_W, H);
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#ff3d9a"; ctx.fillStyle = "#ff3d9a";
    ctx.fillRect(ROAD_L - 3, 0, 4, H); ctx.fillRect(ROAD_L + ROAD_W - 1, 0, 4, H);
    ctx.shadowColor = "#3de0ff"; ctx.fillStyle = "rgba(61,224,255,.8)";
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_L + LANE_W * l - 2;
      for (let y = -80 + offset; y < H; y += 80) ctx.fillRect(x, y, 4, 40);
    }
    ctx.shadowBlur = 0;

    for (const s of stars) if (!s.taken) drawStar(laneX(s.lane), s.y, s.a);
    for (const car of cars) drawCar(car.x, car.y, car.color, car.color, true);
    drawCar(player.x, player.y, "#ff3d9a", "#ff3d9a", false);

    for (const p of sparks) { ctx.globalAlpha = p.t * 2; ctx.fillStyle = "#ffe46b"; ctx.fillRect(p.x, p.y, 4, 4); }
    ctx.globalAlpha = 1;

    // Спидометр
    ctx.font = "600 13px Inter, sans-serif"; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.textAlign = "right";
    ctx.fillText(`${Math.round(speed / 4)} км/ч`, W - 14, 24);
    ctx.restore();
  }
  draw();
})();

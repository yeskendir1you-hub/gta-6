/* ================================================================
   Оригинальная синтвейв-петля, сгенерированная Web Audio API.
   Никаких аудиофайлов: бас, пэды, мелодия и ударные синтезируются
   прямо в браузере.
   ================================================================ */
const Music = (() => {
  let ctx, master, comp, delay, playing = false, timer, step = 0, nextTime = 0;
  const BPM = 98, STEP = 60 / BPM / 4; // шестнадцатые

  // Аккорды по тактам (MIDI-ноты): Am — F — C — G, по одному такту.
  const chords = [
    [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62],
    [57, 60, 64], [53, 57, 60], [52, 55, 59], [55, 59, 62]
  ];
  const roots = [45, 41, 48, 43, 45, 41, 40, 43];
  // Лид-мелодия: 16 шагов на такт, null — пауза.
  const lead = [
    [76, null, null, 74, null, null, 72, null, 74, null, null, null, 69, null, null, null],
    [72, null, null, 69, null, null, 65, null, 67, null, 69, null, null, null, null, null],
    [67, null, null, 72, null, null, 76, null, 74, null, 72, null, null, null, null, null],
    [71, null, null, 74, null, null, 79, null, 78, null, null, null, 74, null, null, null],
    [76, null, null, 74, null, null, 72, null, 74, null, null, null, 76, null, 79, null],
    [77, null, null, 76, null, null, 72, null, 69, null, null, null, 72, null, null, null],
    [71, null, null, 72, null, null, 74, null, 76, null, null, null, 71, null, null, null],
    [74, null, null, null, 71, null, null, null, 67, null, null, null, null, null, null, null]
  ];
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    comp = ctx.createDynamicsCompressor();
    delay = ctx.createDelay(1); delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = .32;
    const wet = ctx.createGain(); wet.gain.value = .35;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
    master.connect(comp); comp.connect(ctx.destination);
  }

  function voice(type, freq, t, dur, vol, cutoff, toDelay) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.value = cutoff; f.Q.value = 4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(master);
    if (toDelay) g.connect(delay);
    o.start(t); o.stop(t + dur + .05);
  }

  function pad(notes, t, dur) {
    notes.forEach(n => [-6, 6].forEach(det => {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = hz(n); o.detune.value = det;
      f.type = "lowpass"; f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(1800, t + dur * .5); f.frequency.linearRampToValueAtTime(700, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.025, t + .4); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + .05);
    }));
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .18);
    g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .32);
  }
  let noiseBuf;
  function noise(t, dur, vol, hp) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    if (hp < 3000) g.connect(delay);
    s.start(t); s.stop(t + dur + .02);
  }

  function schedule() {
    while (nextTime < ctx.currentTime + .15) {
      const bar = Math.floor(step / 16) % 8, s = step % 16, t = nextTime;
      if (s === 0) pad(chords[bar], t, STEP * 16);
      // Бас: восьмые с октавным прыжком
      if (s % 2 === 0) voice("sawtooth", hz(roots[bar] - 12 + (s % 4 === 2 ? 12 : 0)), t, STEP * 1.8, .16, 520, false);
      // Ударные
      if (s % 4 === 0) kick(t);
      if (s === 4 || s === 12) noise(t, .22, .35, 1500);
      if (s % 2 === 1) noise(t, .05, .08, 7000);
      // Лид появляется со второго круга
      const n = lead[bar][s];
      if (n && step >= 128) voice("square", hz(n), t, STEP * 3.5, .06, 2400, true);
      nextTime += STEP; step++;
    }
  }

  function start() {
    if (!ctx) init();
    ctx.resume();
    step = 0; nextTime = ctx.currentTime + .05;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(.55, ctx.currentTime + 1.2);
    timer = setInterval(schedule, 25);
    playing = true;
  }
  function stop() {
    if (!ctx) return;
    clearInterval(timer);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + .4);
    playing = false;
  }

  const api = {
    onStop: null,
    toggle() { playing ? stop() : start(); return playing; },
    pause() { if (playing) { stop(); api.onStop && api.onStop(); } },
    get playing() { return playing; }
  };
  return api;
})();

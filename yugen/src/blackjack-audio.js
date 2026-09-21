// Synthèse sonore blackjack — Web Audio API, aucun fichier requis

let _ctx = null

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

function noise(ac, dur) {
  const n = Math.ceil(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// ── Pose de carte sur feutre ──────────────────────────────────────────────────

export function playDeal() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const len = Math.ceil(ac.sampleRate * 0.045)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.13))

    const src = ac.createBufferSource()
    src.buffer = buf
    const f = ac.createBiquadFilter()
    f.type = 'bandpass'; f.frequency.value = 2700; f.Q.value = 1.3
    const g = ac.createGain()
    g.gain.value = 0.36
    src.connect(f); f.connect(g); g.connect(ac.destination)
    src.start(now)
  } catch {}
}

// ── Retournement de carte ─────────────────────────────────────────────────────

export function playFlip() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const dur = 0.15

    const src = ac.createBufferSource()
    src.buffer = noise(ac, dur)
    const f = ac.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(5500, now)
    f.frequency.exponentialRampToValueAtTime(800, now + dur)
    f.Q.value = 0.75
    const g = ac.createGain()
    g.gain.setValueAtTime(0.21, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + dur)
    src.connect(f); f.connect(g); g.connect(ac.destination)
    src.start(now)
  } catch {}
}

// ── Dépassement (bust) ────────────────────────────────────────────────────────

export function playBust() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime

    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.4)
    const og = ac.createGain()
    og.gain.setValueAtTime(0.44, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.44)
    osc.connect(og); og.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.46)

    const ns = ac.createBufferSource()
    ns.buffer = noise(ac, 0.1)
    const nf = ac.createBiquadFilter()
    nf.type = 'lowpass'; nf.frequency.value = 520
    const ng = ac.createGain()
    ng.gain.setValueAtTime(0.28, now)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    ns.connect(nf); nf.connect(ng); ng.connect(ac.destination)
    ns.start(now)
  } catch {}
}

// ── Défaite (pas de bust) ─────────────────────────────────────────────────────

export function playLose() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(330, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.3)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.22, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc.connect(g); g.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.38)
  } catch {}
}

// ── Victoire ──────────────────────────────────────────────────────────────────

export function playWin() {
  try {
    const ac = getCtx()
    ;[392, 523, 659, 784].forEach((freq, i) => {
      const osc = ac.createOscillator()
      const g   = ac.createGain()
      const t   = ac.currentTime + i * 0.1
      osc.type = 'triangle'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.17, t + 0.025)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      osc.connect(g); g.connect(ac.destination)
      osc.start(t); osc.stop(t + 0.42)
    })
  } catch {}
}

// ── Blackjack ! ───────────────────────────────────────────────────────────────

export function playBlackjack() {
  try {
    const ac = getCtx()
    ;[523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ac.createOscillator()
      const g   = ac.createGain()
      const t   = ac.currentTime + i * 0.08
      osc.type = 'triangle'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.2, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(g); g.connect(ac.destination)
      osc.start(t); osc.stop(t + 0.54)
    })
  } catch {}
}

// ── Jeton placé ──────────────────────────────────────────────────────────────

export function playChip() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const len = Math.ceil(ac.sampleRate * 0.038)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.17))
    const src = ac.createBufferSource()
    src.buffer = buf
    const f = ac.createBiquadFilter()
    f.type = 'highpass'; f.frequency.value = 1700
    const g = ac.createGain()
    g.gain.value = 0.29
    src.connect(f); f.connect(g); g.connect(ac.destination)
    src.start(now)
  } catch {}
}

export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

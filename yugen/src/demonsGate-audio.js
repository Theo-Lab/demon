// Synthèse sonore Web Audio API — Demon's Gate slot machine

let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function osc(ac, type, freq, gainVal, startT, duration) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(gainVal, startT)
  g.gain.exponentialRampToValueAtTime(0.0001, startT + duration)
  o.connect(g); g.connect(ac.destination)
  o.start(startT); o.stop(startT + duration + 0.01)
}

function noise(ac, gainVal, decay, filterFreq = 800, startT = 0) {
  const len  = ac.sampleRate * decay
  const buf  = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.4))
  const src    = ac.createBufferSource()
  const g      = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'; filter.frequency.value = filterFreq
  src.buffer = buf; g.gain.value = gainVal
  src.connect(filter); filter.connect(g); g.connect(ac.destination)
  src.start(startT)
}

// ── Sons de spin ──────────────────────────────────────────────────────────────

export function playReelSpin() {
  try {
    const ac = getCtx()
    const o = ac.createOscillator(), g = ac.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(40, ac.currentTime)
    o.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.3)
    g.gain.setValueAtTime(0.07, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35)
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.35)
  } catch {}
}

export function playReelStop(reelIndex = 0) {
  try {
    const ac   = getCtx()
    const freq = 55 + reelIndex * 18
    osc(ac, 'sine', freq * 1.8, 0.3, ac.currentTime, 0.22)
    noise(ac, 0.15, 0.06, 600)
  } catch {}
}

export function playFlameCollect() {
  try {
    const ac = getCtx()
    const o = ac.createOscillator(), g = ac.createGain()
    o.type = 'triangle'
    o.frequency.setValueAtTime(200, ac.currentTime)
    o.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.15)
    g.gain.setValueAtTime(0, ac.currentTime)
    g.gain.linearRampToValueAtTime(0.14, ac.currentTime + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18)
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.2)
    osc(ac, 'sawtooth', 80, 0.1, ac.currentTime, 0.12)
  } catch {}
}

export function playGateBlow() {
  try {
    const ac = getCtx()
    osc(ac, 'sine', 60, 0.5, ac.currentTime, 0.55)
    noise(ac, 0.55, 0.7, 400)
    ;[30, 45, 60].forEach((f, i) => osc(ac, 'sawtooth', f, 0.18, ac.currentTime + i * 0.06, 0.4))
  } catch {}
}

export function playGateBreak() {
  try {
    const ac = getCtx()
    noise(ac, 0.4, 1.2, 1200)
    osc(ac, 'sine', 110, 0.35, ac.currentTime, 0.9)
  } catch {}
}

// ── Sons de gain ──────────────────────────────────────────────────────────────

// Petit gain : pièces qui tintent
export function playWin(amount = 0, mise = 100) {
  try {
    const ac    = getCtx()
    const ratio = Math.min(amount / mise, 20)
    const count = ratio >= 5 ? 5 : ratio >= 2 ? 4 : 3
    const base  = ratio >= 5 ? 523 : 392
    const freqs = [1, 1.19, 1.5, 1.78, 2].slice(0, count).map(r => base * r)
    freqs.forEach((f, i) => {
      const t = ac.currentTime + i * 0.08
      osc(ac, 'triangle', f, 0.22, t, 0.25)
      osc(ac, 'sine',     f * 2, 0.06, t, 0.18)
    })
  } catch {}
}

// Big win (×5–×19) : fanfare grave + montée
export function playBigWin() {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime

    // Impact basse profond
    osc(ac, 'sine', 50, 0.6, t0, 0.6)
    noise(ac, 0.35, 0.5, 300, t0)

    // Accord de puissance (power chord)
    ;[82, 123, 164, 246].forEach((f, i) => {
      osc(ac, 'sawtooth', f, 0.2, t0 + i * 0.04, 0.8)
    })

    // Montée triomphale
    const melody = [261, 329, 392, 523, 659, 784, 1047]
    melody.forEach((f, i) => {
      const t = t0 + 0.5 + i * 0.085
      osc(ac, 'triangle', f, 0.25, t, 0.22)
      osc(ac, 'sine',     f * 1.5, 0.08, t, 0.2)
    })

    // Note finale tenue
    osc(ac, 'triangle', 1047, 0.3, t0 + 1.2, 0.6)
    osc(ac, 'sine',     1047 * 1.25, 0.15, t0 + 1.2, 0.6)
  } catch {}
}

// Méga win (×20+) : orchestrale épique, 3+ secondes
export function playMegaWin() {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime

    // Sub-bass impact massif
    osc(ac, 'sine', 35, 0.7, t0, 0.8)
    osc(ac, 'sine', 50, 0.5, t0, 0.7)
    noise(ac, 0.6, 0.9, 250, t0)

    // Accord massif en couches
    ;[41, 55, 82, 110, 164].forEach((f, i) => {
      osc(ac, 'sawtooth', f, 0.22, t0 + i * 0.03, 1.2)
      osc(ac, 'square',   f * 2, 0.05, t0 + i * 0.03, 1.0)
    })

    // Arpège ascendant dramatique
    const arp = [130, 164, 196, 261, 329, 392, 523, 659, 784, 1047, 1318]
    arp.forEach((f, i) => {
      const t = t0 + 0.7 + i * 0.1
      osc(ac, 'triangle', f,      0.28, t, 0.28)
      osc(ac, 'sine',     f * 2,  0.10, t, 0.25)
      osc(ac, 'square',   f * 0.5, 0.06, t, 0.22)
    })

    // Accord final plein
    ;[261, 329, 392, 523, 659, 784].forEach((f, i) => {
      const t = t0 + 1.85 + i * 0.06
      osc(ac, 'triangle', f, 0.3, t, 0.7)
      osc(ac, 'sine',     f * 1.25, 0.12, t, 0.65)
    })

    // Sub-bass final
    osc(ac, 'sine', 55, 0.5, t0 + 2.1, 0.9)
    noise(ac, 0.25, 0.6, 400, t0 + 2.1)
  } catch {}
}

// Super win (×50+) : version encore plus épique avec reverb simulé
export function playSuperWin() {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime

    // Intro sub-bass double impact
    osc(ac, 'sine', 30, 0.8, t0, 0.5)
    osc(ac, 'sine', 30, 0.8, t0 + 0.15, 0.5)
    osc(ac, 'sine', 45, 0.6, t0, 0.7)
    noise(ac, 0.7, 1.0, 200, t0)

    // Accord massif × 2 passes
    const chord = [41, 55, 82, 110, 164, 220]
    chord.forEach((f, i) => {
      osc(ac, 'sawtooth', f, 0.25, t0 + i * 0.02, 1.5)
      osc(ac, 'sawtooth', f * 1.01, 0.08, t0 + i * 0.02, 1.4) // légère désaccordance pour richesse
    })

    // Arpège très long + répété
    const arp = [65, 82, 98, 130, 164, 196, 261, 329, 392, 523, 659, 784, 1047, 1318, 1568]
    arp.forEach((f, i) => {
      const t = t0 + 0.8 + i * 0.09
      osc(ac, 'triangle', f,      0.3,  t, 0.3)
      osc(ac, 'sine',     f * 2,  0.12, t, 0.27)
      osc(ac, 'square',   f * 0.5, 0.07, t, 0.25)
    })

    // Double accord final tenu
    ;[261, 329, 392, 523, 659, 784, 1047].forEach((f, i) => {
      const t1 = t0 + 2.2 + i * 0.05
      osc(ac, 'triangle', f, 0.35, t1, 1.0)
      osc(ac, 'sine',     f * 1.25, 0.15, t1, 0.95)
    })

    // Sub-bass final + noise
    osc(ac, 'sine', 41, 0.6, t0 + 2.5, 1.2)
    noise(ac, 0.3, 0.8, 350, t0 + 2.5)
  } catch {}
}

// Free spins
export function playFreeSpins() {
  try {
    const ac = getCtx()
    const t0 = ac.currentTime
    ;[110, 138, 165, 220].forEach((f, i) => {
      const t = t0 + i * 0.12
      const o = ac.createOscillator(), g = ac.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(f, t)
      o.frequency.linearRampToValueAtTime(f * 1.5, t + 0.5)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.17, t + 0.06)
      g.gain.setValueAtTime(0.17, t + 0.35)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.65)
    })
    osc(ac, 'sine', 50, 0.4, t0 + 0.5, 0.35)
  } catch {}
}

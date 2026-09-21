// Synthèse sonore roulette — Web Audio API, aucun fichier requis

let _ctx = null

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

function makeNoise(ac, dur) {
  const n = Math.ceil(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// ── Bruit de roulement continu ────────────────────────────────────────────────

let rollSrc    = null
let rollGain   = null
let rollFilter = null

export function startRoll() {
  try {
    stopRoll()
    const ac = getCtx()

    rollSrc = ac.createBufferSource()
    rollSrc.buffer = makeNoise(ac, 3)
    rollSrc.loop = true

    rollFilter = ac.createBiquadFilter()
    rollFilter.type = 'bandpass'
    rollFilter.frequency.value = 4000
    rollFilter.Q.value = 1.0

    rollGain = ac.createGain()
    rollGain.gain.value = 0.13

    rollSrc.connect(rollFilter)
    rollFilter.connect(rollGain)
    rollGain.connect(ac.destination)
    rollSrc.start()
  } catch {}
}

// progress : 0 (début) → 1 (fin) — adapte le pitch et le volume à la vitesse
export function updateRoll(progress) {
  try {
    if (!rollGain || !rollFilter) return
    const ac = getCtx()
    const speed = 1 - progress
    rollFilter.frequency.setTargetAtTime(300 + speed * 4200, ac.currentTime, 0.06)
    rollGain.gain.setTargetAtTime(0.01 + speed * 0.13, ac.currentTime, 0.06)
  } catch {}
}

export function stopRoll() {
  try {
    if (!rollGain) return
    const ac = getCtx()
    rollGain.gain.setTargetAtTime(0, ac.currentTime, 0.12)
    const s = rollSrc; rollSrc = null; rollGain = null; rollFilter = null
    setTimeout(() => { try { s?.stop() } catch {} }, 600)
  } catch {}
}

// ── Tick (bille qui passe sur un séparateur) ─────────────────────────────────

export function playTick(volume = 0.22) {
  try {
    const ac  = getCtx()
    const len = Math.ceil(ac.sampleRate * 0.022)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25))

    const src = ac.createBufferSource()
    src.buffer = buf

    const filt = ac.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 3000

    const g = ac.createGain()
    g.gain.value = volume

    src.connect(filt); filt.connect(g); g.connect(ac.destination)
    src.start()
  } catch {}
}

// ── Choc d'atterrissage (bille dans la case) ─────────────────────────────────

export function playLand() {
  try {
    const ac = getCtx()
    const now = ac.currentTime

    // Composante basse (impact)
    const osc = ac.createOscillator()
    const og  = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(260, now)
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18)
    og.gain.setValueAtTime(0.5, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(og); og.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.3)

    // Composante bruit (cliquetis)
    const ns  = ac.createBufferSource()
    ns.buffer = makeNoise(ac, 0.08)
    const nf  = ac.createBiquadFilter()
    nf.type = 'lowpass'; nf.frequency.value = 1400
    const ng  = ac.createGain()
    ng.gain.setValueAtTime(0.28, now)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    ns.connect(nf); nf.connect(ng); ng.connect(ac.destination)
    ns.start(now)
  } catch {}
}

// ── Fanfare de victoire ───────────────────────────────────────────────────────

export function playWin() {
  try {
    const ac    = getCtx()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const g   = ac.createGain()
      const t   = ac.currentTime + i * 0.11
      osc.type = 'triangle'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      osc.connect(g); g.connect(ac.destination)
      osc.start(t); osc.stop(t + 0.4)
    })
  } catch {}
}

export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

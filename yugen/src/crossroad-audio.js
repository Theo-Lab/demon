// Synthèse sonore Traversée Démoniaque — Web Audio API

let _ctx = null
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}
export function resumeAudio() {
  try { if (getCtx().state === 'suspended') getCtx().resume() } catch {}
}

// Pas du démon (claquement sourd + basse fréquence)
export function playStep() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime

    // Claquement basse
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12)
    g.gain.setValueAtTime(0.28, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    osc.connect(g); g.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.15)

    // Bruit court
    const n    = Math.ceil(ac.sampleRate * 0.06)
    const buf  = ac.createBuffer(1, n, ac.sampleRate)
    const d    = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.18))
    const src = ac.createBufferSource()
    src.buffer = buf
    const gn  = ac.createGain(); gn.gain.value = 0.12
    const flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 700
    src.connect(flt); flt.connect(gn); gn.connect(ac.destination)
    src.start(now)
  } catch {}
}

// Brûlé — crépitement de feu
export function playBust() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime

    // Crépitement bruit blanc filtré
    const n   = Math.ceil(ac.sampleRate * 0.45)
    const buf = ac.createBuffer(1, n, ac.sampleRate)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1)
    const src = ac.createBufferSource()
    src.buffer = buf
    const flt = ac.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1100; flt.Q.value = 0.6
    const g   = ac.createGain()
    g.gain.setValueAtTime(0.35, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
    src.connect(flt); flt.connect(g); g.connect(ac.destination)
    src.start(now)

    // Grondement basse
    const osc = ac.createOscillator(); osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(90, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3)
    const g2 = ac.createGain()
    g2.gain.setValueAtTime(0.2, now)
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
    osc.connect(g2); g2.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.31)
  } catch {}
}

// Encaissement — pièces
export function playCoin() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const freqs = [880, 1100, 1320, 1540]
    freqs.forEach((f, i) => {
      const osc = ac.createOscillator(); osc.type = 'triangle'
      osc.frequency.value = f
      const g = ac.createGain()
      const t = now + i * 0.07
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
      osc.connect(g); g.connect(ac.destination)
      osc.start(t); osc.stop(t + 0.15)
    })
  } catch {}
}

// Invocation — son grave de début
export function playInvoke() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const osc = ac.createOscillator(); osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(55, now)
    osc.frequency.linearRampToValueAtTime(110, now + 0.18)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.22, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600
    osc.connect(f); f.connect(g); g.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.23)
  } catch {}
}

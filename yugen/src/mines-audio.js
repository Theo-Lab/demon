// Synthèse sonore Mines — Web Audio API, aucun fichier requis

let _ctx = null

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

function noise(ac, dur) {
  const n   = Math.ceil(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const d   = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// ── Révélation d'une gemme (ping cristallin) ──────────────────────────────────

export function playReveal() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime

    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400 + Math.random() * 300, now)
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.18)

    const g = ac.createGain()
    g.gain.setValueAtTime(0.13, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

    osc.connect(g); g.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.24)

    // Harmonique haute légère
    const osc2 = ac.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(2800 + Math.random() * 400, now)
    osc2.frequency.exponentialRampToValueAtTime(1800, now + 0.1)
    const g2 = ac.createGain()
    g2.gain.setValueAtTime(0.06, now)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc2.connect(g2); g2.connect(ac.destination)
    osc2.start(now); osc2.stop(now + 0.16)
  } catch {}
}

// ── Mine percutée (explosion sourde) ─────────────────────────────────────────

export function playMine() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime

    // Grondement grave
    const osc = ac.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(130, now)
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.55)
    const og = ac.createGain()
    og.gain.setValueAtTime(0.5, now)
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc.connect(og); og.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.62)

    // Impact bruit blanc court
    const ns = ac.createBufferSource()
    ns.buffer = noise(ac, 0.12)
    const nf = ac.createBiquadFilter()
    nf.type = 'lowpass'; nf.frequency.value = 480
    const ng = ac.createGain()
    ng.gain.setValueAtTime(0.55, now)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    ns.connect(nf); nf.connect(ng); ng.connect(ac.destination)
    ns.start(now)

    // Claquement mid
    const ns2 = ac.createBufferSource()
    ns2.buffer = noise(ac, 0.06)
    const nf2 = ac.createBiquadFilter()
    nf2.type = 'bandpass'; nf2.frequency.value = 900; nf2.Q.value = 0.8
    const ng2 = ac.createGain()
    ng2.gain.setValueAtTime(0.32, now)
    ng2.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    ns2.connect(nf2); nf2.connect(ng2); ng2.connect(ac.destination)
    ns2.start(now)
  } catch {}
}

// ── Encaissement (cascade de pièces) ─────────────────────────────────────────

export function playCashout() {
  try {
    const ac    = getCtx()
    const freqs = [523, 659, 784, 880, 1047]
    freqs.forEach((freq, i) => {
      const t   = ac.currentTime + i * 0.075
      const osc = ac.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const g = ac.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
      osc.connect(g); g.connect(ac.destination)
      osc.start(t); osc.stop(t + 0.35)

      // Petit bruit métallique sur chaque note
      const ns = ac.createBufferSource()
      ns.buffer = noise(ac, 0.03)
      const nf = ac.createBiquadFilter()
      nf.type = 'highpass'; nf.frequency.value = 3500
      const ng = ac.createGain()
      ng.gain.setValueAtTime(0.08, t)
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      ns.connect(nf); nf.connect(ng); ng.connect(ac.destination)
      ns.start(t)
    })
  } catch {}
}

// ── Invocation (lancement de partie) ─────────────────────────────────────────

export function playInvoke() {
  try {
    const ac  = getCtx()
    const now = ac.currentTime

    // Swoosh montant
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.3)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.001, now)
    g.gain.linearRampToValueAtTime(0.22, now + 0.12)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
    osc.connect(g); g.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.34)

    // Bruit texturé
    const ns = ac.createBufferSource()
    ns.buffer = noise(ac, 0.25)
    const nf = ac.createBiquadFilter()
    nf.type = 'bandpass'; nf.frequency.value = 1200; nf.Q.value = 1.5
    const ng = ac.createGain()
    ng.gain.setValueAtTime(0.001, now)
    ng.gain.linearRampToValueAtTime(0.12, now + 0.08)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    ns.connect(nf); nf.connect(ng); ng.connect(ac.destination)
    ns.start(now)
  } catch {}
}

export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

// Synthèse sonore via Web Audio API — aucun fichier audio requis

let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

// Un bref tick (claquement de rouleau)
export function playTick() {
  try {
    const ac = getCtx()
    const buf = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3))
    }
    const src = ac.createBufferSource()
    src.buffer = buf
    const gain = ac.createGain()
    gain.gain.value = 0.18
    src.connect(gain)
    gain.connect(ac.destination)
    src.start()
  } catch {}
}

// Son d'arrêt (chaque rouleau qui s'immobilise)
export function playStop() {
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(90, ac.currentTime + 0.12)
    gain.gain.setValueAtTime(0.25, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + 0.18)
  } catch {}
}

// Near miss — notes descendantes, légère tension
export function playNearMiss() {
  try {
    const ac = getCtx()
    const notes = [440, 392, 330] // A4, G4, E4 — descente tendue
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const t = ac.currentTime + i * 0.13
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.14, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.25)
    })
  } catch {}
}

// Petit gain (×2) — deux notes vives, son de pièce
export function playSmallWin() {
  try {
    const ac = getCtx()
    const notes = [659, 880] // E5, A5
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const t = ac.currentTime + i * 0.09
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.28)
    })
  } catch {}
}

// Grand gain (×3) — fanfare ascendante 5 notes
export function playBigWin() {
  try {
    const ac = getCtx()
    const notes = [523, 659, 784, 1047, 1319] // C5, E5, G5, C6, E6
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const t = ac.currentTime + i * 0.09
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch {}
}

// Jackpot — accord d'ouverture + montée épique
export function playJackpot() {
  try {
    const ac = getCtx()

    // Accord initial C majeur
    ;[523, 659, 784].forEach(freq => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.18, ac.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.55)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + 0.6)
    })

    // Montée rapide sur 8 notes
    const run = [523, 659, 784, 880, 1047, 1175, 1319, 1568]
    run.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const t = ac.currentTime + 0.45 + i * 0.07
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.22)
    })

    // Note finale tenue
    const finT = ac.currentTime + 0.45 + 8 * 0.07
    ;[1568, 1976].forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const t = finT + i * 0.06
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.75)
    })
  } catch {}
}

// Résume le contexte audio (requis après interaction utilisateur sur certains navigateurs)
export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

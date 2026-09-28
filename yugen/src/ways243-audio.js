// Synthèse sonore Web Audio API — Oni 243 slot machine

let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

// Son de lancement des rouleaux (bourdonnement mécanique montant)
export function playSpinStart() {
  try {
    const ac = getCtx()
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(60, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.25)
    gain.gain.setValueAtTime(0.08, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + 0.3)
  } catch {}
}

// Cloc d'arrêt de colonne — pitch progressif (grave→aigu) selon l'index
export function playColStop(colIndex = 0) {
  try {
    const ac   = getCtx()
    const freq = 120 + colIndex * 28  // 120, 148, 176, 204, 232 Hz
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * 1.6, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq, ac.currentTime + 0.1)
    gain.gain.setValueAtTime(0.28, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + 0.2)

    // Impact court (bruit blanc amorti)
    const buf  = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.25))
    }
    const src  = ac.createBufferSource()
    const gn   = ac.createGain()
    src.buffer = buf
    gn.gain.value = 0.12
    src.connect(gn)
    gn.connect(ac.destination)
    src.start()
  } catch {}
}

// Petit gain
export function playWin() {
  try {
    const ac = getCtx()
    const notes = [523, 659, 784]  // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      const t    = ac.currentTime + i * 0.08
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.28)
    })
  } catch {}
}

// Big Win — fanfare 5 notes ascendante
export function playBigWin() {
  try {
    const ac    = getCtx()
    const notes = [523, 659, 784, 1047, 1319]  // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      const t    = ac.currentTime + i * 0.1
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.35)
    })
  } catch {}
}

// Mega Win — accord + montée rapide
export function playMegaWin() {
  try {
    const ac = getCtx()
    // Accord initial
    ;[392, 523, 659].forEach(freq => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.16, ac.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start()
      osc.stop(ac.currentTime + 0.55)
    })
    // Montée
    const run = [523, 659, 784, 988, 1175, 1319]
    run.forEach((freq, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      const t    = ac.currentTime + 0.35 + i * 0.07
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.25)
    })
  } catch {}
}

// Jackpot — ouverture épique
export function playJackpot() {
  try {
    const ac = getCtx()
    ;[261, 329, 392, 523].forEach((freq, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      const t    = ac.currentTime + i * 0.07
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.65)
    })
    const run = [523, 659, 784, 880, 1047, 1175, 1319, 1568]
    run.forEach((freq, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      const t    = ac.currentTime + 0.5 + i * 0.065
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.25)
    })
  } catch {}
}

// Perte — choc sourd
export function playLoss() {
  try {
    const ac = getCtx()
    const buf  = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.4)) * 0.6
    }
    const src  = ac.createBufferSource()
    const gain = ac.createGain()
    src.buffer = buf
    gain.gain.value = 0.22
    src.connect(gain)
    gain.connect(ac.destination)
    src.start()
  } catch {}
}

// Near miss — montée de tension (graves qui montent)
export function playNearMissStart(reelCount = 3) {
  try {
    const ac = getCtx()
    const freqs = reelCount >= 4
      ? [80, 100, 130, 160, 200]  // plus dramatique pour 4 reels
      : [80, 110, 150]
    freqs.forEach((freq, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      const t    = ac.currentTime + i * 0.14
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.linearRampToValueAtTime(freq * 1.1, t + 0.25)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch {}
}

// Near miss — crash final (descente brutale)
export function playNearMissCrash() {
  try {
    const ac = getCtx()
    // Bruit blanc court
    const buf  = ac.createBuffer(1, ac.sampleRate * 0.18, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3))
    }
    const src  = ac.createBufferSource()
    const gn   = ac.createGain()
    src.buffer = buf
    gn.gain.value = 0.35
    src.connect(gn)
    gn.connect(ac.destination)
    src.start()
    // Note descendante
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, ac.currentTime)
    osc.frequency.exponentialRampToValueAtTime(55, ac.currentTime + 0.22)
    gain.gain.setValueAtTime(0.2, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + 0.28)
  } catch {}
}

// Oni Jumeaux — son mystique (deux notes parallèles dérivantes)
export function playOniJumeaux() {
  try {
    const ac = getCtx()
    ;[220, 277].forEach((freq, idx) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ac.currentTime)
      osc.frequency.linearRampToValueAtTime(freq * 1.04, ac.currentTime + 0.6)
      gain.gain.setValueAtTime(0, ac.currentTime)
      gain.gain.linearRampToValueAtTime(0.15, ac.currentTime + 0.05)
      gain.gain.setValueAtTime(0.15, ac.currentTime + 0.4)
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.7)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start()
      osc.stop(ac.currentTime + 0.75)
    })
  } catch {}
}

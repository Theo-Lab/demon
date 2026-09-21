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

// Fanfare courte en cas de gain
export function playWin() {
  try {
    const ac = getCtx()
    const notes = [523, 659, 784, 1047] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      const t = ac.currentTime + i * 0.1
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.22)
    })
  } catch {}
}

// Résume le contexte audio (requis après interaction utilisateur sur certains navigateurs)
export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

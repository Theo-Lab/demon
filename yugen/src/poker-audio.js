let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

export function resumeAudio() {
  try { if (ctx?.state === 'suspended') ctx.resume() } catch {}
}

// Bruit blanc court → son de carte distribuée
export function playDeal(delayMs = 0) {
  try {
    const c = getCtx()
    const delay = delayMs / 1000
    const dur = 0.07
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
    const src = c.createBufferSource()
    src.buffer = buf
    const hpf = c.createBiquadFilter()
    hpf.type = 'highpass'; hpf.frequency.value = 1200
    const g = c.createGain(); g.gain.value = 0.28
    src.connect(hpf); hpf.connect(g); g.connect(c.destination)
    src.start(c.currentTime + delay)
  } catch {}
}

// Cliquetis de jeton céramique
export function playChip(delayMs = 0) {
  try {
    const c = getCtx()
    const t = c.currentTime + delayMs / 1000
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(700, t)
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.06)
    g.gain.setValueAtTime(0.28, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(g); g.connect(c.destination)
    osc.start(t); osc.stop(t + 0.12)
  } catch {}
}

// Plusieurs jetons (relance)
export function playChipStack(n = 3) {
  for (let i = 0; i < Math.min(n, 5); i++) playChip(i * 60)
}

// Son de retournement carte (flop/turn/river)
export function playFlip(delayMs = 0) {
  try {
    const c = getCtx()
    const delay = delayMs / 1000
    const dur = 0.09
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5)
    const src = c.createBufferSource()
    src.buffer = buf
    const bpf = c.createBiquadFilter()
    bpf.type = 'bandpass'; bpf.frequency.value = 1800; bpf.Q.value = 0.8
    const g = c.createGain(); g.gain.value = 0.32
    src.connect(bpf); bpf.connect(g); g.connect(c.destination)
    src.start(c.currentTime + delay)
  } catch {}
}

// Carte posée (fold)
export function playFold() {
  try {
    const c = getCtx()
    const dur = 0.14
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.035))
    const src = c.createBufferSource()
    src.buffer = buf
    const lpf = c.createBiquadFilter()
    lpf.type = 'lowpass'; lpf.frequency.value = 1500
    const g = c.createGain(); g.gain.value = 0.18
    src.connect(lpf); lpf.connect(g); g.connect(c.destination)
    src.start()
  } catch {}
}

// Notification : c'est votre tour
export function playYourTurn() {
  try {
    const c = getCtx()
    const t = c.currentTime
    ;[880, 1108].forEach((freq, i) => {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      const s = t + i * 0.12
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.18, s + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.45)
      osc.connect(g); g.connect(c.destination)
      osc.start(s); osc.stop(s + 0.48)
    })
  } catch {}
}

// Victoire
export function playWin() {
  try {
    const c = getCtx()
    const t = c.currentTime
    ;[523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'triangle'; osc.frequency.value = freq
      const s = t + i * 0.1
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.2, s + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.35)
      osc.connect(g); g.connect(c.destination)
      osc.start(s); osc.stop(s + 0.38)
    })
  } catch {}
}

// Défaite
export function playLose() {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(440, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.4)
    g.gain.setValueAtTime(0.15, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
    osc.connect(g); g.connect(c.destination)
    osc.start(); osc.stop(c.currentTime + 0.5)
  } catch {}
}

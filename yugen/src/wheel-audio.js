let actx = null

function getCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)()
  return actx
}

export function resumeAudio() {
  try { getCtx().resume() } catch {}
}

export function playTick() {
  try {
    const ctx = getCtx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'triangle'
    o.frequency.value = 900 + Math.random() * 300
    g.gain.setValueAtTime(0.06, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035)
    o.start(); o.stop(ctx.currentTime + 0.035)
  } catch {}
}

export function playResult(mult) {
  try {
    const ctx = getCtx()
    if (mult === 0) {
      // Perte : grondement descendant
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(160, ctx.currentTime)
      o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5)
      g.gain.setValueAtTime(0.18, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      o.start(); o.stop(ctx.currentTime + 0.55)
    } else if (mult >= 10) {
      // Gros gain : arpège ascendant
      const notes = [392, 523, 659, 784, 1047, 1319]
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = i < 3 ? 'sine' : 'triangle'
        o.frequency.value = freq
        const t = ctx.currentTime + i * 0.09
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.15, t + 0.05)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
        o.start(t); o.stop(t + 0.55)
      })
    } else if (mult >= 2) {
      // Gain moyen : 3 notes
      ;[523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = 'sine'
        o.frequency.value = freq
        const t = ctx.currentTime + i * 0.11
        g.gain.setValueAtTime(0.12, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
        o.start(t); o.stop(t + 0.4)
      })
    } else {
      // ×0.3 ou ×1 : ding simple
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = mult >= 1 ? 880 : 660
      g.gain.setValueAtTime(0.1, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      o.start(); o.stop(ctx.currentTime + 0.35)
    }
  } catch {}
}

'use strict'

// ── Identifiants des symboles ─────────────────────────────────────────────────

const SYM = {
  KUNAI:    'KUNAI',     // bas 1 — le plus fréquent
  MASQUE:   'MASQUE',    // bas 2
  TALISMAN: 'TALISMAN',  // bas 3
  FLEUR:    'FLEUR',     // bas 4 (haut des bas)
  HASHIRA:  'HASHIRA',   // haut 1
  KATANA:   'KATANA',    // haut 2
  DEMON:    'DEMON',     // haut 3 — le plus précieux
  WILD:     'WILD',      // wild — rouleaux 2, 3, 4 uniquement
}

const PAYING_SYMBOLS = ['KUNAI', 'MASQUE', 'TALISMAN', 'FLEUR', 'HASHIRA', 'KATANA', 'DEMON']

// ── Paytable ──────────────────────────────────────────────────────────────────
// Formule : gain = Math.floor( (mise / 243) × mult × ways )
// "ways" = produit des occurrences du symbole sur chaque rouleau consécutif

// Paytable v2 — calibré pour RTP ~91%
// win = floor( (mise / 243) × mult × ways )
// Les mults élevés compensent la division par 243 (243-ways oblige)
const PAYTABLE = {
  DEMON:    { 3: 60,  4: 240, 5: 1600 },
  KATANA:   { 3: 40,  4: 160, 5: 800  },
  HASHIRA:  { 3: 24,  4: 100, 5: 400  },
  FLEUR:    { 3: 15,  4: 57,  5: 226  },
  TALISMAN: { 3: 12,  4: 40,  5: 160  },
  MASQUE:   { 3: 8,   4: 24,  5: 100  },
  KUNAI:    { 3: 4,   4: 16,  5: 60   },
}

// ── Reel strips ───────────────────────────────────────────────────────────────
// Interleave greedy : évite les clusters de symboles identiques consécutifs.
// Le résultat est déterministe (config fixe, pas de random ici).

function buildStrip(counts) {
  const freq = {}
  for (const [sym, cnt] of Object.entries(counts)) {
    freq[sym] = cnt
  }
  const total = Object.values(freq).reduce((a, b) => a + b, 0)
  const result = []

  while (result.length < total) {
    const last = result[result.length - 1]
    const candidates = Object.entries(freq)
      .filter(([s, c]) => c > 0 && s !== last)
      .sort((a, b) => b[1] - a[1])

    const pick = candidates.length > 0
      ? candidates[0][0]
      : Object.keys(freq).find(s => freq[s] > 0)

    result.push(pick)
    freq[pick]--
  }
  return result
}

// 5 rouleaux, ~30 positions chacun
// Reel 0 et 4 : pas de WILD
// Reels 1, 2, 3 : WILD présent
const REEL_STRIPS = [
  // Reel 0 — 30 symboles, pas de WILD
  buildStrip({ KUNAI: 7, MASQUE: 6, TALISMAN: 5, FLEUR: 5, HASHIRA: 4, KATANA: 2, DEMON: 1 }),
  // Reel 1 — 30 symboles, WILD
  buildStrip({ KUNAI: 5, MASQUE: 5, TALISMAN: 4, FLEUR: 4, HASHIRA: 3, KATANA: 3, DEMON: 2, WILD: 4 }),
  // Reel 2 — 30 symboles, WILD
  buildStrip({ KUNAI: 5, MASQUE: 5, TALISMAN: 4, FLEUR: 4, HASHIRA: 3, KATANA: 3, DEMON: 2, WILD: 4 }),
  // Reel 3 — 30 symboles, WILD
  buildStrip({ KUNAI: 5, MASQUE: 5, TALISMAN: 4, FLEUR: 4, HASHIRA: 3, KATANA: 3, DEMON: 2, WILD: 4 }),
  // Reel 4 — 30 symboles, pas de WILD
  buildStrip({ KUNAI: 7, MASQUE: 6, TALISMAN: 5, FLEUR: 5, HASHIRA: 4, KATANA: 2, DEMON: 1 }),
]

// Validation au chargement (dev safety check)
for (let r = 0; r < 5; r++) {
  const len = REEL_STRIPS[r].length
  if (len !== 30) console.warn(`[slotConfig] ATTENTION : reel ${r} a ${len} positions (attendu 30)`)
}

// ── Oni Jumeaux (rouleaux jumeaux) ────────────────────────────────────────────
// Probabilité configurable de rendre N rouleaux adjacents identiques.
// Les rouleaux jumeaux utilisent le strip du premier rouleau du groupe.

const ONI_JUMEAUX = {
  triggerProb: 0.15,   // 15% de chance par spin
  variants: [
    { count: 2, weight: 70 },  // 2 rouleaux adjacents
    { count: 3, weight: 20 },  // 3 rouleaux adjacents
    { count: 4, weight: 8  },  // 4 rouleaux adjacents
    { count: 5, weight: 2  },  // tous les rouleaux
  ],
}

// ── Limites ───────────────────────────────────────────────────────────────────

const MISE_MIN           = 500
const MISE_MAX           = 500_000
const GAIN_JOURNALIER_MAX = 3_000_000

// ── Paliers Big Win ───────────────────────────────────────────────────────────

const BIG_WIN_TIERS = [
  { name: 'JACKPOT',  minMult: 50 },
  { name: 'MEGA_WIN', minMult: 20 },
  { name: 'BIG_WIN',  minMult: 8  },
  { name: 'WIN',      minMult: 3  },
]

module.exports = {
  SYM, PAYING_SYMBOLS, PAYTABLE,
  REEL_STRIPS, ONI_JUMEAUX,
  MISE_MIN, MISE_MAX, GAIN_JOURNALIER_MAX,
  BIG_WIN_TIERS,
}

const db = require('../db')

// ── Deck ──────────────────────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14]
const RANK_NOM = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A' }
const RED_SUITS = new Set(['♥','♦'])

function makeDeck() {
  return SUITS.flatMap(suit => RANKS.map(rank => ({
    rank, suit, nom: `${RANK_NOM[rank]}${suit}`, red: RED_SUITS.has(suit),
  })))
}

function shuffle(deck) {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// ── Hand evaluation ───────────────────────────────────────────────────────────

function combos5(cards) {
  const r = [], n = cards.length
  for (let a=0;a<n-4;a++) for (let b=a+1;b<n-3;b++) for (let c=b+1;c<n-2;c++)
    for (let d=c+1;d<n-1;d++) for (let e=d+1;e<n;e++) r.push([cards[a],cards[b],cards[c],cards[d],cards[e]])
  return r
}

function eval5(cards) {
  const ranks = cards.map(c => c.rank).sort((a,b) => b-a)
  const suits = cards.map(c => c.suit)
  const flush = suits.every(s => s === suits[0])
  const uniq = [...new Set(ranks)].sort((a,b) => b-a)
  let straight = false, sHigh = 0
  if (uniq.length === 5) {
    if (uniq[0]-uniq[4] === 4) { straight = true; sHigh = uniq[0] }
    else if (uniq[0] === 14 && uniq[1] === 5) { straight = true; sHigh = 5 }
  }
  const cnt = {}
  for (const r of ranks) cnt[r] = (cnt[r]||0)+1
  const g = Object.entries(cnt).map(([r,c]) => [+r,c]).sort((a,b) => b[1]-a[1] || b[0]-a[0])
  if (flush && straight) return [8, sHigh]
  if (g[0][1]===4) return [7, g[0][0], g[1][0]]
  if (g[0][1]===3 && g[1][1]===2) return [6, g[0][0], g[1][0]]
  if (flush) return [5, ...ranks]
  if (straight) return [4, sHigh]
  if (g[0][1]===3) return [3, g[0][0], g[1][0], g[2][0]]
  if (g[0][1]===2 && g[1][1]===2) return [2, g[0][0], g[1][0], g[2][0]]
  if (g[0][1]===2) return [1, g[0][0], g[1][0], g[2][0], g[3][0]]
  return [0, ...ranks]
}

function cmpScore(a, b) {
  for (let i=0; i<Math.max(a.length,b.length); i++) { const d=(a[i]||0)-(b[i]||0); if(d) return d }
  return 0
}

const HAND_NAMES = ['Haute carte','Paire','Double paire','Brelan','Suite','Couleur','Full House','Carré','Quinte Flush']

function bestHand(cards7) {
  if (cards7.length < 5) return { score: [0,0], cards: cards7, name: HAND_NAMES[0] }
  let best = null
  for (const five of combos5(cards7)) {
    const score = eval5(five)
    if (!best || cmpScore(score, best.score) > 0) best = { score, cards: five }
  }
  return { ...best, name: HAND_NAMES[best.score[0]] }
}

// ── In-memory game state ──────────────────────────────────────────────────────

const tables = new Map()
let nextId = 1

// player status: 'waiting' | 'active' | 'folded'
// table status: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

function createTable({ name, smallBlind, bigBlind, maxPlayers }) {
  if (smallBlind < 100) throw new Error('Small blind minimum : 100 ¥.')
  if (bigBlind !== smallBlind * 2) throw new Error('Big blind = 2 × small blind.')
  if (maxPlayers < 2 || maxPlayers > 8) throw new Error('2–8 joueurs maximum.')
  const id = nextId++
  tables.set(id, {
    id, name, smallBlind, bigBlind, maxPlayers,
    status: 'waiting',
    players: [],
    communityCards: [],
    pot: 0, currentBet: 0,
    dealerIdx: -1, actionIdx: -1,
    sbIdx: -1, bbIdx: -1,
    hasActed: new Set(),
    deck: [],
    handResult: null,
  })
  return id
}

function getTable(id) {
  const t = tables.get(id)
  if (!t) throw new Error('Table introuvable.')
  return t
}

function listTables() {
  return [...tables.values()].map(t => ({
    id: t.id, name: t.name,
    smallBlind: t.smallBlind, bigBlind: t.bigBlind,
    maxPlayers: t.maxPlayers,
    playerCount: t.players.length,
    status: t.status,
  }))
}

function joinTable(tableId, userId, nom, buyIn) {
  const t = getTable(tableId)
  if (t.status !== 'waiting') throw new Error('Partie en cours, attendez la prochaine main.')
  if (t.players.length >= t.maxPlayers) throw new Error('Table complète.')
  if (t.players.some(p => p.userId === userId)) throw new Error('Vous êtes déjà à cette table.')
  const min = t.bigBlind * 10, max = t.bigBlind * 200
  if (buyIn < min || buyIn > max) throw new Error(`Buy-in : ${min.toLocaleString()}–${max.toLocaleString()} ¥.`)
  const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
  if (!user || user.solde < buyIn) throw new Error('Solde insuffisant.')
  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(buyIn, userId)
  t.players.push({ userId, nom, chips: buyIn, cards: [], bet: 0, totalBet: 0, status: 'waiting' })
  return { solde: user.solde - buyIn }
}

function cashOut(tableId, userId) {
  const t = getTable(tableId)
  if (t.status !== 'waiting') throw new Error('Impossible de partir pendant une main.')
  const idx = t.players.findIndex(p => p.userId === userId)
  if (idx === -1) throw new Error('Vous n\'êtes pas à cette table.')
  const player = t.players[idx]
  db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(player.chips, userId)
  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
  t.players.splice(idx, 1)
  if (t.players.length === 0) tables.delete(tableId)
  return { chips: player.chips, solde }
}

// ── Hand management ───────────────────────────────────────────────────────────

function findNextActive(t, fromIdx) {
  const n = t.players.length
  for (let i = 0; i < n; i++) {
    const idx = (fromIdx + i) % n
    if (t.players[idx]?.status === 'active') return idx
  }
  return -1
}

function roundOver(t) {
  const active = t.players.filter(p => p.status === 'active')
  if (active.length === 0) return true
  return active.every(p => p.bet === t.currentBet && t.hasActed.has(p.userId))
}

function startHand(tableId) {
  const t = getTable(tableId)
  if (t.players.length < 2) throw new Error('Il faut au moins 2 joueurs.')

  t.status = 'preflop'
  t.communityCards = []
  t.pot = 0; t.currentBet = 0
  t.hasActed = new Set()
  t.handResult = null
  t.deck = shuffle(makeDeck())

  for (const p of t.players) {
    p.cards = [t.deck.pop(), t.deck.pop()]
    p.bet = 0; p.totalBet = 0; p.status = 'active'
  }

  const n = t.players.length
  t.dealerIdx = (t.dealerIdx + 1) % n
  t.sbIdx = n === 2 ? t.dealerIdx : (t.dealerIdx + 1) % n
  t.bbIdx = (t.sbIdx + 1) % n

  const postBlind = (idx, amount) => {
    const p = t.players[idx]
    const post = Math.min(amount, p.chips)
    p.chips -= post; p.bet = post; p.totalBet = post; t.pot += post
  }
  postBlind(t.sbIdx, t.smallBlind)
  postBlind(t.bbIdx, t.bigBlind)
  t.currentBet = t.bigBlind

  // Pre-flop: UTG (after BB) acts first; heads-up: SB acts first
  const utgIdx = n === 2 ? t.sbIdx : (t.bbIdx + 1) % n
  t.actionIdx = findNextActive(t, utgIdx)
}

function playerAction(tableId, userId, act, raiseAmount) {
  const t = getTable(tableId)
  if (!['preflop','flop','turn','river'].includes(t.status))
    throw new Error('Pas en phase de mise.')
  const p = t.players[t.actionIdx]
  if (!p || p.userId !== userId) throw new Error("Ce n'est pas votre tour.")
  if (p.status !== 'active') throw new Error('Vous ne pouvez plus agir.')

  if (act === 'fold') {
    p.status = 'folded'
    t.hasActed.add(userId)
  } else if (act === 'check') {
    if (p.bet < t.currentBet)
      throw new Error(`Vous devez suivre ${(t.currentBet - p.bet).toLocaleString()} ¥ ou vous coucher.`)
    t.hasActed.add(userId)
  } else if (act === 'call') {
    const toCall = t.currentBet - p.bet
    if (toCall <= 0) throw new Error('Rien à suivre, utilisez check.')
    if (p.chips < toCall) throw new Error(`Jetons insuffisants (${toCall.toLocaleString()} ¥ requis).`)
    p.chips -= toCall; p.bet += toCall; p.totalBet += toCall; t.pot += toCall
    t.hasActed.add(userId)
  } else if (act === 'raise') {
    const amt = Math.floor(parseInt(raiseAmount))
    if (!amt || amt < t.bigBlind) throw new Error(`Relance minimum : ${t.bigBlind.toLocaleString()} ¥.`)
    const totalBet = t.currentBet + amt
    const toAdd = totalBet - p.bet
    if (p.chips < toAdd) throw new Error(`Jetons insuffisants (${toAdd.toLocaleString()} ¥ requis).`)
    p.chips -= toAdd; p.bet += toAdd; p.totalBet += toAdd; t.pot += toAdd
    t.currentBet = p.bet
    t.hasActed = new Set([userId])
  } else {
    throw new Error('Action inconnue.')
  }

  // Advance to next active player
  const next = findNextActive(t, (t.actionIdx + 1) % t.players.length)
  if (next !== -1) t.actionIdx = next

  const nonFolded = t.players.filter(p => p.status !== 'folded').length
  return {
    roundOver: roundOver(t) || nonFolded <= 1,
    onlyOneLeft: nonFolded <= 1,
  }
}

function advancePhase(tableId) {
  const t = getTable(tableId)
  const nonFolded = t.players.filter(p => p.status !== 'folded')
  if (nonFolded.length <= 1) return resolveHand(tableId, true)

  // Reset bets
  for (const p of t.players) p.bet = 0
  t.currentBet = 0
  t.hasActed = new Set()

  if (t.status === 'preflop') {
    t.status = 'flop'
    t.communityCards.push(t.deck.pop(), t.deck.pop(), t.deck.pop())
  } else if (t.status === 'flop') {
    t.status = 'turn'
    t.communityCards.push(t.deck.pop())
  } else if (t.status === 'turn') {
    t.status = 'river'
    t.communityCards.push(t.deck.pop())
  } else {
    return resolveHand(tableId, false)
  }

  const n = t.players.length
  t.actionIdx = findNextActive(t, (t.dealerIdx + 1) % n)
  return { resolved: false }
}

function resolveHand(tableId, noShowdown = false) {
  const t = getTable(tableId)
  t.status = 'showdown'

  const contenders = t.players.filter(p => p.status !== 'folded')
  let playerResults, winners

  if (contenders.length === 1 || noShowdown) {
    winners = [contenders[0]]
    playerResults = contenders.map(p => ({ player: p, handName: null }))
  } else {
    playerResults = contenders.map(p => {
      const allCards = [...p.cards, ...t.communityCards]
      const bh = bestHand(allCards)
      return { player: p, handName: bh.name, score: bh.score }
    })
    let bestScore = playerResults[0].score
    for (const r of playerResults) if (cmpScore(r.score, bestScore) > 0) bestScore = r.score
    const topList = playerResults.filter(r => cmpScore(r.score, bestScore) === 0)
    winners = topList.map(r => r.player)
  }

  // Split pot
  const share = Math.floor(t.pot / winners.length)
  const rem = t.pot - share * winners.length
  for (let i = 0; i < winners.length; i++) {
    winners[i].chips += share + (i === 0 ? rem : 0)
  }

  // Log game_rounds
  for (const { player: p, handName } of playerResults) {
    const isWinner = winners.some(w => w.userId === p.userId)
    const winAmt = isWinner ? (share + (winners[0].userId === p.userId ? rem : 0)) : 0
    try {
      db.prepare(`
        INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
        VALUES (?, 'poker', ?, ?, ?, 0, 0)
      `).run(
        p.userId, p.totalBet,
        JSON.stringify({ handName, community: t.communityCards, pot: t.pot, winners: winners.map(w => w.nom) }),
        winAmt - p.totalBet,
      )
    } catch {}
  }

  t.handResult = {
    winners: winners.map(w => ({ userId: w.userId, nom: w.nom })),
    players: playerResults.map(({ player: p, handName }) => ({
      userId: p.userId, nom: p.nom, cards: p.cards, handName,
    })),
    communityCards: t.communityCards,
    pot: t.pot,
  }

  return t.handResult
}

function resetForNextHand(tableId) {
  const t = getTable(tableId)
  const busted = t.players.filter(p => p.chips <= 0).map(p => p.userId)
  t.players = t.players.filter(p => p.chips > 0)
  t.status = 'waiting'
  t.communityCards = []
  t.pot = 0; t.currentBet = 0
  t.handResult = null
  t.hasActed = new Set()
  for (const p of t.players) {
    p.cards = []; p.bet = 0; p.totalBet = 0; p.status = 'waiting'
  }
  return { busted }
}

function getTableState(tableId, forUserId) {
  const t = getTable(tableId)
  return {
    id: t.id, name: t.name,
    smallBlind: t.smallBlind, bigBlind: t.bigBlind,
    maxPlayers: t.maxPlayers, status: t.status,
    pot: t.pot, currentBet: t.currentBet,
    dealerIdx: t.dealerIdx, sbIdx: t.sbIdx, bbIdx: t.bbIdx,
    actionIdx: t.actionIdx,
    activeUserId: t.actionIdx >= 0 ? (t.players[t.actionIdx]?.userId ?? null) : null,
    communityCards: t.communityCards,
    handResult: t.handResult,
    players: t.players.map((p, i) => ({
      userId: p.userId, nom: p.nom, chips: p.chips, bet: p.bet,
      status: p.status, seatIdx: i,
      isDealer: i === t.dealerIdx,
      isSB: i === t.sbIdx,
      isBB: i === t.bbIdx,
      cards: (t.status === 'showdown' || p.userId === forUserId) ? p.cards : p.cards.map(() => null),
    })),
  }
}

module.exports = {
  createTable, listTables, getTable, tables,
  joinTable, cashOut,
  startHand, playerAction, advancePhase, resolveHand, resetForNextHand,
  getTableState,
}

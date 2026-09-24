const db = require('../db')

function getWebhook() {
  try {
    const config = db.prepare('SELECT discord_webhook FROM slots_config WHERE id = 1').get()
    return config?.discord_webhook || ''
  } catch { return '' }
}

function fmt(n) {
  return Number(n).toLocaleString('fr-FR') + ' ¥'
}

function post(payload) {
  const url = getWebhook()
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

function logSpin({ playerName, playerIdentifiant, type, multiplicateur, gain, solde }) {
  if (type === 'none') return // pas de log pour les pertes

  let title, color
  if (type === 'jackpot') {
    title = '🎰  Jackpot'
    color = 0xFFD700  // or
  } else if (type.startsWith('three')) {
    title = '🎲  Victoire'
    color = 0xC87070  // rouge clair
  } else {
    title = '🎲  Petite victoire'
    color = 0x8B4040  // rouge sombre
  }

  post({
    embeds: [{
      title,
      color,
      fields: [
        { name: 'Joueur',        value: `${playerName} · \`${playerIdentifiant}\``, inline: false },
        { name: 'Gain',          value: fmt(gain),           inline: true },
        { name: 'Multiplicateur', value: `×${multiplicateur}`, inline: true },
        { name: 'Solde après',   value: fmt(solde),           inline: true },
      ],
      footer:    { text: 'Casino de l\'Ordre — Slots' },
      timestamp: new Date().toISOString(),
    }],
  })
}

function logSolde({ playerName, playerIdentifiant, operation, montant, soldeBefore, soldeAfter, adminName }) {
  const isAdd    = operation === 'add'
  const isRemove = operation === 'remove'
  const title    = isAdd ? '💰  Dépôt' : isRemove ? '💸  Retrait' : '⚖  Ajustement'
  const color    = isAdd ? 0x43B581 : isRemove ? 0xE74C3C : 0x7289DA
  const montantFmt = (isAdd ? '+' : isRemove ? '−' : '') + fmt(montant)

  post({
    embeds: [{
      title,
      color,
      fields: [
        { name: 'Joueur',       value: `${playerName} · \`${playerIdentifiant}\``, inline: false },
        { name: 'Montant',      value: montantFmt,    inline: true },
        { name: 'Solde avant',  value: fmt(soldeBefore), inline: true },
        { name: 'Solde après',  value: fmt(soldeAfter),  inline: true },
        { name: 'Par',          value: adminName,     inline: false },
      ],
      footer:    { text: 'Casino de l\'Ordre — Gestion solde' },
      timestamp: new Date().toISOString(),
    }],
  })
}

function logTest(adminName) {
  post({
    embeds: [{
      title: '✅  Webhook configuré',
      color: 0x43B581,
      description: 'Le webhook Discord du Casino de l\'Ordre fonctionne correctement.',
      fields: [{ name: 'Configuré par', value: adminName, inline: true }],
      footer:    { text: 'Casino de l\'Ordre' },
      timestamp: new Date().toISOString(),
    }],
  })
}

module.exports = { logSpin, logSolde, logTest }

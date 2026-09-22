const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const db = new Database('./yugen.db')

// WAL : gère la concurrence des écritures sans bloquer les lectures
db.pragma('journal_mode = WAL')

// Schéma
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    identifiant TEXT UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL,
    nom         TEXT NOT NULL,
    grade       TEXT DEFAULT '',
    role        TEXT DEFAULT 'membre',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS spheres (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    chef_id     INTEGER REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pouvoirs (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nom  TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_spheres (
    user_id   INTEGER REFERENCES users(id),
    sphere_id INTEGER REFERENCES spheres(id),
    grade     TEXT DEFAULT '',
    PRIMARY KEY (user_id, sphere_id)
  );

  CREATE TABLE IF NOT EXISTS user_pouvoir (
    user_id    INTEGER UNIQUE REFERENCES users(id),
    pouvoir_id INTEGER REFERENCES pouvoirs(id),
    grade      TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS sphere_grades (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    sphere_id INTEGER NOT NULL REFERENCES spheres(id),
    nom       TEXT NOT NULL,
    ordre     INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    auteur_id  INTEGER NOT NULL REFERENCES users(id),
    titre      TEXT NOT NULL,
    doc_titre  TEXT NOT NULL,
    contenu    TEXT NOT NULL DEFAULT '[]',
    token      TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parchemins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    auteur_id  INTEGER NOT NULL REFERENCES users(id),
    titre      TEXT NOT NULL,
    doc_titre  TEXT NOT NULL,
    contenu    TEXT NOT NULL DEFAULT '[]',
    token      TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rapports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    auteur_id  INTEGER NOT NULL REFERENCES users(id),
    type       TEXT NOT NULL CHECK(type IN ('mission', 'journalier', 'sphere')),
    titre      TEXT NOT NULL,
    contenu    TEXT NOT NULL,
    statut     TEXT DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'valide', 'refuse')),
    brouillon  INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Seed des comptes de base si vides
const count = db.prepare('SELECT COUNT(*) as n FROM users').get()
if (count.n === 0) {
  const hash = (mdp) => bcrypt.hashSync(mdp, 10)
  const insert = db.prepare(`
    INSERT INTO users (identifiant, mot_de_passe, nom, grade, role)
    VALUES (?, ?, ?, ?, ?)
  `)
  insert.run('muzan',   hash('sangoriginel'), 'Muzan',   'Démon Originel',    'admin')
  insert.run('akaza',   hash('lune3'),        'Akaza',   'Lune Supérieure 3', 'membre')
  insert.run('daki',    hash('lune6'),        'Daki',    'Lune Supérieure 6', 'membre')
  insert.run('gyutaro', hash('lune6'),        'Gyutaro', 'Lune Supérieure 6', 'membre')
}

// Tables casino
db.exec(`
  CREATE TABLE IF NOT EXISTS game_rounds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    jeu         TEXT NOT NULL CHECK(jeu IN ('roulette', 'slots', 'blackjack', 'expedition')),
    mise        INTEGER NOT NULL,
    resultat    TEXT NOT NULL DEFAULT '{}',
    gain_net    INTEGER NOT NULL,
    solde_avant INTEGER NOT NULL,
    solde_apres INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    token      TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Nettoyer les refresh tokens expirés au démarrage
db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run()

// Tables slots
db.exec(`
  CREATE TABLE IF NOT EXISTS slots_symbols (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nom        TEXT NOT NULL,
    image_url  TEXT NOT NULL DEFAULT '',
    poids      INTEGER NOT NULL DEFAULT 10,
    mult_2     REAL NOT NULL DEFAULT 2,
    mult_3     REAL NOT NULL DEFAULT 10,
    actif      INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS slots_config (
    id        INTEGER PRIMARY KEY CHECK(id = 1),
    mise_min  INTEGER NOT NULL DEFAULT 10000,
    mise_max  INTEGER NOT NULL DEFAULT 1000000
  );
`)
db.prepare('INSERT OR IGNORE INTO slots_config (id, mise_min, mise_max) VALUES (1, 10000, 1000000)').run()

// Table logs solde admin
db.exec(`
  CREATE TABLE IF NOT EXISTS solde_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    admin_id    INTEGER NOT NULL REFERENCES users(id),
    operation   TEXT NOT NULL CHECK(operation IN ('add','remove','set')),
    montant     INTEGER NOT NULL,
    gain_net    INTEGER NOT NULL,
    solde_avant INTEGER NOT NULL,
    solde_apres INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Tables blackjack lobby multijoueur
db.exec(`
  CREATE TABLE IF NOT EXISTS bj_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    statut TEXT DEFAULT 'attente',
    siege_actif INTEGER DEFAULT NULL,
    deck TEXT DEFAULT '[]',
    main_dealer TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bj_sieges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL REFERENCES bj_tables(id),
    numero INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(id),
    user_nom TEXT DEFAULT NULL,
    mise INTEGER DEFAULT 0,
    main TEXT DEFAULT '[]',
    statut TEXT DEFAULT 'vide',
    resultat TEXT DEFAULT NULL,
    gain_net INTEGER DEFAULT 0,
    UNIQUE(table_id, numero)
  );
`)

// Seed des 3 tables et leurs 4 sièges
const bjTableCount = db.prepare('SELECT COUNT(*) as n FROM bj_tables').get()
if (bjTableCount.n === 0) {
  for (let t = 1; t <= 3; t++) {
    const tableId = db.prepare('INSERT INTO bj_tables DEFAULT VALUES').run().lastInsertRowid
    for (let s = 1; s <= 4; s++) {
      db.prepare('INSERT OR IGNORE INTO bj_sieges (table_id, numero) VALUES (?, ?)').run(tableId, s)
    }
  }
}

// Table blackjack
db.exec(`
  CREATE TABLE IF NOT EXISTS blackjack_games (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    statut      TEXT NOT NULL DEFAULT 'en_cours' CHECK(statut IN ('en_cours', 'fini')),
    mise        INTEGER NOT NULL,
    mise_double INTEGER NOT NULL DEFAULT 0,
    solde_avant INTEGER NOT NULL,
    main_joueur TEXT NOT NULL DEFAULT '[]',
    main_dealer TEXT NOT NULL DEFAULT '[]',
    deck        TEXT NOT NULL DEFAULT '[]',
    resultat    TEXT DEFAULT NULL,
    gain_net    INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Tables paris
db.exec(`
  CREATE TABLE IF NOT EXISTS paris (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    titre             TEXT NOT NULL,
    description       TEXT DEFAULT '',
    statut            TEXT DEFAULT 'ouvert' CHECK(statut IN ('ouvert', 'resolu')),
    issue_gagnante_id INTEGER REFERENCES paris_issues(id),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS paris_issues (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    pari_id INTEGER NOT NULL REFERENCES paris(id) ON DELETE CASCADE,
    label   TEXT NOT NULL,
    cote    REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS paris_mises (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pari_id     INTEGER NOT NULL REFERENCES paris(id) ON DELETE CASCADE,
    joueur_nom  TEXT NOT NULL,
    issue_id    INTEGER NOT NULL REFERENCES paris_issues(id),
    montant     INTEGER NOT NULL
  );
`)

// Migration bj_sieges : colonne user_nom (ajoutée après création initiale de la table)
try { db.exec(`ALTER TABLE bj_sieges ADD COLUMN user_nom TEXT DEFAULT NULL`) } catch {}

// Migrations colonnes rapports
try { db.exec(`ALTER TABLE rapports ADD COLUMN token TEXT`) } catch {}
try { db.exec(`ALTER TABLE rapports ADD COLUMN brouillon INTEGER NOT NULL DEFAULT 0`) } catch {}

// Migration colonne users
try { db.exec(`ALTER TABLE users ADD COLUMN pouvoir_nom TEXT DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN signature TEXT DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN solde INTEGER DEFAULT 1000`) } catch {}
db.exec(`UPDATE users SET solde = 1000 WHERE solde IS NULL`)

// Migration paris_mises : remplacer user_id par joueur_nom
const misesCols = db.prepare(`PRAGMA table_info(paris_mises)`).all().map(c => c.name)
if (misesCols.includes('user_id')) {
  db.exec(`
    DROP TABLE IF EXISTS paris_mises;
    CREATE TABLE paris_mises (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      pari_id     INTEGER NOT NULL REFERENCES paris(id) ON DELETE CASCADE,
      joueur_nom  TEXT NOT NULL,
      issue_id    INTEGER NOT NULL REFERENCES paris_issues(id),
      montant     INTEGER NOT NULL
    );
  `)
}

// Génère un token pour les rapports qui n'en ont pas
const crypto = require('crypto')
const sansToken = db.prepare(`SELECT id FROM rapports WHERE token IS NULL`).all()
const setToken = db.prepare(`UPDATE rapports SET token = ? WHERE id = ?`)
for (const r of sansToken) {
  setToken.run(crypto.randomBytes(6).toString('hex'), r.id)
}

module.exports = db

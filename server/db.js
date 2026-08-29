const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

const db = new Database('./yugen.db')

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

  CREATE TABLE IF NOT EXISTS rapports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    auteur_id  INTEGER NOT NULL REFERENCES users(id),
    type       TEXT NOT NULL CHECK(type IN ('mission', 'journalier', 'sphere')),
    titre      TEXT NOT NULL,
    contenu    TEXT NOT NULL,
    statut     TEXT DEFAULT 'en_attente' CHECK(statut IN ('en_attente', 'valide', 'refuse')),
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

// Ajout colonne token si elle n'existe pas encore
try { db.exec(`ALTER TABLE rapports ADD COLUMN token TEXT`) } catch {}

// Génère un token pour les rapports qui n'en ont pas
const crypto = require('crypto')
const sansToken = db.prepare(`SELECT id FROM rapports WHERE token IS NULL`).all()
const setToken = db.prepare(`UPDATE rapports SET token = ? WHERE id = ?`)
for (const r of sansToken) {
  setToken.run(crypto.randomBytes(6).toString('hex'), r.id)
}

module.exports = db

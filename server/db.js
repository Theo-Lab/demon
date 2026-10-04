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
    jeu         TEXT NOT NULL,
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

// Migration : is_wild (ajout non-destructif)
try { db.prepare('ALTER TABLE slots_symbols ADD COLUMN is_wild INTEGER NOT NULL DEFAULT 0').run() } catch {}
// Migration : discord_webhook
try { db.prepare("ALTER TABLE slots_config ADD COLUMN discord_webhook TEXT NOT NULL DEFAULT ''").run() } catch {}
// Migration : crossroad_bust_prob
try { db.prepare('ALTER TABLE slots_config ADD COLUMN crossroad_bust_prob REAL NOT NULL DEFAULT 0.12').run() } catch {}
// Migrations : activation des jeux
try { db.prepare('ALTER TABLE slots_config ADD COLUMN slots_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}
try { db.prepare('ALTER TABLE slots_config ADD COLUMN blackjack_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}
// Migrations blackjack limits
try { db.prepare('ALTER TABLE slots_config ADD COLUMN bj_solo_mise_min INTEGER NOT NULL DEFAULT 500').run() } catch {}
try { db.prepare('ALTER TABLE slots_config ADD COLUMN bj_solo_mise_max INTEGER NOT NULL DEFAULT 500000').run() } catch {}
try { db.prepare('ALTER TABLE bj_tables ADD COLUMN mise_min INTEGER NOT NULL DEFAULT 500').run() } catch {}
try { db.prepare('ALTER TABLE bj_tables ADD COLUMN mise_max INTEGER NOT NULL DEFAULT 500000').run() } catch {}
try { db.prepare('ALTER TABLE slots_config ADD COLUMN roulette_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}
try { db.prepare('ALTER TABLE slots_config ADD COLUMN crossroad_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}
try { db.prepare('ALTER TABLE slots_config ADD COLUMN mines_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}
try { db.prepare('ALTER TABLE slots_config ADD COLUMN wheel_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}

// Table mines
db.exec(`
  CREATE TABLE IF NOT EXISTS mines_games (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id),
    statut             TEXT NOT NULL DEFAULT 'en_cours',
    mise               INTEGER NOT NULL,
    nb_mines           INTEGER NOT NULL,
    mines_positions    TEXT NOT NULL,
    revealed_positions TEXT NOT NULL DEFAULT '[]',
    solde_avant        INTEGER NOT NULL,
    gain_net           INTEGER NOT NULL DEFAULT 0,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

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

// Table traversée démoniaque
db.exec(`
  CREATE TABLE IF NOT EXISTS crossroad_games (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    statut         TEXT    NOT NULL DEFAULT 'en_cours',
    mise           INTEGER NOT NULL,
    lane_actuelle  INTEGER NOT NULL DEFAULT 0,
    lane_mort      INTEGER,
    solde_avant    INTEGER NOT NULL,
    gain_net       INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Migration bj_sieges : colonne user_nom (ajoutée après création initiale de la table)
try { db.exec(`ALTER TABLE bj_sieges ADD COLUMN user_nom TEXT DEFAULT NULL`) } catch {}
try { db.exec(`ALTER TABLE bj_sieges ADD COLUMN mise_initiale INTEGER NOT NULL DEFAULT 0`) } catch {}

// Migrations colonnes rapports
try { db.exec(`ALTER TABLE rapports ADD COLUMN token TEXT`) } catch {}
try { db.exec(`ALTER TABLE rapports ADD COLUMN brouillon INTEGER NOT NULL DEFAULT 0`) } catch {}

// Migration colonne users
try { db.exec(`ALTER TABLE users ADD COLUMN pouvoir_nom TEXT DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN malchance INTEGER NOT NULL DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN malchance_prob REAL NOT NULL DEFAULT 0.60`) } catch {}

// Table logs malchance
db.exec(`
  CREATE TABLE IF NOT EXISTS malchance_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    jeu        TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)
try { db.exec(`ALTER TABLE users ADD COLUMN signature TEXT DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN solde INTEGER DEFAULT 1000`) } catch {}
db.exec(`UPDATE users SET solde = 1000 WHERE solde IS NULL`)

// Migrations paris : mise_min, mise_max
try { db.exec(`ALTER TABLE paris ADD COLUMN mise_min INTEGER DEFAULT 100`) } catch {}
try { db.exec(`ALTER TABLE paris ADD COLUMN mise_max INTEGER DEFAULT NULL`) } catch {}

// Migrations paris_mises : user_id
try { db.exec(`ALTER TABLE paris_mises ADD COLUMN user_id INTEGER REFERENCES users(id)`) } catch {}

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

// Table Demon's Gate sessions
db.exec(`
  CREATE TABLE IF NOT EXISTS demons_gate_sessions (
    user_id              INTEGER PRIMARY KEY,
    flame_count          INTEGER DEFAULT 0,
    gate_level           INTEGER DEFAULT 1,
    free_spins_remaining INTEGER DEFAULT 0,
    fs_mult_accumulated  INTEGER DEFAULT 1,
    respin_active        INTEGER DEFAULT 0,
    respin_held          TEXT    DEFAULT '[]',
    current_mise         INTEGER DEFAULT 0,
    solde_avant          INTEGER DEFAULT 0,
    chain_count          INTEGER DEFAULT 0,
    credits              INTEGER DEFAULT 0,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)
try { db.exec('ALTER TABLE demons_gate_sessions ADD COLUMN chain_count INTEGER DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE demons_gate_sessions ADD COLUMN credits INTEGER DEFAULT 0') } catch {}

// Table Demon's Gate symboles
db.exec(`
  CREATE TABLE IF NOT EXISTS dg_symbols (
    sym  TEXT PRIMARY KEY,
    url  TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT ''
  )
`)

// Migration game_rounds : supprimer la contrainte CHECK sur jeu
try {
  const cols = db.prepare("PRAGMA table_info(game_rounds)").all()
  const jeuCol = cols.find(c => c.name === 'jeu')
  // Si la contrainte CHECK existe encore (détectable via sql de la table)
  const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='game_rounds'").get()
  if (tableSql && tableSql.sql && tableSql.sql.includes('CHECK')) {
    db.exec(`
      ALTER TABLE game_rounds RENAME TO game_rounds_old;
      CREATE TABLE game_rounds (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id),
        jeu         TEXT NOT NULL,
        mise        INTEGER NOT NULL,
        resultat    TEXT NOT NULL DEFAULT '{}',
        gain_net    INTEGER NOT NULL,
        solde_avant INTEGER NOT NULL,
        solde_apres INTEGER NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO game_rounds SELECT * FROM game_rounds_old;
      DROP TABLE game_rounds_old;
    `)
  }
} catch {}

// Table logs crédits Demon's Gate (buy-in / cashout)
db.exec(`
  CREATE TABLE IF NOT EXISTS dg_credits_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL CHECK(type IN ('buy', 'cashout')),
    credits     INTEGER NOT NULL,
    montant_yen INTEGER NOT NULL,
    solde_avant INTEGER NOT NULL,
    solde_apres INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Table Corps Démoniaque (jeu de gonflage / crash)
db.exec(`
  CREATE TABLE IF NOT EXISTS corps_games (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    statut      TEXT NOT NULL DEFAULT 'en_cours' CHECK(statut IN ('en_cours', 'rupture', 'scelle')),
    mise        INTEGER NOT NULL,
    pumps_done  INTEGER NOT NULL DEFAULT 0,
    bust_mult   REAL NOT NULL,
    pump_step   REAL NOT NULL DEFAULT 0.12,
    difficulte  TEXT NOT NULL DEFAULT 'demoniaque',
    solde_avant INTEGER NOT NULL,
    gain_net    INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)
try { db.exec('ALTER TABLE corps_games ADD COLUMN pump_step REAL NOT NULL DEFAULT 0.12') } catch {}
try { db.exec("ALTER TABLE corps_games ADD COLUMN difficulte TEXT NOT NULL DEFAULT 'demoniaque'") } catch {}
// Migrations : activation des nouveaux jeux
try { db.prepare('ALTER TABLE slots_config ADD COLUMN demons_gate_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}
try { db.prepare('ALTER TABLE slots_config ADD COLUMN corps_actif INTEGER NOT NULL DEFAULT 1').run() } catch {}

// Table images symboles Oni 243
db.exec(`
  CREATE TABLE IF NOT EXISTS oni_symbols (
    sym  TEXT PRIMARY KEY,
    url  TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT ''
  )
`)
try { db.exec(`ALTER TABLE oni_symbols ADD COLUMN name TEXT NOT NULL DEFAULT ''`) } catch {}

// Génère un token pour les rapports qui n'en ont pas
const crypto = require('crypto')
const sansToken = db.prepare(`SELECT id FROM rapports WHERE token IS NULL`).all()
const setToken = db.prepare(`UPDATE rapports SET token = ? WHERE id = ?`)
for (const r of sansToken) {
  setToken.run(crypto.randomBytes(6).toString('hex'), r.id)
}

// Tables Scientifique
db.exec(`
  CREATE TABLE IF NOT EXISTS sci_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    ordre INTEGER NOT NULL DEFAULT 0,
    can_create_items INTEGER NOT NULL DEFAULT 0,
    can_edit_items INTEGER NOT NULL DEFAULT 0,
    can_delete_items INTEGER NOT NULL DEFAULT 0,
    can_add_members INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_membres (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES sci_roles(id),
    assigned_by INTEGER REFERENCES users(id),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    icone TEXT NOT NULL DEFAULT '',
    ordre INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_champs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categorie_id INTEGER NOT NULL REFERENCES sci_categories(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'texte',
    options TEXT NOT NULL DEFAULT '[]',
    requis INTEGER NOT NULL DEFAULT 0,
    ordre INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sci_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categorie_id INTEGER NOT NULL REFERENCES sci_categories(id),
    nom TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_item_valeurs (
    item_id INTEGER NOT NULL REFERENCES sci_items(id) ON DELETE CASCADE,
    champ_id INTEGER NOT NULL REFERENCES sci_champs(id) ON DELETE CASCADE,
    valeur TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (item_id, champ_id)
  );
`)
try { db.prepare('ALTER TABLE users ADD COLUMN sci_dirigeant INTEGER NOT NULL DEFAULT 0').run() } catch {}

// ── Encyclopédie Scientifique ────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sci_scientists (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    affinite TEXT DEFAULT '',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_ingredients (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    categorie TEXT NOT NULL DEFAULT 'plante',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    proprietes TEXT DEFAULT '',
    localisation TEXT DEFAULT '',
    zone TEXT DEFAULT '',
    obtention TEXT DEFAULT '',
    danger INTEGER DEFAULT 0,
    recette_rp TEXT DEFAULT '',
    utilite_rp TEXT DEFAULT '',
    effets_rp TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_potions (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    createur_id TEXT REFERENCES sci_scientists(id),
    createur_nom TEXT DEFAULT '',
    description TEXT DEFAULT '',
    effet_principal TEXT DEFAULT '',
    effets_secondaires TEXT DEFAULT '',
    materiel TEXT DEFAULT '',
    etapes_preparation TEXT DEFAULT '',
    jet_minimum INTEGER DEFAULT NULL,
    nb_fioles INTEGER DEFAULT NULL,
    statut TEXT DEFAULT 'theorique',
    niveau_danger INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    date_creation TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_potion_ingredients (
    potion_id TEXT NOT NULL REFERENCES sci_potions(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL REFERENCES sci_ingredients(id),
    quantite TEXT DEFAULT '',
    PRIMARY KEY (potion_id, ingredient_id)
  );

  CREATE TABLE IF NOT EXISTS sci_experiments (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    responsable_id TEXT REFERENCES sci_scientists(id),
    responsable_nom TEXT DEFAULT '',
    participants TEXT DEFAULT '[]',
    date TEXT DEFAULT '',
    objectif TEXT DEFAULT '',
    hypothese TEXT DEFAULT '',
    sujet_teste TEXT DEFAULT '',
    protocole TEXT DEFAULT '',
    jets TEXT DEFAULT '',
    observations TEXT DEFAULT '',
    resultats TEXT DEFAULT '',
    conclusion TEXT DEFAULT '',
    statut TEXT DEFAULT 'proposition',
    ressources_utilisees TEXT DEFAULT '[]',
    potions_utilisees TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_projects (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    responsable_id TEXT REFERENCES sci_scientists(id),
    responsable_nom TEXT DEFAULT '',
    description TEXT DEFAULT '',
    principe TEXT DEFAULT '',
    architecture TEXT DEFAULT '',
    objectifs TEXT DEFAULT '[]',
    etapes TEXT DEFAULT '[]',
    statut TEXT DEFAULT 'en_cours',
    progression INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sci_project_experiments (
    project_id TEXT NOT NULL REFERENCES sci_projects(id) ON DELETE CASCADE,
    experiment_id TEXT NOT NULL REFERENCES sci_experiments(id),
    PRIMARY KEY (project_id, experiment_id)
  );

  CREATE TABLE IF NOT EXISTS sci_project_potions (
    project_id TEXT NOT NULL REFERENCES sci_projects(id) ON DELETE CASCADE,
    potion_id TEXT NOT NULL REFERENCES sci_potions(id),
    PRIMARY KEY (project_id, potion_id)
  );
`)

try { db.prepare("ALTER TABLE sci_experiments ADD COLUMN image_url TEXT NOT NULL DEFAULT ''").run() } catch {}
try { db.prepare("ALTER TABLE sci_projects ADD COLUMN image_url TEXT NOT NULL DEFAULT ''").run() } catch {}

// ── Seed encyclopédie ────────────────────────────────────────────────────────

const _seedScientist = db.prepare(`INSERT OR IGNORE INTO sci_scientists (id, nom, affinite, description) VALUES (?, ?, ?, ?)`)
const _seedScientists = [
  { id: 'hanzo', nom: 'Hanzo', affinite: '', description: '' },
  { id: 'hirozuki', nom: 'Hirozuki', affinite: '', description: '' },
  { id: 'yagami', nom: 'Yagami', affinite: '', description: '' },
  { id: 'hawara', nom: 'Hawara', affinite: '', description: '' },
  { id: 'sasaki-lionheart', nom: 'Sasaki Lionheart', affinite: '', description: '' },
  { id: 'shiki', nom: 'Shiki', affinite: '', description: '' },
  { id: 'sun-tzu', nom: 'Sun Tzu', affinite: '', description: '' },
  { id: 'getsu-fushiguro', nom: 'Getsu Fushiguro', affinite: '', description: '' },
  { id: 'yokai-z', nom: 'Yokai Z', affinite: '', description: '' },
  { id: 'baldi', nom: 'Baldi', affinite: 'Glace', description: '' },
]
for (const s of _seedScientists) _seedScientist.run(s.id, s.nom, s.affinite, s.description)

const _seedIngredient = db.prepare(`INSERT OR IGNORE INTO sci_ingredients (id, nom, categorie, description, proprietes, localisation, zone, obtention, danger, utilite_rp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
const _seedIngredients = [
  { id: 'belladone', nom: 'Belladone', categorie: 'plante_toxique', proprietes: 'Agit sur le système nerveux.', localisation: 'Entrée de la Forêt de la Sélection', danger: 4 },
  { id: 'glycine', nom: 'Glycine', categorie: 'plante_toxique', proprietes: 'Utilisée en poisons et remèdes.', localisation: 'Commune, notamment Forêt de la Sélection', danger: 2 },
  { id: 'ricin', nom: 'Ricin', categorie: 'plante_toxique', proprietes: 'Perturbe les fonctions cellulaires.', localisation: 'Hauteurs des zones enneigées', danger: 5 },
  { id: 'curare', nom: 'Curare', categorie: 'plante_toxique', proprietes: 'Provoque une paralysie musculaire.', localisation: 'Zones chaudes comme Magma', danger: 5 },
  { id: 'colchique', nom: 'Colchique', categorie: 'plante_toxique', proprietes: "Agit sur la cognition, l'apprentissage et la mémoire.", localisation: 'Forêt de la Sélection', danger: 4 },
  { id: 'morelle-noire', nom: 'Morelle Noire', categorie: 'plante_toxique', proprietes: 'Provoque nausées, douleurs, paralysie et autres symptômes.', localisation: 'Grotte de la Forêt des Araignées', danger: 4 },
  { id: 'anadenanthera-peregrina', nom: 'Anadenanthera peregrina', categorie: 'plante_toxique', proprietes: 'Hallucinogène.', localisation: 'Profondeurs des marais QDP', danger: 3 },
  { id: 'plantain', nom: 'Plantain', categorie: 'plante_medicinale', proprietes: 'Aide à arrêter les hémorragies.', localisation: 'Forêts', danger: 0 },
  { id: 'ginkgo', nom: 'Ginkgo', categorie: 'plante_medicinale', proprietes: 'Soin et neuroprotection.', localisation: 'Clairières de la Capitale et des Plaines', danger: 0 },
  { id: 'laurier', nom: 'Laurier', categorie: 'plante_medicinale', proprietes: 'Utilisé en remèdes.', localisation: 'Buissons QDP', danger: 0 },
  { id: 'cigue', nom: 'Ciguë', categorie: 'plante_medicinale', proprietes: 'Effet sédatif.', localisation: 'Sous les arbres enneigés de Snow', danger: 2 },
  { id: 'aloe-vera', nom: 'Aloe Vera', categorie: 'plante_medicinale', proprietes: 'Accélération de la guérison des brûlures.', localisation: 'Bord des lacs hors lacs gelés', danger: 0 },
  { id: 'consoude-officinale', nom: 'Consoude Officinale', categorie: 'plante_medicinale', proprietes: 'Soins des blessures et lésions.', localisation: 'Berges humides et cours d\'eau', danger: 0 },
  { id: 'hamamelis', nom: 'Hamamélis', categorie: 'plante_medicinale', proprietes: 'Régénération des tissus.', localisation: 'Buissons', danger: 0 },
  { id: 'echinacee', nom: 'Échinacée', categorie: 'plante_medicinale', proprietes: 'Réduction de certains symptômes.', localisation: 'Zones ensoleillées des Plaines', danger: 0 },
  { id: 'passiflore', nom: 'Passiflore', categorie: 'plante_medicinale', proprietes: 'Traumatismes physiques, fractures, douleurs musculaires.', localisation: 'Zones très chaudes de Magma', danger: 0 },
  { id: 'estragon', nom: 'Estragon', categorie: 'plante_medicinale', proprietes: "Insomnie et troubles de l'humeur.", localisation: 'Bord de Magma près des rochers chauds', danger: 0 },
  { id: 'curcuma', nom: 'Curcuma', categorie: 'plante_medicinale', proprietes: 'Antidouleur puissant.', localisation: 'Zone froide Snow près des arbres', danger: 0 },
  { id: 'millepertuis', nom: 'Millepertuis', categorie: 'plante_medicinale', proprietes: 'Anti-inflammatoire et plante polyvalente.', localisation: 'Forêts', danger: 0 },
  { id: 'racine-gelee', nom: 'Racine Gelée', categorie: 'ressource', localisation: 'Snow', obtention: 'Arbres' },
  { id: 'cristaux-givre-noir', nom: 'Cristaux de Givre Noir', categorie: 'ressource', localisation: 'Snow', obtention: 'Glaciers / lac gelé' },
  { id: 'venin-araignee', nom: "Venin d'Araignée concentré", categorie: 'ressource', localisation: 'Grotte de la Forêt des Araignées', danger: 4 },
  { id: 'soie-corrompue', nom: 'Soie Corrompue', categorie: 'ressource', localisation: 'Forêt des Araignées, maison suspendue' },
  { id: 'plantes-instables', nom: 'Plantes Instables', categorie: 'ressource', localisation: 'Clairière de la Forêt de la Sélection', danger: 3 },
  { id: 'champignons-sombres', nom: 'Champignons Sombres', categorie: 'ressource', localisation: 'Plaine de la Forêt de la Sélection' },
  { id: 'fragment-pierre-magmatique', nom: 'Fragment de Pierre Magmatique', categorie: 'ressource', localisation: 'Magma' },
  { id: 'cendres-brulees', nom: 'Cendres Brûlées', categorie: 'ressource', localisation: 'Magma, arbres proches de la lave' },
  { id: 'ebonite', nom: 'Ébonite', categorie: 'ressource', localisation: "Fond d'une grotte de la Capitale" },
  { id: 'nirnroot', nom: 'Nirnroot', categorie: 'ressource', localisation: "Sous les ponts / bords d'eau" },
  { id: 'givreboise', nom: 'Givreboise', categorie: 'ressource', localisation: 'Pieds des arbres de Snow' },
  { id: 'algue-rouge', nom: 'Algue rouge agar-agar', categorie: 'ressource', localisation: 'Rivières japonaises' },
  { id: 'acide-sulfurique-rp', nom: 'Acide sulfurique RP', categorie: 'produit_chimique', description: 'Substance fictive RP. Ne pas confondre avec un produit réel.', utilite_rp: 'Utilisé dans certaines potions comme réactif RP.', danger: 4 },
  { id: 'chlorure-sodium-rp', nom: 'Chlorure de sodium RP', categorie: 'produit_chimique', description: 'Substance fictive RP. Ne pas confondre avec un produit réel.', utilite_rp: 'Utilisé dans certaines potions comme stabilisant RP.', danger: 1 },
  { id: 'ammoniac-rp', nom: 'Ammoniac RP', categorie: 'produit_chimique', description: 'Substance fictive RP. Ne pas confondre avec un produit réel.', utilite_rp: 'Utilisé dans certaines potions.', danger: 3 },
]
for (const i of _seedIngredients) _seedIngredient.run(i.id, i.nom, i.categorie, i.description || '', i.proprietes || '', i.localisation || '', i.zone || '', i.obtention || '', i.danger || 0, i.utilite_rp || '')

const _seedPotion = db.prepare(`INSERT OR IGNORE INTO sci_potions (id, nom, createur_id, createur_nom, description, effet_principal, effets_secondaires, jet_minimum, nb_fioles, statut, niveau_danger, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
const _seedPotionIngredient = db.prepare(`INSERT OR IGNORE INTO sci_potion_ingredients (potion_id, ingredient_id, quantite) VALUES (?, ?, ?)`)
const _seedPotions = [
  { id: 'potion-oubli', nom: "Potion de l'Oubli", createur_nom: 'Inconnu', effet_principal: 'Fait oublier environ les 15 dernières minutes.', effets_secondaires: 'Forte migraine.', jet_minimum: 50, nb_fioles: 5, statut: 'validee', ingredients: [{ id: 'belladone', quantite: '4' },{ id: 'ricin', quantite: '1' },{ id: 'colchique', quantite: '2' },{ id: 'plantain', quantite: '2' },{ id: 'ginkgo', quantite: '3' }] },
  { id: 'potion-illusion', nom: "Potion d'Illusion", createur_id: 'hanzo', createur_nom: 'Hanzo', effet_principal: 'Désorientation, vision trouble et hallucinations.', effets_secondaires: "Une utilisation excessive peut provoquer des troubles importants et empêcher temporairement la cible de parler correctement.", jet_minimum: 50, nb_fioles: 5, statut: 'validee', ingredients: [{ id: 'anadenanthera-peregrina', quantite: '3' },{ id: 'belladone', quantite: '2' },{ id: 'plantain', quantite: '2' }] },
  { id: 'sang-chaos', nom: 'Sang du Chaos', createur_id: 'hirozuki', createur_nom: 'Hirozuki', effet_principal: "Les odeurs attirent les pourfendeurs expérimentés. Les vapeurs provoquent de la désorientation. Peut provoquer une fausse sensation de victoire après avoir blessé un démon. Ingéré par un démon : augmentation temporaire de la régénération.", effets_secondaires: 'Abus = rage. Attaque possible des alliés comme des ennemis. Mutation possible.', statut: 'validee', niveau_danger: 4, ingredients: [] },
  { id: 'larmes-lune', nom: 'Larmes de la Lune', createur_id: 'yagami', createur_nom: 'Yagami', effet_principal: 'Régénération des blessures.', notes: 'En cas de mauvais jet, la blessure peut être aggravée.', nb_fioles: 1, statut: 'validee', ingredients: [{ id: 'glycine', quantite: '0,1 g' },{ id: 'passiflore', quantite: '1' }] },
  { id: 'resistance-glycine', nom: 'Résistance à la Glycine', createur_id: 'hawara', createur_nom: 'Hawara', effet_principal: "Augmentation de la résistance aux effets toxiques de la Glycine.", effets_secondaires: 'Une utilisation excessive peut provoquer de graves blessures au torse.', statut: 'validee', ingredients: [{ id: 'glycine', quantite: '5 feuilles' },{ id: 'belladone', quantite: '3' },{ id: 'ricin', quantite: '2' },{ id: 'curare', quantite: '1' },{ id: 'hamamelis', quantite: '2' },{ id: 'millepertuis', quantite: '10' }] },
  { id: 'essence-neant', nom: 'Essence du Néant', createur_id: 'sasaki-lionheart', createur_nom: 'Sasaki Lionheart', description: 'Version retravaillée par Sasaki Lionheart.', effet_principal: 'Réaction immédiate, pression interne, désintégration.', effets_secondaires: 'Propagation incontrôlée. Instabilité. Résultat imprévisible.', statut: 'instable', niveau_danger: 5, ingredients: [{ id: 'racine-gelee', quantite: '250 mg' },{ id: 'cristaux-givre-noir', quantite: '100 mg' },{ id: 'venin-araignee', quantite: '50 mg' },{ id: 'soie-corrompue', quantite: '200 mg' },{ id: 'plantes-instables', quantite: '300 mg' },{ id: 'champignons-sombres', quantite: '200 mg' },{ id: 'fragment-pierre-magmatique', quantite: '150 mg' },{ id: 'cendres-brulees', quantite: '250 mg' }] },
  { id: 'potion-effets-superieurs', nom: "Potion d'Effets Supérieurs", createur_id: 'shiki', createur_nom: 'Shiki', effet_principal: 'Augmentation temporaire de la vitesse, force et endurance.', effets_secondaires: "Fatigue et dégradation physique accélérée après l'effet.", statut: 'validee', ingredients: [{ id: 'aloe-vera', quantite: '3' },{ id: 'cigue', quantite: '2' },{ id: 'acide-sulfurique-rp', quantite: '15 ml' }] },
  { id: 'potion-effets-negatifs', nom: "Potion d'Effets Négatifs", createur_id: 'shiki', createur_nom: 'Shiki', effet_principal: 'Effets encore inconnus.', statut: 'experimentale', ingredients: [{ id: 'belladone', quantite: '4' },{ id: 'morelle-noire', quantite: '1' },{ id: 'chlorure-sodium-rp', quantite: '15 ml' }] },
  { id: 'potion-mortelle', nom: 'Potion Mortelle', createur_id: 'shiki', createur_nom: 'Shiki', effet_principal: 'Affaiblissement important de la personne qui la consomme.', effets_secondaires: 'Encore à déterminer.', statut: 'experimentale', niveau_danger: 5, ingredients: [{ id: 'colchique', quantite: '6' },{ id: 'ricin', quantite: '3' },{ id: 'ammoniac-rp', quantite: '15 ml' }] },
  { id: 'glacies-ignis', nom: 'Glacies Ignis', createur_id: 'sun-tzu', createur_nom: 'Sun Tzu', effet_principal: 'Inconnus.', statut: 'experimentale', ingredients: [{ id: 'ginkgo', quantite: '5' },{ id: 'aloe-vera', quantite: '4' }] },
  { id: 'respira-null', nom: 'Respira-Null', createur_id: 'getsu-fushiguro', createur_nom: 'Getsu Fushiguro', effet_principal: "Gaz vert. Perturbe le rythme respiratoire. Perturbe la concentration. Panique immédiate chez un pourfendeur.", effets_secondaires: 'Une exposition excessive peut être extrêmement dangereuse.', statut: 'validee', niveau_danger: 4, ingredients: [{ id: 'belladone', quantite: '4' },{ id: 'ricin', quantite: '6' },{ id: 'colchique', quantite: '2' },{ id: 'curare', quantite: '1' }] },
  { id: 'croissant-noir', nom: 'Croissant Noir', createur_id: 'yokai-z', createur_nom: 'Yokai Z', effet_principal: 'Inconnus.', statut: 'theorique', ingredients: [{ id: 'belladone', quantite: '4' },{ id: 'glycine', quantite: '5' },{ id: 'ricin', quantite: '3' },{ id: 'curare', quantite: '1' },{ id: 'colchique', quantite: '2' },{ id: 'morelle-noire', quantite: '3' },{ id: 'anadenanthera-peregrina', quantite: '1' }] },
  { id: 'esprit-traque', nom: 'Esprit Traqué — Essai n°1', createur_id: 'baldi', createur_nom: 'Baldi', description: 'But : provoquer une paranoïa progressive chez un pourfendeur.', effet_principal: "Méfiance, impression d'être suivi et observé, hallucinations légères, difficulté à différencier certaines menaces réelles et imaginaires. La cible reste capable de se déplacer et de combattre.", statut: 'experimentale', notes: 'Cette potion est liée au projet KYŌFU.', ingredients: [{ id: 'anadenanthera-peregrina', quantite: '' },{ id: 'belladone', quantite: '' },{ id: 'colchique', quantite: '' },{ id: 'cigue', quantite: '' },{ id: 'ginkgo', quantite: '' },{ id: 'soie-corrompue', quantite: '' }] },
]
for (const p of _seedPotions) {
  _seedPotion.run(p.id, p.nom, p.createur_id || null, p.createur_nom || '', p.description || '', p.effet_principal || '', p.effets_secondaires || '', p.jet_minimum ?? null, p.nb_fioles ?? null, p.statut || 'theorique', p.niveau_danger || 0, p.notes || '')
  for (const ing of (p.ingredients || [])) _seedPotionIngredient.run(p.id, ing.id, ing.quantite || '')
}

const _seedExperiment = db.prepare(`INSERT OR IGNORE INTO sci_experiments (id, nom, responsable_id, responsable_nom, objectif, statut, potions_utilisees) VALUES (?, ?, ?, ?, ?, ?, ?)`)
_seedExperiment.run('esprit-traque-essai-1', 'Esprit Traqué — Essai n°1', 'baldi', 'Baldi', 'Provoquer une paranoïa progressive chez un pourfendeur.', 'proposition', JSON.stringify(['esprit-traque']))

const _seedProject = db.prepare(`INSERT OR IGNORE INTO sci_projects (id, nom, responsable_id, responsable_nom, description, principe, architecture, statut, progression) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
_seedProject.run('kyofu', 'KYŌFU', 'baldi', 'Baldi', 'Créer un totem utilisant un réceptacle particulier capable de conserver et canaliser différentes substances ou énergies.', 'Créer un totem utilisant un réceptacle particulier capable de conserver et canaliser différentes substances ou énergies.', "Totem / réceptacle — Esprit Traqué comme noyau scientifique — Intervention de la Sphère Occulte pour l'énergie et la diffusion. Le totem seul ne provoque aucun effet. Il sert uniquement de réceptacle exceptionnel.", 'en_cours', 10)

db.prepare(`INSERT OR IGNORE INTO sci_project_experiments (project_id, experiment_id) VALUES (?, ?)`).run('kyofu', 'esprit-traque-essai-1')
db.prepare(`INSERT OR IGNORE INTO sci_project_potions (project_id, potion_id) VALUES (?, ?)`).run('kyofu', 'esprit-traque')

// ── Effets Ressentis ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sci_effets (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    titre TEXT NOT NULL,
    sous_titre TEXT DEFAULT '',
    contenu TEXT DEFAULT '',
    symptomes TEXT DEFAULT '',
    duree TEXT DEFAULT '',
    intensite INTEGER DEFAULT 1,
    type TEXT DEFAULT 'general',
    image_url TEXT DEFAULT '',
    actif INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// ── Glace ────────────────────────────────────────────────────────────────────
try { db.prepare('ALTER TABLE users ADD COLUMN glace_dirigeant INTEGER DEFAULT 0').run() } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS glace_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    couleur TEXT DEFAULT '#ffffff',
    can_see_all INTEGER DEFAULT 0,
    can_delete_others INTEGER DEFAULT 0
  )
`)
try { db.prepare('ALTER TABLE glace_roles ADD COLUMN can_see_all INTEGER DEFAULT 0').run() } catch {}
try { db.prepare('ALTER TABLE glace_roles ADD COLUMN can_delete_others INTEGER DEFAULT 0').run() } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS glace_membres (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES glace_roles(id) ON DELETE SET NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS glace_activites (
    id TEXT PRIMARY KEY,
    titre TEXT NOT NULL,
    type TEXT DEFAULT 'entrainement',
    date_activite TEXT DEFAULT '',
    nb_participants INTEGER DEFAULT 0,
    participants TEXT DEFAULT '',
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

module.exports = db

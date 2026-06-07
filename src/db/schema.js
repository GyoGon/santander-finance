function initDb(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('debit','credit')),
      account_type TEXT NOT NULL CHECK(account_type IN ('card','loan')),
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      debtor_name TEXT NOT NULL,
      percentage REAL NOT NULL CHECK(percentage > 0 AND percentage <= 100),
      amount_owed REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debtors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      total_owed REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loan (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      balance REAL NOT NULL,
      monthly_payment REAL NOT NULL,
      remaining_installments INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

module.exports = { initDb };

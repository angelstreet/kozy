import db from '../db.js';

export async function migrateEncryption() {
  console.log('Running encryption migration...');

  // Create user table if it doesn't exist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      smoobu_api_key_encrypted TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Check if smoobu_api_key_encrypted column exists
  const cols = await db.execute("PRAGMA table_info(user)");
  const columnNames = cols.rows.map((c: any) => c[1] || c.name);

  if (!columnNames.includes('smoobu_api_key_encrypted')) {
    console.log('Adding smoobu_api_key_encrypted column to user table');
    await db.execute('ALTER TABLE user ADD COLUMN smoobu_api_key_encrypted TEXT');
  } else {
    console.log('Column smoobu_api_key_encrypted already exists');
  }

  // Migrate data from user_settings to user table (if any exists)
  // Note: Old plaintext keys will need to be re-entered by users
  // We cannot migrate plaintext to encrypted without the original values
  console.log('Note: Users will need to re-enter their Smoobu API keys (now encrypted)');

  console.log('Encryption migration complete');
}

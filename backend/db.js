import Database from 'better-sqlite3'

const db = new Database('social.db')

// Создаем таблицы только если их нет
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatarUrl TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    registrationIp TEXT,
    registrationUserAgent TEXT
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    authorId TEXT NOT NULL,
    text TEXT,
    imageUrl TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    ip TEXT,
    userAgent TEXT,
    FOREIGN KEY (authorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    postId TEXT NOT NULL,
    userId TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (postId, userId)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    postId TEXT NOT NULL,
    authorId TEXT NOT NULL,
    text TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (postId) REFERENCES posts(id),
    FOREIGN KEY (authorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    followerId TEXT NOT NULL,
    followingId TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (followerId, followingId)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    action TEXT NOT NULL,
    ip TEXT,
    userAgent TEXT,
    metadata TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user1Id TEXT NOT NULL,
    user2Id TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user1Id) REFERENCES users(id),
    FOREIGN KEY (user2Id) REFERENCES users(id),
    UNIQUE(user1Id, user2Id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    encryptedContent TEXT NOT NULL,
    fileUrl TEXT,
    fileName TEXT,
    fileType TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    readAt TEXT,
    FOREIGN KEY (conversationId) REFERENCES conversations(id),
    FOREIGN KEY (senderId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_keys (
    userId TEXT PRIMARY KEY,
    publicKey TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`)

// Проверяем и добавляем новые колонки если их нет (миграция)
try {
  const columns = db.prepare("PRAGMA table_info(messages)").all()
  const hasFileUrl = columns.some(col => col.name === 'fileUrl')
  
  if (!hasFileUrl) {
    console.log('Migrating messages table: adding file columns...')
    db.exec(`
      ALTER TABLE messages ADD COLUMN fileUrl TEXT;
      ALTER TABLE messages ADD COLUMN fileName TEXT;
      ALTER TABLE messages ADD COLUMN fileType TEXT;
    `)
    console.log('Migration completed')
  }
} catch (error) {
  console.log('Migration check:', error.message)
}

export default db

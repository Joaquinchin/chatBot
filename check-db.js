const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'books.db');
const db = new Database(dbPath);

console.log('📊 Verificando base de datos:', dbPath);
console.log('\n📚 READING LIST:');
const readingList = db.prepare('SELECT * FROM reading_list').all();
console.log('Total:', readingList.length);
if (readingList.length > 0) {
  console.table(readingList);
} else {
  console.log('❌ Lista vacía');
}

console.log('\n📖 BOOKS READ:');
const booksRead = db.prepare('SELECT * FROM books_read').all();
console.log('Total:', booksRead.length);
if (booksRead.length > 0) {
  console.table(booksRead);
} else {
  console.log('❌ Sin libros leídos');
}

db.close();

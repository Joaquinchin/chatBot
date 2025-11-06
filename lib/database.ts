import Database from 'better-sqlite3';
import path from 'path';

// Crear o abrir la base de datos
const dbPath = path.join(process.cwd(), 'books.db');
const db = new Database(dbPath);

// Crear las tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS reading_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    authors TEXT,
    thumbnail TEXT,
    priority TEXT DEFAULT 'medium',
    notes TEXT,
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS books_read (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    authors TEXT,
    thumbnail TEXT,
    rating INTEGER,
    review TEXT,
    page_count INTEGER DEFAULT 0,
    date_finished DATE DEFAULT CURRENT_DATE
  );
`);

console.log('✅ Base de datos inicializada en:', dbPath);

// ==========================================
// FUNCIONES PARA READING LIST
// ==========================================

export function addToReadingList(bookData: {
  bookId: string;
  title: string;
  authors: string;
  thumbnail?: string;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO reading_list (book_id, title, authors, thumbnail, priority, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(
      bookData.bookId,
      bookData.title,
      bookData.authors,
      bookData.thumbnail || '',
      bookData.priority || 'medium',
      bookData.notes || ''
    );
    return { success: true, message: `"${bookData.title}" agregado a tu lista de lectura` };
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, message: 'Este libro ya está en tu lista' };
    }
    throw error;
  }
}

export function getReadingList(filter?: { priority?: string; limit?: number }) {
  let query = 'SELECT * FROM reading_list';
  const params: any[] = [];

  if (filter?.priority) {
    query += ' WHERE priority = ?';
    params.push(filter.priority);
  }

  query += ' ORDER BY date_added DESC';

  if (filter?.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

export function removeFromReadingList(bookId: string) {
  const stmt = db.prepare('DELETE FROM reading_list WHERE book_id = ?');
  const result = stmt.run(bookId);
  
  if (result.changes > 0) {
    return { success: true, message: 'Libro eliminado de tu lista' };
  } else {
    return { success: false, message: 'Libro no encontrado en tu lista' };
  }
}

// ==========================================
// FUNCIONES PARA BOOKS READ
// ==========================================

export function markAsRead(bookData: {
  bookId: string;
  title: string;
  authors: string;
  thumbnail?: string;
  rating?: number;
  review?: string;
  pageCount?: number;
  dateFinished?: string;
}) {
  // Primero, eliminar de reading_list si está ahí
  db.prepare('DELETE FROM reading_list WHERE book_id = ?').run(bookData.bookId);

  // Luego, agregar a books_read
  const stmt = db.prepare(`
    INSERT INTO books_read (book_id, title, authors, thumbnail, rating, review, page_count, date_finished)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(
      bookData.bookId,
      bookData.title,
      bookData.authors,
      bookData.thumbnail || '',
      bookData.rating || null,
      bookData.review || '',
      bookData.pageCount || 0,
      bookData.dateFinished || new Date().toISOString().split('T')[0]
    );
    return { success: true, message: `"${bookData.title}" marcado como leído` };
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, message: 'Este libro ya está marcado como leído' };
    }
    throw error;
  }
}

export function getBooksRead(limit?: number) {
  let query = 'SELECT * FROM books_read ORDER BY date_finished DESC';
  
  if (limit) {
    query += ' LIMIT ?';
    return db.prepare(query).all(limit);
  }
  
  return db.prepare(query).all();
}

// ==========================================
// ESTADÍSTICAS
// ==========================================

export function getReadingStats(period?: 'all-time' | 'year' | 'month') {
  let dateFilter = '';
  
  if (period === 'year') {
    dateFilter = "AND date_finished >= date('now', '-1 year')";
  } else if (period === 'month') {
    dateFilter = "AND date_finished >= date('now', '-1 month')";
  }

  // Total de libros leídos
  const totalBooks = db.prepare(`
    SELECT COUNT(*) as count FROM books_read WHERE 1=1 ${dateFilter}
  `).get() as { count: number };

  // Páginas totales
  const totalPages = db.prepare(`
    SELECT SUM(page_count) as total FROM books_read WHERE 1=1 ${dateFilter}
  `).get() as { total: number | null };

  // Rating promedio
  const avgRating = db.prepare(`
    SELECT AVG(rating) as average FROM books_read WHERE rating IS NOT NULL ${dateFilter}
  `).get() as { average: number | null };

  // Autor más leído
  const topAuthor = db.prepare(`
    SELECT authors, COUNT(*) as count 
    FROM books_read 
    WHERE 1=1 ${dateFilter}
    GROUP BY authors 
    ORDER BY count DESC 
    LIMIT 1
  `).get() as { authors: string; count: number } | undefined;

  // Libros pendientes
  const pendingBooks = db.prepare('SELECT COUNT(*) as count FROM reading_list').get() as { count: number };

  return {
    totalBooksRead: totalBooks.count,
    totalPagesRead: totalPages.total || 0,
    averageRating: avgRating.average ? Number(avgRating.average.toFixed(1)) : 0,
    favoriteAuthor: topAuthor?.authors || 'N/A',
    favoriteAuthorCount: topAuthor?.count || 0,
    pendingBooks: pendingBooks.count,
    period: period || 'all-time'
  };
}

export default db;

export async function searchBooks(query: string, maxResults: number = 10) {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_BOOKS_API_KEY no configurada');
  }

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Formatear la respuesta para que sea más legible
  const books = data.items?.map((item: any) => ({
    id: item.id,
    title: item.volumeInfo.title,
    authors: item.volumeInfo.authors?.join(', ') || 'Autor desconocido',
    description: item.volumeInfo.description?.slice(0, 200) + '...' || 'Sin descripción',
    thumbnail: item.volumeInfo.imageLinks?.thumbnail || '',
    categories: item.volumeInfo.categories?.join(', ') || 'Sin categoría',
  })) || [];
  
  return books;
}

export async function getBookDetails(bookId: string) {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_BOOKS_API_KEY no configurada');
  }

  const url = `https://www.googleapis.com/books/v1/volumes/${bookId}?key=${apiKey}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    id: data.id,
    title: data.volumeInfo.title,
    authors: data.volumeInfo.authors?.join(', ') || 'Autor desconocido',
    description: data.volumeInfo.description || 'Sin descripción',
    pageCount: data.volumeInfo.pageCount || 0,
    categories: data.volumeInfo.categories?.join(', ') || 'Sin categoría',
    publishedDate: data.volumeInfo.publishedDate || 'Fecha desconocida',
    publisher: data.volumeInfo.publisher || 'Editorial desconocida',
    thumbnail: data.volumeInfo.imageLinks?.thumbnail || '',
    language: data.volumeInfo.language || 'Idioma desconocido',
  };
}
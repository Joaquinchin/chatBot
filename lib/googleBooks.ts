/**
 * Busca libros en Google Books API
 * 
 * Esta función se conecta a Google Books para buscar libros según lo que el usuario escriba.
 * Por ejemplo, si el usuario busca "Harry Potter", esta función hace la petición a Google
 * y devuelve una lista de libros relacionados.
 * 
 * @param query - Lo que el usuario quiere buscar (ej: "Harry Potter", "ciencia ficción")
 * @param maxResults - Cuántos libros queremos que devuelva como máximo (por defecto 10)
 * @returns Una lista de libros con su información básica (título, autor, portada, etc.)
 */
export async function searchBooks(query: string, maxResults: number = 10) {
  // Obtener la API key desde las variables de entorno (archivo .env.local)
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  // Limpiamos la búsqueda quitando espacios al inicio y final
  const sanitizedQuery = query.trim();
  
  // Si el usuario no escribió nada, lanzamos un error
  if (!sanitizedQuery) {
    throw new Error('Query vacía no permitida');
  }

  // Truco: Si alguien busca solo "Messi" (muy corto y sin la palabra "book"),
  // le agregamos "books" al final para que Google sepa que queremos libros, no páginas web
  const enhancedQuery = sanitizedQuery.length < 30 && !sanitizedQuery.toLowerCase().includes('book') 
    ? `${sanitizedQuery} books` 
    : sanitizedQuery;

  // Armamos la URL para hacer la petición a Google Books
  // encodeURIComponent convierte caracteres especiales (ej: espacios → %20)
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(enhancedQuery)}&maxResults=${maxResults}`;
  
  // Si tenemos una API key válida (no el placeholder de prueba), la agregamos a la URL
  // Esto nos da más requests por día
  if (apiKey && !apiKey.includes('123456789')) {
    url += `&key=${apiKey}`;
  } else {
    // Si no hay key, igual funciona pero con límites más bajos
    console.warn('⚠️ Usando Google Books API sin key (límites bajos)');
  }
  
  console.log('🔍 Google Books query:', enhancedQuery);
  
  // Hacemos la petición HTTP a Google Books
  const response = await fetch(url);
  
  // Si algo salió mal (error 400, 404, 500, etc.), mostramos el error
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Google Books error:', response.status, errorText);
    throw new Error(`Google Books API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }
  
  // Convertimos la respuesta de JSON a un objeto JavaScript
  const data = await response.json();
  
  // Google Books devuelve un objeto complicado, así que lo limpiamos y extraemos
  // solo lo que nos interesa para mostrar en nuestra app
  const books = data.items?.map((item: any) => ({
    id: item.id, // ID único del libro (lo usamos para obtener más detalles después)
    title: item.volumeInfo.title, // Título del libro
    authors: item.volumeInfo.authors?.join(', ') || 'Autor desconocido', // Autores separados por coma
    description: item.volumeInfo.description?.slice(0, 200) + '...' || 'Sin descripción', // Descripción corta
    thumbnail: item.volumeInfo.imageLinks?.thumbnail || '', // URL de la imagen de portada
    categories: item.volumeInfo.categories?.join(', ') || 'Sin categoría', // Géneros/categorías
  })) || [];
  
  // Devolvemos la lista de libros ya formateada
  return books;
}

/**
 * Obtiene los detalles completos de un libro específico
 * 
 * Cuando el usuario quiere saber más sobre un libro en particular, usamos esta función.
 * Por ejemplo, después de buscar "Harry Potter" y ver varios resultados, el usuario puede
 * pedir "dame más detalles del primero", y esta función obtiene toda la info de ese libro.
 * 
 * @param bookId - El ID único del libro en Google Books (ej: "h3QmDwAAQBAJ")
 * @returns Un objeto con toda la información del libro (autor, páginas, editorial, etc.)
 */
export async function getBookDetails(bookId: string) {
  // Obtener la API key desde las variables de entorno
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  // Armamos la URL para pedir los detalles de UN libro específico usando su ID
  let url = `https://www.googleapis.com/books/v1/volumes/${bookId}`;
  
  // Si tenemos API key, la agregamos
  if (apiKey && !apiKey.includes('123456789')) {
    url += `?key=${apiKey}`;
  } else {
    console.warn('⚠️ Usando Google Books API sin key (límites bajos)');
  }
  
  // Hacemos la petición a Google Books
  const response = await fetch(url);
  
  // Verificamos si hubo algún error
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Google Books error:', response.status, errorText);
    throw new Error(`Google Books API error: ${response.status} - ${errorText.slice(0, 200)}`);
  }
  
  // Convertimos la respuesta a JSON
  const data = await response.json();
  
  // Extraemos y organizamos toda la información del libro
  // Nota: Usamos || (OR) para poner valores por defecto si algo no existe
  return {
    id: data.id,
    title: data.volumeInfo.title,
    authors: data.volumeInfo.authors?.join(', ') || 'Autor desconocido',
    description: data.volumeInfo.description || 'Sin descripción',
    pageCount: data.volumeInfo.pageCount || 0, // Número de páginas
    categories: data.volumeInfo.categories?.join(', ') || 'Sin categoría',
    publishedDate: data.volumeInfo.publishedDate || 'Fecha desconocida', // Cuándo se publicó
    publisher: data.volumeInfo.publisher || 'Editorial desconocida', // Quién lo publicó
    thumbnail: data.volumeInfo.imageLinks?.thumbnail || '', // Imagen de portada
    language: data.volumeInfo.language || 'Idioma desconocido', // Idioma del libro
  };
}
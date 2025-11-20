interface BookCardProps {
  book: {
    id: string;
    title: string;
    authors: string;
    description: string;
    thumbnail?: string;
    categories?: string;
  };
}

export default function BookCard({ book }: BookCardProps) {
  const googleBooksUrl = `https://books.google.com/books?id=${book.id}`;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex gap-3 p-3">
        {book.thumbnail && (
          <a 
            href={googleBooksUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img
              src={book.thumbnail.replace('http:', 'https:')}
              alt={book.title}
              className="w-20 h-28 object-cover rounded shadow-sm hover:scale-105 transition-transform"
            />
          </a>
        )}
        <div className="flex-1 min-w-0">
          <a 
            href={googleBooksUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <h3 className="font-semibold text-sm text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2">
              {book.title}
            </h3>
          </a>
          <p className="text-xs text-gray-600 mt-1">{book.authors}</p>
          {book.categories && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              {book.categories.includes('Prioridad') ? (
                <>
                  {book.categories.includes('high') && <span className="text-red-600 font-semibold">Alta</span>}
                  {book.categories.includes('medium') && <span className="text-yellow-600 font-semibold">Media</span>}
                  {book.categories.includes('low') && <span className="text-green-600 font-semibold">Baja</span>}
                  <span className="text-gray-400">•</span>
                  <span>{book.categories.split('•')[1]?.trim()}</span>
                </>
              ) : (
                <>
                  <span className="font-medium">Categoría:</span> {book.categories}
                </>
              )}
            </p>
          )}
          <p className="text-xs text-gray-700 mt-2 line-clamp-3">
            {book.description}
          </p>
          <a
            href={googleBooksUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-green-600 hover:text-green-700 font-medium hover:underline"
          >
            Ver en Google Books
          </a>
        </div>
      </div>
    </div>
  );
}

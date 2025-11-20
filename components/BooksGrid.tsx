import BookCard from './BookCard';

interface BooksGridProps {
  books: Array<{
    id: string;
    title: string;
    authors: string;
    description: string;
    thumbnail?: string;
    categories?: string;
  }>;
  title?: string;
}

export default function BooksGrid({ books, title }: BooksGridProps) {
  if (books.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
        Tu lista de lectura está vacía
      </div>
    );
  }

  return (
    <div className="my-3">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          {title} <span className="text-xs font-normal text-gray-500">({books.length})</span>
        </h4>
      )}
      <div className="space-y-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}

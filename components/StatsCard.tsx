interface StatsCardProps {
  stats: {
    period: string;
    totalBooksRead: number;
    totalPagesRead: number;
    averageRating: number;
    favoriteAuthor: string;
    favoriteAuthorCount: number;
    pendingBooks: number;
  };
}

export default function StatsCard({ stats }: StatsCardProps) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 my-3">
      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
        Tus estadísticas de lectura
      </h4>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-white/70 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">{stats.totalBooksRead}</div>
          <div className="text-gray-600 mt-1">Libros leídos</div>
        </div>
        <div className="bg-white/70 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">{stats.totalPagesRead}</div>
          <div className="text-gray-600 mt-1">Páginas leídas</div>
        </div>
        <div className="bg-white/70 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-600">
            {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
          </div>
          <div className="text-gray-600 mt-1">Rating promedio</div>
        </div>
        <div className="bg-white/70 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">{stats.pendingBooks}</div>
          <div className="text-gray-600 mt-1">Por leer</div>
        </div>
      </div>
      {stats.favoriteAuthor && stats.favoriteAuthor !== 'Ninguno' && (
        <div className="bg-white/70 rounded-lg p-3 mt-3 text-xs">
          <div className="font-semibold text-gray-700">Autor favorito</div>
          <div className="text-gray-600 mt-1">
            {stats.favoriteAuthor} ({stats.favoriteAuthorCount} {stats.favoriteAuthorCount === 1 ? 'libro' : 'libros'})
          </div>
        </div>
      )}
    </div>
  );
}

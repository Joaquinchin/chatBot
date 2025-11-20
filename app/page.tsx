'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef } from 'react';
import BooksGrid from '@/components/BooksGrid';
import StatsCard from '@/components/StatsCard';
import DOMPurify from 'dompurify';

// Sanitizar input del usuario
function sanitizeInput(input: string): string {
  // Remover caracteres peligrosos y scripts
  let sanitized = input.trim();
  
  // Limitar longitud
  if (sanitized.length > 1000) {
    sanitized = sanitized.slice(0, 1000);
  }
  
  // Remover tags HTML y scripts
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  return sanitized;
}

// Función para parsear contenido con datos estructurados
function parseMessageContent(content: string) {
  const parts: Array<{
    type: 'text' | 'books' | 'stats' | 'reading_list';
    data: any;
  }> = [];
  
  // Limpiar marcadores basura que el LLM a veces genera
  let cleanedContent = content
    .replace(/__TOOL_START__\w+/g, '')
    .replace(/\|_tool_sep_\|/g, '')
    .replace(/>_tool_call_end_\|/g, '')
    .replace(/_tool_calls_end_\|/g, '')
    .replace(/\|_tool_call_end_\|/g, '')
    .replace(/>\s*<\|/g, '')
    .replace(/\|\s*tool_\w+/g, '')
    .replace(/>\s*{\s*"/g, '');
  
  // Buscar y extraer datos estructurados
  const booksRegex = /<<BOOKS_DATA>>(.*?)<<BOOKS_DATA>>/g;
  const readingListRegex = /<<READING_LIST_DATA>>(.*?)<<READING_LIST_DATA>>/g;
  const statsRegex = /<<STATS_DATA>>(.*?)<<STATS_DATA>>/g;
  
  let processedContent = cleanedContent;
  
  // Extraer books
  let match;
  while ((match = booksRegex.exec(content)) !== null) {
    try {
      const booksData = JSON.parse(match[1]);
      processedContent = processedContent.replace(match[0], `##BOOKS##${match[1]}##BOOKS##`);
    } catch (e) {
      console.error('Error parsing books:', e);
    }
  }
  
  // Extraer reading list
  while ((match = readingListRegex.exec(content)) !== null) {
    try {
      const listData = JSON.parse(match[1]);
      processedContent = processedContent.replace(match[0], `##READING_LIST##${match[1]}##READING_LIST##`);
    } catch (e) {
      console.error('Error parsing reading list:', e);
    }
  }
  
  // Extraer stats
  while ((match = statsRegex.exec(content)) !== null) {
    try {
      const statsData = JSON.parse(match[1]);
      processedContent = processedContent.replace(match[0], `##STATS##${match[1]}##STATS##`);
    } catch (e) {
      console.error('Error parsing stats:', e);
    }
  }
  
  // Dividir por marcadores procesados
  const segments = processedContent.split(/(##BOOKS##.*?##BOOKS##|##READING_LIST##.*?##READING_LIST##|##STATS##.*?##STATS##)/);
  
  for (const segment of segments) {
    if (segment.startsWith('##BOOKS##')) {
      try {
        const jsonStr = segment.replace(/##BOOKS##/g, '');
        const booksData = JSON.parse(jsonStr);
        parts.push({ type: 'books', data: booksData });
      } catch (e) {
        parts.push({ type: 'text', data: segment });
      }
    } else if (segment.startsWith('##READING_LIST##')) {
      try {
        const jsonStr = segment.replace(/##READING_LIST##/g, '');
        const listData = JSON.parse(jsonStr);
        parts.push({ type: 'reading_list', data: listData });
      } catch (e) {
        parts.push({ type: 'text', data: segment });
      }
    } else if (segment.startsWith('##STATS##')) {
      try {
        const jsonStr = segment.replace(/##STATS##/g, '');
        const statsData = JSON.parse(jsonStr);
        parts.push({ type: 'stats', data: statsData });
      } catch (e) {
        parts.push({ type: 'text', data: segment });
      }
    } else if (segment.trim()) {
      parts.push({ type: 'text', data: segment });
    }
  }
  
  return parts;
}

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: '/api/chat',
    onFinish: (message) => {
      // Guardar conversación en sessionStorage al terminar cada mensaje
      const updatedMessages = [...messages, message];
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('chat_messages', JSON.stringify(updatedMessages));
      }
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar conversación guardada al montar el componente
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length === 0) {
      const savedMessages = sessionStorage.getItem('chat_messages');
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {
          console.error('Error cargando mensajes guardados:', e);
        }
      }
    }
  }, []);

  // Guardar mensajes cuando cambien
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      sessionStorage.setItem('chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    console.log('📩 Mensajes actuales:', messages);
    messages.forEach((msg, i) => {
      console.log(`Mensaje ${i}:`, {
        role: msg.role,
        content: msg.content,
        contentLength: msg.content.length
      });
    });
    console.log('📊 Total de mensajes:', messages.length);
    console.log('⏳ Cargando:', isLoading);
    console.log('❌ Error:', error);
  }, [messages, isLoading, error]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handler personalizado para sanitizar input antes de enviar
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const sanitizedInput = sanitizeInput(input);
    
    if (!sanitizedInput.trim()) {
      return;
    }
    
    // Crear evento sintético con el input sanitizado
    const syntheticEvent = {
      ...e,
      currentTarget: {
        ...e.currentTarget,
        elements: {
          ...e.currentTarget.elements,
          '0': { value: sanitizedInput }
        }
      }
    };
    
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-green-600 shadow-md p-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-white text-center">
              chatBookAI
            </h1>
            <p className="text-center text-green-100 text-xs mt-0.5">
              Tu asistente personal de lectura
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm('¿Quieres borrar toda la conversación?')) {
                  setMessages([]);
                  sessionStorage.removeItem('chat_messages');
                }
              }}
              className="text-white/80 hover:text-white text-xs px-3 py-1 rounded hover:bg-white/10 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </header>

      <div 
        className="flex-1 overflow-y-auto p-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d5db' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#e5ddd5'
        }}
      >
        <div className="max-w-2xl mx-auto space-y-3 pb-4">
          {messages.length === 0 ? (
            <div className="text-center mt-20 space-y-3">
              <div className="bg-white/90 rounded-lg shadow-md p-6 max-w-sm mx-auto">
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  Hola capo!
                </h2>
                <div className="text-left text-xs text-gray-500 space-y-1">
                  <p>En que te ayudo:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Buscar libros por título, autor o tema</li>
                    <li>Recomendar lecturas según tus gustos</li>
                    <li>Crear tu lista de lectura personalizada</li>
                    <li>Llevar un registro de libros leídos</li>
                    <li>Ver tus estadísticas de lectura</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const contentParts = parseMessageContent(message.content);
              
              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 shadow-md ${
                      message.role === 'user'
                        ? 'bg-green-500 text-white rounded-br-none'
                        : 'bg-white text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {contentParts.map((part, idx) => {
                      if (part.type === 'text') {
                        return (
                          <p key={idx} className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                            {part.data}
                          </p>
                        );
                      } else if (part.type === 'books') {
                        return (
                          <div key={idx}>
                            <BooksGrid books={part.data} title="Libros encontrados" />
                          </div>
                        );
                      } else if (part.type === 'reading_list') {
                        return (
                          <div key={idx}>
                            <BooksGrid books={part.data} title="Tu lista de lectura" />
                          </div>
                        );
                      } else if (part.type === 'stats') {
                        return (
                          <div key={idx}>
                            <StatsCard stats={part.data} />
                          </div>
                        );
                      }
                      return null;
                    })}
                    
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-green-100' : 'text-gray-400'
                    }`}>
                      {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-800 rounded-lg rounded-bl-none px-4 py-3 shadow-md max-w-[75%]">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                  <span className="text-sm text-gray-500">escribiendo...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 rounded-lg p-3 max-w-[75%] mx-auto shadow-md">
              <p className="font-semibold text-sm">Error</p>
              <p className="text-xs mt-1">{error.message}</p>
              {error.message.includes('429') || error.message.includes('rate-limited') ? (
                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                  El modelo alcanzó su límite. Espera unos minutos.
                </div>
              ) : null}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-gray-100 border-t border-gray-300 p-3">
        <form
          onSubmit={handleFormSubmit}
          className="max-w-2xl mx-auto"
        >
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Escribe un mensaje... ej: 'Recomiéndame libros de ciencia ficción'"
              disabled={isLoading}
              maxLength={1000}
              className="flex-1 bg-white border border-gray-300 text-gray-900 rounded-full px-5 py-3 focus:outline-none focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-400 text-sm shadow-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {isLoading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
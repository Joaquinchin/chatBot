import { z } from 'zod';
import { searchBooks, getBookDetails } from '@/lib/googleBooks';
import { 
  addToReadingList, 
  getReadingList, 
  markAsRead, 
  getReadingStats 
} from '@/lib/database';

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY no está configurada');
}

// CAMBIO: De 'edge' a 'nodejs' porque SQLite no funciona en Edge Runtime
export const runtime = 'nodejs';

// Definir el schema de las herramientas en formato OpenAI
const tools = [
  {
    type: "function",
    function: {
      name: "searchBooks",
      description: "Buscar libros en Google Books por título, autor, tema o palabras clave. Úsala cuando el usuario pida recomendaciones o busque libros específicos.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Término de búsqueda: título, autor, tema o palabras clave"
          },
          maxResults: {
            type: "number",
            description: "Número máximo de resultados (default: 5, máximo: 10)",
            default: 5
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getBookDetails",
      description: "Obtener información detallada de un libro específico usando su ID de Google Books. Úsala cuando el usuario pregunte por más detalles de un libro.",
      parameters: {
        type: "object",
        properties: {
          bookId: {
            type: "string",
            description: "ID único del libro en Google Books"
          }
        },
        required: ["bookId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "addToReadingList",
      description: "Agregar un libro a la lista de lectura del usuario. Úsala cuando el usuario diga 'agrega a mi lista', 'guárdalo', 'quiero leerlo', etc.",
      parameters: {
        type: "object",
        properties: {
          bookId: {
            type: "string",
            description: "ID del libro en Google Books"
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Prioridad del libro (opcional)"
          },
          notes: {
            type: "string",
            description: "Notas personales sobre el libro (opcional)"
          }
        },
        required: ["bookId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getReadingList",
      description: "Obtener la lista de libros pendientes por leer del usuario. Úsala cuando el usuario pregunte '¿qué libros tengo en mi lista?', 'muéstrame mi lista', etc.",
      parameters: {
        type: "object",
        properties: {
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Filtrar por prioridad (opcional)"
          },
          limit: {
            type: "number",
            description: "Número máximo de resultados (opcional)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "markAsRead",
      description: "Marcar un libro como leído y opcionalmente agregar rating/review. Úsala cuando el usuario diga 'ya leí X', 'terminé de leer X', 'marco como leído', etc.",
      parameters: {
        type: "object",
        properties: {
          bookId: {
            type: "string",
            description: "ID del libro en Google Books"
          },
          rating: {
            type: "number",
            description: "Calificación de 1-5 estrellas (opcional)",
            minimum: 1,
            maximum: 5
          },
          review: {
            type: "string",
            description: "Reseña personal del libro (opcional)"
          }
        },
        required: ["bookId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getReadingStats",
      description: "Obtener estadísticas de lectura del usuario. Úsala cuando el usuario pregunte '¿cuántos libros he leído?', 'muéstrame mis estadísticas', etc.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["all-time", "year", "month"],
            description: "Período de tiempo para las estadísticas (opcional, default: all-time)"
          }
        },
        required: []
      }
    }
  }
];

// Ejecutar la herramienta correspondiente
async function executeToolCall(toolName: string, args: any) {
  console.log(`🔧 Ejecutando herramienta: ${toolName}`, args);
  
  switch (toolName) {
    case 'searchBooks':
      const books = await searchBooks(args.query, args.maxResults || 5);
      console.log(`📚 Encontrados ${books.length} libros`);
      return books;
      
    case 'getBookDetails':
      const bookDetails = await getBookDetails(args.bookId);
      console.log(`✅ Detalles obtenidos: ${bookDetails.title}`);
      return bookDetails;
      
    case 'addToReadingList':
      // Primero obtener info del libro
      const bookInfo = await getBookDetails(args.bookId);
      // Luego agregarlo a la lista
      const addResult = addToReadingList({
        bookId: args.bookId,
        title: bookInfo.title,
        authors: bookInfo.authors,
        thumbnail: bookInfo.thumbnail,
        priority: args.priority,
        notes: args.notes
      });
      console.log(`📝 ${addResult.message}`);
      return addResult;
      
    case 'getReadingList':
      const readingList = getReadingList({
        priority: args.priority,
        limit: args.limit
      });
      console.log(`📚 Lista de lectura: ${readingList.length} libros`);
      return readingList;
      
    case 'markAsRead':
      // Obtener info del libro
      const bookToMark = await getBookDetails(args.bookId);
      // Marcarlo como leído
      const markResult = markAsRead({
        bookId: args.bookId,
        title: bookToMark.title,
        authors: bookToMark.authors,
        thumbnail: bookToMark.thumbnail,
        rating: args.rating,
        review: args.review,
        pageCount: bookToMark.pageCount
      });
      console.log(`✅ ${markResult.message}`);
      return markResult;
      
    case 'getReadingStats':
      const stats = getReadingStats(args.period);
      console.log(`📊 Estadísticas calculadas`);
      return stats;
      
    default:
      throw new Error(`Herramienta desconocida: ${toolName}`);
  }
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  try {
    const { messages } = await req.json();

    console.log('🔧 Iniciando chat con tool calling');
    console.log('📩 Mensajes recibidos:', messages.length);

    // Preparar los mensajes con el system prompt
    const allMessages = [
      {
        role: 'system',
        content: `Eres un asistente experto en recomendación de libros. 

Tus responsabilidades:
- Ayudar a los usuarios a descubrir libros interesantes
- Usar la herramienta 'searchBooks' cuando el usuario busque o pida recomendaciones
- Usar 'getBookDetails' cuando el usuario quiera saber más sobre un libro específico
- Ser conversacional, amigable y entusiasta sobre los libros
- Proporcionar resúmenes claros y concisos

Cuando muestres resultados de búsqueda:
- Lista máximo 5 libros
- Incluye título, autor y una breve descripción
- Ofrece obtener más detalles si el usuario está interesado

Siempre responde en español.`
      },
      ...messages
    ];

    // Llamar a OpenRouter con tool calling habilitado
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free',
        messages: allMessages,
        tools,
        tool_choice: 'auto',
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter error: ${JSON.stringify(errorData)}`);
    }

    // Crear stream de respuesta
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';
        let toolCallsBuffer: any[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

              const data = trimmedLine.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                // Manejar tool calls
                if (delta?.tool_calls) {
                  console.log('🔧 Tool calls detectados:', delta.tool_calls);
                  
                  for (const toolCall of delta.tool_calls) {
                    // Acumular tool calls
                    if (!toolCallsBuffer[toolCall.index]) {
                      toolCallsBuffer[toolCall.index] = {
                        id: toolCall.id,
                        type: toolCall.type,
                        function: { name: '', arguments: '' }
                      };
                    }
                    
                    if (toolCall.function?.name) {
                      toolCallsBuffer[toolCall.index].function.name = toolCall.function.name;
                    }
                    
                    if (toolCall.function?.arguments) {
                      toolCallsBuffer[toolCall.index].function.arguments += toolCall.function.arguments;
                    }
                  }
                }

                // Enviar contenido de texto normal
                if (delta?.content) {
                  const content = delta.content
                    .replace(/\[\/s>/g, '')
                    .replace(/<\/s>/g, '')
                    .replace(/<s>/g, '');

                  if (content) {
                    const escaped = content
                      .replace(/\\/g, '\\\\')
                      .replace(/"/g, '\\"')
                      .replace(/\n/g, '\\n')
                      .replace(/\r/g, '\\r')
                      .replace(/\t/g, '\\t');

                    controller.enqueue(encoder.encode(`0:"${escaped}"\n`));
                  }
                }

                // Si la respuesta terminó y hay tool calls pendientes
                if (parsed.choices?.[0]?.finish_reason === 'tool_calls' && toolCallsBuffer.length > 0) {
                  console.log('🎯 Ejecutando tool calls acumulados');
                  
                  for (const toolCall of toolCallsBuffer) {
                    if (toolCall.function.name && toolCall.function.arguments) {
                      try {
                        const args = JSON.parse(toolCall.function.arguments);
                        const result = await executeToolCall(toolCall.function.name, args);
                        
                        // Formatear y enviar el resultado
                        let resultText = '';
                        
                        if (toolCall.function.name === 'searchBooks') {
                          resultText = '\n\n📚 Libros encontrados:\n\n';
                          result.forEach((book: any, index: number) => {
                            resultText += `${index + 1}. "${book.title}" - ${book.authors}\n`;
                            resultText += `   ${book.description}\n`;
                            resultText += `   Categorías: ${book.categories}\n`;
                            resultText += `   ID: ${book.id}\n\n`;
                          });
                        } else if (toolCall.function.name === 'getBookDetails') {
                          resultText = `\n\n📖 Detalles del libro:\n\n`;
                          resultText += `Título: ${result.title}\n`;
                          resultText += `Autor(es): ${result.authors}\n`;
                          resultText += `Páginas: ${result.pageCount}\n`;
                          resultText += `Editorial: ${result.publisher}\n`;
                          resultText += `Fecha: ${result.publishedDate}\n`;
                          resultText += `Categorías: ${result.categories}\n`;
                          resultText += `ID: ${result.id}\n\n`;
                          resultText += `Descripción: ${result.description}\n`;
                        } else if (toolCall.function.name === 'addToReadingList') {
                          resultText = `\n\n✅ ${result.message}\n`;
                        } else if (toolCall.function.name === 'getReadingList') {
                          if (result.length === 0) {
                            resultText = '\n\n📚 Tu lista de lectura está vacía.\n';
                          } else {
                            resultText = `\n\n📚 Tu lista de lectura (${result.length} libros):\n\n`;
                            result.forEach((book: any, index: number) => {
                              resultText += `${index + 1}. "${book.title}" - ${book.authors}\n`;
                              resultText += `   Prioridad: ${book.priority}\n`;
                              if (book.notes) resultText += `   Notas: ${book.notes}\n`;
                              resultText += `   Agregado: ${new Date(book.date_added).toLocaleDateString()}\n`;
                              resultText += `   ID: ${book.book_id}\n\n`;
                            });
                          }
                        } else if (toolCall.function.name === 'markAsRead') {
                          resultText = `\n\n✅ ${result.message}\n`;
                        } else if (toolCall.function.name === 'getReadingStats') {
                          resultText = `\n\n📊 Tus estadísticas de lectura (${result.period}):\n\n`;
                          resultText += `📚 Libros leídos: ${result.totalBooksRead}\n`;
                          resultText += `📖 Páginas leídas: ${result.totalPagesRead}\n`;
                          resultText += `⭐ Rating promedio: ${result.averageRating}/5\n`;
                          resultText += `✍️ Autor favorito: ${result.favoriteAuthor} (${result.favoriteAuthorCount} libros)\n`;
                          resultText += `📋 Libros pendientes: ${result.pendingBooks}\n`;
                        }
                        
                        const escaped = resultText
                          .replace(/\\/g, '\\\\')
                          .replace(/"/g, '\\"')
                          .replace(/\n/g, '\\n');
                        
                        controller.enqueue(encoder.encode(`0:"${escaped}"\n`));
                      } catch (toolError) {
                        console.error('Error ejecutando tool:', toolError);
                      }
                    }
                  }
                  
                  // Limpiar buffer
                  toolCallsBuffer = [];
                }

              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          }

          // Procesar buffer restante
          if (buffer.trim()) {
            const trimmedLine = buffer.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    const cleaned = content
                      .replace(/\[\/s>/g, '')
                      .replace(/<\/s>/g, '')
                      .replace(/<s>/g, '');
                    
                    if (cleaned) {
                      const escaped = cleaned
                        .replace(/\\/g, '\\\\')
                        .replace(/"/g, '\\"')
                        .replace(/\n/g, '\\n');
                      controller.enqueue(encoder.encode(`0:"${escaped}"\n`));
                    }
                  }
                } catch (e) {
                  console.error('Error parsing final buffer:', e);
                }
              }
            }
          }

        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error: any) {
    console.error('❌ Error en /api/chat:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al procesar la solicitud',
        message: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
import { z } from 'zod';
import { searchBooks, getBookDetails } from '@/lib/googleBooks';
import { 
  addToReadingList, 
  getReadingList, 
  markAsRead, 
  getReadingStats 
} from '@/lib/database';

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('DEEPSEEK_API_KEY no está configurada');
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
      
      // Formatear para que sea compatible con BooksGrid
      const formattedList = readingList.map((book: any) => ({
        id: book.book_id,
        title: book.title,
        authors: book.authors,
        thumbnail: book.thumbnail,
        description: book.notes || 'Sin notas adicionales',
        categories: `Prioridad: ${book.priority} • Agregado: ${new Date(book.date_added).toLocaleDateString('es-ES')}`
      }));
      
      return formattedList;
      
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

    // Validar y sanitizar inputs
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Formato de mensajes inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sanitizar cada mensaje
    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: typeof msg.content === 'string' 
        ? msg.content.trim().slice(0, 1000) // Limitar longitud
        : ''
    }));

    // Validar que hay al menos un mensaje
    if (sanitizedMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay mensajes para procesar' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔧 Iniciando chat con tool calling');
    console.log('📩 Mensajes recibidos:', sanitizedMessages.length);

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
      ...sanitizedMessages
    ];

    // Llamar a DeepSeek con tool calling habilitado
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout

    let response;
    try {
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: allMessages,
          tools,
          tool_choice: 'auto',
          stream: true,
        }),
        signal: controller.signal, // Agregar timeout
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DeepSeek error: ${JSON.stringify(errorData)}`);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: El modelo tardó demasiado en responder. Intenta con un modelo más rápido.');
      }
      throw error;
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
                  let content = delta.content
                    .replace(/\[\/s>/g, '')
                    .replace(/<\/s>/g, '')
                    .replace(/<s>/g, '');

                  // Filtrar marcadores de tools que el LLM genera incorrectamente
                  content = content
                    .replace(/__TOOL_START__\w+__TOOL_START__/g, '')
                    .replace(/\|_tool_sep_\|/g, '')
                    .replace(/>\{"bookId":/g, '')
                    .replace(/>_tool_call_end_\|/g, '')
                    .replace(/_tool_calls_end_\|/g, '')
                    .replace(/\|_tool_call_end_\|/g, '')
                    .replace(/><\|/g, '');

                  if (content.trim()) {
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
                        
                        // Enviar resultados formateados según el tipo de tool
                        let formattedResult = '';
                        
                        if (toolCall.function.name === 'searchBooks' && Array.isArray(result)) {
                          // Enviar JSON embebido para que el frontend lo parsee
                          formattedResult = `\n\n<<BOOKS_DATA>>${JSON.stringify(result)}<<BOOKS_DATA>>\n\n`;
                        } else if (toolCall.function.name === 'getReadingList' && Array.isArray(result)) {
                          formattedResult = `\n\n<<READING_LIST_DATA>>${JSON.stringify(result)}<<READING_LIST_DATA>>\n\n`;
                        } else if (toolCall.function.name === 'getReadingStats') {
                          formattedResult = `\n\n<<STATS_DATA>>${JSON.stringify(result)}<<STATS_DATA>>\n\n`;
                        } else if (toolCall.function.name === 'addToReadingList') {
                          formattedResult = `\n\n✅ ${result.message}\n\n`;
                        } else if (toolCall.function.name === 'markAsRead') {
                          formattedResult = `\n\n✅ ${result.message}\n\n`;
                        } else if (toolCall.function.name === 'getBookDetails') {
                          formattedResult = `\n\n📖 **${result.title}**\n`;
                          formattedResult += `Autor(es): ${result.authors}\n`;
                          formattedResult += `Páginas: ${result.pageCount || 'N/A'}\n`;
                          if (result.publisher) formattedResult += `Editorial: ${result.publisher}\n`;
                          if (result.publishedDate) formattedResult += `Fecha: ${result.publishedDate}\n`;
                          formattedResult += `\n${result.description}\n\n`;
                        }
                        
                        const escapedResult = formattedResult
                          .replace(/\\/g, '\\\\')
                          .replace(/"/g, '\\"')
                          .replace(/\n/g, '\\n');
                        
                        controller.enqueue(encoder.encode(`0:"${escapedResult}"\n`));
                        
                      } catch (toolError) {
                        console.error('Error ejecutando tool:', toolError);
                        const errorMsg = `\n\n❌ Error: ${toolError instanceof Error ? toolError.message : 'Error desconocido'}\n`;
                        const escapedError = errorMsg
                          .replace(/\\/g, '\\\\')
                          .replace(/"/g, '\\"')
                          .replace(/\n/g, '\\n');
                        controller.enqueue(encoder.encode(`0:"${escapedError}"\n`));
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
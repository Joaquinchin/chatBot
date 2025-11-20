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
export const runtime = 'nodejs';

// Definir el schema de las herramientas en formato deepseek
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
    // DeepSeek manda la respuesta de a pedacitos (chunks), no todo junto de una.
    // La respuesta viene en formato SSE (Server-Sent Events), que son líneas tipo:
    // data: {"choices":[{"delta":{"content":"Hola"}}]}
    // data: {"choices":[{"delta":{"content":" mundo"}}]}
    // data: [DONE]
    //
    // El tema es que a veces los chunks vienen cortados a la mitad, tipo:
    // Chunk 1: "data: {\"choices\":[{\"delta\":"
    // Chunk 2: "{\"content\":\"Hola\"}}]}\n"
    // Por eso necesitás un BUFFER que acumule hasta tener líneas completas.
    
    const stream = new ReadableStream({
      async start(controller) {
        // Agarramos el reader del response de DeepSeek para leer de a cachitos
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        // buffer: acumula texto hasta que tengamos líneas completas
        // toolCallsBuffer: cuando DeepSeek quiere llamar una tool (ej: searchBooks), 
        //                  te la manda en pedazos aca  juntamos todas antes de ejecutar.
        let buffer = '';
        let toolCallsBuffer: any[] = [];

        try {
          // Loop infinito leyendo chunks hasta que DeepSeek termine
          while (true) {
            const { done, value } = await reader.read();
            if (done) break; // DeepSeek terminó de mandar todo

            // value es un Uint8Array (bytes), lo pasamos a string
            buffer += decoder.decode(value, { stream: true });
            
            // Cortamos por \n para procesar línea por línea
            const lines = buffer.split('\n');
            // La última línea probablemente está incompleta, la guardamos en el buffer
            buffer = lines.pop() || '';

            // Procesamos cada línea completa
            for (const line of lines) {
              const trimmedLine = line.trim();
              // DeepSeek manda líneas vacías o que no empiezan con "data:", las skippeamos
              if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

              // Le sacamos el "data: " del principio
              const data = trimmedLine.slice(6);
              // "[DONE]" significa que DeepSeek terminó
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                // CASO 1: DeepSeek quiere usar una tool (ej: buscar libros)
                // Los tool calls vienen en pedazos, tipo:
                // Chunk 1: {"tool_calls":[{"index":0,"function":{"name":"search"}}]}
                // Chunk 2: {"tool_calls":[{"index":0,"function":{"arguments":"{\"query\":"}}]}
                // Chunk 3: {"tool_calls":[{"index":0,"function":{"arguments":"\"Harry Potter\"}"}}]}
                // Tenemos que juntarlos todos antes de ejecutar
                if (delta?.tool_calls) {
                  console.log('🔧 Tool calls detectados:', delta.tool_calls);
                  
                  for (const toolCall of delta.tool_calls) {
                    // Si no existe el índice, lo creamos
                    if (!toolCallsBuffer[toolCall.index]) {
                      toolCallsBuffer[toolCall.index] = {
                        id: toolCall.id,
                        type: toolCall.type,
                        function: { name: '', arguments: '' }
                      };
                    }
                    
                    // Vamos concatenando el nombre y los argumentos
                    if (toolCall.function?.name) {
                      toolCallsBuffer[toolCall.index].function.name = toolCall.function.name;
                    }
                    
                    if (toolCall.function?.arguments) {
                      toolCallsBuffer[toolCall.index].function.arguments += toolCall.function.arguments;
                    }
                  }
                }

                // CASO 2: Texto normal del LLM (el chat común)
                if (delta?.content) {
                  let content = delta.content
                    // DeepSeek a veces mete tokens raros como <s>, </s>, los limpiamos
                    .replace(/\[\/s>/g, '')
                    .replace(/<\/s>/g, '')
                    .replace(/<s>/g, '');

                  // A veces DeepSeek se bugea y escribe sus propios marcadores de tools
                  // tipo "__TOOL_START__searchBooks" en vez de usar el sistema correcto.
                  // Los filtramos para que no aparezcan en pantalla.
                  content = content
                    .replace(/__TOOL_START__\w+__TOOL_START__/g, '')
                    .replace(/\|_tool_sep_\|/g, '')
                    .replace(/>\{"bookId":/g, '')
                    .replace(/>_tool_call_end_\|/g, '')
                    .replace(/_tool_calls_end_\|/g, '')
                    .replace(/\|_tool_call_end_\|/g, '')
                    .replace(/><\|/g, '');

                  if (content.trim()) {
                    // Escapamos caracteres especiales porque lo mandamos como string JSON
                    const escaped = content
                      .replace(/\\/g, '\\\\')
                      .replace(/"/g, '\\"')
                      .replace(/\n/g, '\\n')
                      .replace(/\r/g, '\\r')
                      .replace(/\t/g, '\\t');
                    // El formato 0:"texto" es el que espera el hook useChat de Vercel AI SDK
                    controller.enqueue(encoder.encode(`0:"${escaped}"\n`));
                  }
                }

                // CASO 3: DeepSeek terminó de mandar los tool calls, ahora los ejecutamos
                // finish_reason === 'tool_calls' significa "che, ejecutá estas funciones"
                if (parsed.choices?.[0]?.finish_reason === 'tool_calls' && toolCallsBuffer.length > 0) {
                  console.log('🎯 Ejecutando tool calls acumulados');
                  
                  // Ejecutamos cada tool call que juntamos
                  for (const toolCall of toolCallsBuffer) {
                    if (toolCall.function.name && toolCall.function.arguments) {
                      try {
                        // Los argumentos vienen como string JSON, los parseamos
                        const args = JSON.parse(toolCall.function.arguments);
                        // Llamamos a la función (searchBooks, addToReadingList, etc.)
                        const result = await executeToolCall(toolCall.function.name, args);
                        
                        // Formateamos el resultado según qué tool fue
                        let formattedResult = '';
                        
                        if (toolCall.function.name === 'searchBooks' && Array.isArray(result)) {
                          // Mandamos el JSON entre marcadores <<BOOKS_DATA>>...<<BOOKS_DATA>>
                          // El frontend (page.tsx) busca estos marcadores y renderiza las cards
                          formattedResult = `\n\n<<BOOKS_DATA>>${JSON.stringify(result)}<<BOOKS_DATA>>\n\n`;
                        } else if (toolCall.function.name === 'getReadingList' && Array.isArray(result)) {
                          formattedResult = `\n\n<<READING_LIST_DATA>>${JSON.stringify(result)}<<READING_LIST_DATA>>\n\n`;
                        } else if (toolCall.function.name === 'getReadingStats') {
                          formattedResult = `\n\n<<STATS_DATA>>${JSON.stringify(result)}<<STATS_DATA>>\n\n`;
                        } else if (toolCall.function.name === 'addToReadingList') {
                          // Estos solo muestran un mensaje de confirmación
                          formattedResult = `\n\n✅ ${result.message}\n\n`;
                        } else if (toolCall.function.name === 'markAsRead') {
                          formattedResult = `\n\n✅ ${result.message}\n\n`;
                        } else if (toolCall.function.name === 'getBookDetails') {
                          // Formateamos bonito los detalles del libro
                          formattedResult = `\n\n📖 **${result.title}**\n`;
                          formattedResult += `Autor(es): ${result.authors}\n`;
                          formattedResult += `Páginas: ${result.pageCount || 'N/A'}\n`;
                          if (result.publisher) formattedResult += `Editorial: ${result.publisher}\n`;
                          if (result.publishedDate) formattedResult += `Fecha: ${result.publishedDate}\n`;
                          formattedResult += `\n${result.description}\n\n`;
                        }
                        
                        // Escapamos y mandamos al frontend
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
                  
                  // Limpiamos el buffer para la próxima
                  toolCallsBuffer = [];
                }

              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }
          }

          // Si quedó algo en el buffer al final (última línea incompleta), la procesamos
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
          // Siempre cerramos el stream al terminar
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
import { z } from 'zod';

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY no está configurada');
}

// Validación básica
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(4000),
});
const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
});

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json(); // recibimos del front
    const parsed = requestSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error('Validation error:', parsed.error.issues);
      return new Response(
        JSON.stringify({ error: 'Datos inválidos', details: parsed.error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sanitized = parsed.data.messages.map(m => ({
      role: m.role,
      content: m.content.trim().slice(0, 4000), // sacana espacios y limite de 4000 caracteres, previo a mandarle a OpenRouter
    }));

    console.log('Sending request to OpenRouter with', sanitized.length, 'messages');

    // Llamar directamente a OpenRouter con fetch
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'ChatBot App',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
        messages: sanitized,
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter error:', response.status, errorData);
      
      return new Response(
        JSON.stringify({ 
          error: 'Error de OpenRouter', 
          status: response.status,
          message: errorData 
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('OpenRouter response OK, starting stream');

    // Convertir el stream de OpenRouter al formato que useChat espera
    const stream = OpenRouterStream(response);
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });

  } catch (error: any) {
    console.error('Error en /api/chat:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error al procesar la solicitud', 
        message: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Función para convertir el stream que llega de OpenRouter al formato que useChat espera
// useChat espera el formato: "0:"texto"\n" (cada chunk con índice y comillas), ose
// openRouter no manda en palabras sino que en lineas (osea cada linea o chunk es una linea separada), cada linea empieza con "data: " y 
// \n es para separar cada chunk 
function OpenRouterStream(response: Response): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder(); // para convertir bytes a string

  return new ReadableStream({ // nuestro tubo donde viaja todo el stream
    async start(controller) {
      const reader = response.body?.getReader(); // lector del stream de OpenRouter
      if (!reader) {
        console.error('No reader available');
        controller.close();
        return;
      }

      let buffer = ''; // por si los datos no llegan completos en un solo chunk

      try {
        while (true) { // hasta que no nos llega el done seguimos leyendo y esperando datos
          const { done, value } = await reader.read();
          if (done) {
            // Enviar mensaje de finalización para que useChat sepa que terminó
            console.log('Stream finished, sending completion signal');
            break;
          }

          // Acumular el chunk en el buffer, aca vamos armando las chunks hasta tener lineas completas osea palabras completas osea hastya que llega el \n y es el siguiente chunk
          buffer += decoder.decode(value, { stream: true }); 
          
          // Procesar líneas completas divide por \n 
          const lines = buffer.split('\n');
          // Guardar la última línea incompleta en el buffer, si esta completa se procesa en la siguiente iteración y este queda vacío
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine === '') continue;
            
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              
              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                let content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  // Limpiar tokens especiales del modelo (como [/s>, </s>, <s>, etc.)
                  content = content
                    .replace(/^\[\/s>\s*/g, '')  // Remover [/s> al inicio
                    .replace(/^\<\/s>\s*/g, '')  // Remover </s> al inicio
                    .replace(/^\<s>\s*/g, '')    // Remover <s> al inicio
                    .replace(/\[\/s>\s*$/g, '')  // Remover [/s> al final
                    .replace(/\<\/s>\s*$/g, '')  // Remover </s> al final
                    .replace(/\<s>\s*$/g, '');   // Remover <s> al final
                  
                  // Si después de limpiar no queda nada, skip
                  if (!content) continue;
                  
                  // Escapar caracteres especiales
                  const escaped = content
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
                  
                  // Formato esperado por useChat: "0:"contenido"\n"
                  const formattedChunk = `0:"${escaped}"\n`;
                  controller.enqueue(encoder.encode(formattedChunk));
                }
              } catch (e) {
                console.error('Error parsing JSON:', e, 'Data:', data);
                // No lanzar error, solo continuar
              }
            }
          }
        }

        // Procesar cualquier dato restante en el buffer
        if (buffer.trim()) {
          console.log('Processing remaining buffer:', buffer);
          const trimmedLine = buffer.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                let content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  // Limpiar tokens especiales
                  content = content
                    .replace(/^\[\/s>\s*/g, '')
                    .replace(/^\<\/s>\s*/g, '')
                    .replace(/^\<s>\s*/g, '')
                    .replace(/\[\/s>\s*$/g, '')
                    .replace(/\<\/s>\s*$/g, '')
                    .replace(/\<s>\s*$/g, '');
                  
                  if (!content) return;
                  
                  const escaped = content
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
                  const formattedChunk = `0:"${escaped}"\n`;
                  controller.enqueue(encoder.encode(formattedChunk));
                }
              } catch (e) {
                console.error('Error parsing remaining buffer:', e);
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
}

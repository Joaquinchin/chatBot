'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef } from 'react';

export default function ChatPage() {
  // Hook de Vercel AI SDK - Maneja TODO el estado del chat automáticamente
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/chat', // Endpoint del backend
  });

  // Ref para hacer scroll automático al último mensaje
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Log para debug
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

  // Scroll automático cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-green-600 shadow-md p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-white text-center">
            ChatBot IA
          </h1>
          <p className="text-center text-green-100 text-xs mt-0.5">
            Powered by OpenRouter
          </p>
        </div>
      </header>

      {/* Área de mensajes con fondo tipo WhatsApp */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d5db' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#e5ddd5'
        }}
      >
        <div className="max-w-4xl mx-auto space-y-3 pb-4">
          {messages.length === 0 ? (
            // Pantalla de bienvenida
            <div className="text-center mt-20 space-y-3">
              <div className="bg-white/90 rounded-lg shadow-md p-6 max-w-sm mx-auto">
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  Bienvenido
                </h2>
                <p className="text-gray-600 text-sm">
                  Escribe un mensaje para comenzar la conversación
                </p>
              </div>
            </div>
          ) : (
            // Mensajes del chat
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 shadow-md ${
                    message.role === 'user'
                      ? 'bg-green-500 text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm leading-relaxed break-words">
                    {message.content}
                  </p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-green-100' : 'text-gray-400'
                  }`}>
                    {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}

          {/* Indicador de carga */}
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

          {/* Mostrar errores */}
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

          {/* Ref para scroll automático */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Formulario de entrada tipo WhatsApp */}
      <div className="bg-gray-100 border-t border-gray-300 p-3">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto"
        >
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Escribe un mensaje..."
              disabled={isLoading}
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
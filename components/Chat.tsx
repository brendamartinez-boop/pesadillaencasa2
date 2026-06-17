'use client';
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

interface ChatProps {
  familyId: string;
  userId: string;
  displayName: string;
  photoURL: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  message: string;
  createdAt: any;
}

export default function Chat({ familyId, userId, displayName, photoURL }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedText, setTypedText] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Fetch messages
  useEffect(() => {
    if (!familyId) return;

    const q = query(
      collection(db, 'chat_messages'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docsArr: Message[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        docsArr.push({
          id: docSnap.id,
          senderId: d.senderId,
          senderName: d.senderName || 'Invitado',
          senderPhoto: d.senderPhoto || '',
          message: d.message,
          createdAt: d.createdAt
        });
      });
      setMessages(docsArr);
      
      // Auto scroll
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'chat_messages');
    });

    return () => unsub();
  }, [familyId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim()) return;

    try {
      await addDoc(collection(db, 'chat_messages'), {
        familyId,
        senderId: userId,
        senderName: displayName,
        senderPhoto: photoURL,
        message: typedText.trim(),
        createdAt: serverTimestamp()
      });
      setTypedText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chat_messages');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="text-blue-500 w-5 h-5" />
          Chat Grupal Familiar
        </h3>
        <p className="text-xs text-slate-400 font-mono">Bandeja familiar</p>
      </div>

      {/* Messages stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 pb-3 scroll-smooth scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-mono">
            💬 No hay mensajes en la mesa. ¡Toma el micro o saluda!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === userId;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 p-1.5 rounded-lg max-w-[85%] ${
                  isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 text-center flex items-center justify-center font-bold font-mono text-xs overflow-hidden">
                  {msg.senderPhoto ? (
                    <img src={msg.senderPhoto} alt="pic" className="w-8 h-8 object-cover rounded-full" />
                  ) : (
                    <span>{msg.senderName.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Bubble content */}
                <div>
                  <p className={`text-[10px] font-mono text-slate-400 ${isMe ? 'text-right' : 'text-left'}`}>
                    {msg.senderName}
                  </p>
                  <div
                    className={`mt-1 p-2.5 rounded-2xl text-xs font-sans leading-relaxed break-words border ${
                      isMe
                        ? 'bg-blue-500 border-blue-500 text-white rounded-tr-none'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800 rounded-tl-none'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Form sender */}
      <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1">
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="Escribe un mensaje de casa..."
          className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white p-2.5 rounded-xl transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

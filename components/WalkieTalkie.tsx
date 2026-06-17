'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Radio, Volume2, Mic, MicOff, Lock, Speaker, Ban } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface WalkieTalkieProps {
  familyId: string;
  userId: string;
  displayName: string;
  isBlockedByAdmin: boolean;
}

export default function WalkieTalkie({ familyId, userId, displayName, isBlockedByAdmin }: WalkieTalkieProps) {
  const [talking, setTalking] = useState(false);
  const [activeSpeakerName, setActiveSpeakerName] = useState<string | null>(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [syntheticMessages] = useState([
    '📢 ¡Familia, asamblea urgente en el salón!',
    '🧼 ¡Alguien ha dejado la cocina hecha un desastre!',
    '🗑️ ¡Por favor, sacad la basura que huele mal!',
    '🙌 ¡He terminado todos mis deberes del día!',
    '🍔 ¡La comida está lista, a la mesa!'
  ]);

  const speakSynthetic = async (text: string) => {
    if (isBlockedByAdmin) return;
    try {
      const walkieRef = doc(db, 'walkie_talkie', familyId);
      await setDoc(walkieRef, {
        familyId,
        activeSpeaker: userId,
        activeSpeakerName: `${displayName} (Sintético)`,
        syntheticText: text,
        timestamp: serverTimestamp()
      });
      // automatically release after 3s
      setTimeout(async () => {
        await updateDoc(walkieRef, {
          activeSpeaker: null,
          activeSpeakerName: null,
          syntheticText: null
        });
      }, 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `walkie_talkie/${familyId}`);
    }
  };

  // Listen to Walkie Talkie document changes
  useEffect(() => {
    if (!familyId) return;

    const walkieRef = doc(db, 'walkie_talkie', familyId);
    const unsub = onSnapshot(walkieRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveSpeakerName(data.activeSpeakerName || null);
        setActiveSpeakerId(data.activeSpeaker || null);
        
        // If there's an incoming audio payload and it's not from us, play it!
        if (data.audioData && data.activeSpeaker !== userId) {
          try {
            const audio = new Audio(data.audioData);
            audio.play().catch(e => console.error("Auto playback prevented:", e));
          } catch (e) {
            console.error("Audio play fail:", e);
          }
        }

        // Handle synthetic speech fallback
        if (data.syntheticText && data.activeSpeaker !== userId) {
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(data.syntheticText);
            utterance.lang = 'es-ES';
            window.speechSynthesis.speak(utterance);
          }
        }
      }
    });

    return () => unsub();
  }, [familyId, userId]);

  const startRecording = async () => {
    if (isBlockedByAdmin) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setMicGranted(true);

      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          // Upload audio to Firestore
          const walkieRef = doc(db, 'walkie_talkie', familyId);
          await setDoc(walkieRef, {
            familyId,
            activeSpeaker: userId,
            activeSpeakerName: displayName,
            audioData: base64data,
            timestamp: serverTimestamp()
          });

          // Reset active speaker state after playing or delay
          setTimeout(async () => {
            const freshRef = doc(db, 'walkie_talkie', familyId);
            await updateDoc(freshRef, {
              activeSpeaker: null,
              activeSpeakerName: null,
              audioData: null
            });
          }, 3000);
        };
        reader.readAsDataURL(blob);

        // Turn off lines
        stream.getTracks().forEach(t => t.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setTalking(true);

      // Save speaking state
      const walkieRef = doc(db, 'walkie_talkie', familyId);
      await setDoc(walkieRef, {
        familyId,
        activeSpeaker: userId,
        activeSpeakerName: displayName,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn("Microphone access blocked or failed. Using synthesis fallback", err);
      setMicGranted(false);
      setTalking(true);
      // fallback state on Firestore
      const walkieRef = doc(db, 'walkie_talkie', familyId);
      await setDoc(walkieRef, {
        familyId,
        activeSpeaker: userId,
        activeSpeakerName: `${displayName} (Alerta)`,
        timestamp: serverTimestamp()
      });
    }
  };

  const stopRecording = async () => {
    setTalking(false);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
    }

    // Release speaking state
    const walkieRef = doc(db, 'walkie_talkie', familyId);
    await updateDoc(walkieRef, {
      activeSpeaker: null,
      activeSpeakerName: null
    }).catch(e => console.error("Release error:", e));
  };

  if (isBlockedByAdmin) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900 border-dashed rounded-2xl p-8 text-center space-y-4">
        <div className="bg-red-100 dark:bg-red-900/40 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-red-500 animate-pulse">
          <Lock className="w-8 h-8" />
        </div>
        <h4 className="text-lg font-extrabold text-red-600 dark:text-red-400">🔒 AUDIO BLOQUEADO EN TUTELA 🔒</h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
          Los administradores del hogar han suspendido temporalmente tu acceso al Walkie-Talkie de audio por no haber terminado tus tareas pendientes. ¡Vuelve al orden familiar para reactivarlo!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Radio className="text-blue-500 w-5 h-5 animate-pulse" />
          Walkie-Talkie Escolar y Familiar
        </h3>
        <p className="text-xs text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
          <Volume2 className="w-3.5 h-3.5" /> Canales listos
        </p>
      </div>

      <div className="space-y-6 text-center">
        <p className="text-xs text-slate-500">
          Mantén presionado el botón de micro para hablarle en tiempo real a todos los miembros de tu casa, o pulsa un aviso directo.
        </p>

        {activeSpeakerName ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-300 rounded-xl max-w-sm mx-auto animate-bounce">
            <Speaker className="w-6 h-6 text-emerald-500 mx-auto mb-1 animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escuchando a:</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeSpeakerName}</p>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm mx-auto">
            <p className="text-xs font-mono text-slate-400">Canal en espera (PULSAR PARA HABLAR)</p>
          </div>
        )}

        <div className="flex flex-col items-center justify-center space-y-4">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 ${
              talking
                ? 'bg-red-500 text-white shadow-red-500/30'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/25'
            }`}
          >
            {talking ? (
              <div className="flex flex-col items-center">
                <Mic className="w-10 h-10 animate-bounce" />
                <span className="text-[10px] font-black uppercase mt-1 tracking-tight">HABLANDO</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Mic className="w-10 h-10" />
                <span className="text-[10px] font-bold uppercase mt-1 tracking-tight font-mono">Presionar</span>
              </div>
            )}
          </button>
          
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
            {talking ? '¡Suelta para transmitir sonido!' : 'Mantén pulsado o usa avisos de abajo:'}
          </p>
        </div>

        {/* Synthetic direct alerts fallback */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 text-left mb-2">📢 Avisos directos rápidos (Texto-a-Voz):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {syntheticMessages.map((msg, i) => (
              <button
                key={i}
                onClick={() => speakSynthetic(msg)}
                className="text-left bg-slate-50 hover:bg-blue-50 dark:bg-slate-950/40 dark:hover:bg-blue-950/20 text-xs text-slate-600 dark:text-slate-300 p-2 rounded-lg border border-slate-200 dark:border-slate-800 transition-all text-ellipsis overflow-hidden whitespace-nowrap font-sans font-medium"
              >
                {msg}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

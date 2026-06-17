'use client';
import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface AlarmProps {
  onClose: () => void;
  message?: string;
}

export default function Alarm({ onClose, message = 'Infracción o rechazo de tarea detectado' }: AlarmProps) {
  useEffect(() => {
    // Automatically close the alarm after 3 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    // Try to trigger a browser rumble/vivel if available
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate([100, 50, 100, 50, 100]);
    }

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-red-600/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-pulse">
      <div className="bg-black text-white p-6 rounded-2xl border-4 border-red-500 shadow-2xl shadow-red-500/50 max-w-sm w-full text-center space-y-4">
        <div className="flex justify-center flex-col items-center">
          <AlertCircle className="w-16 h-16 text-red-500 animate-bounce" />
          <h2 className="text-xl font-bold tracking-tight text-red-500 mt-2">🚨 ¡ALERTA PARENTAL! 🚨</h2>
        </div>
        <p className="text-sm font-mono text-gray-300">
          {message}
        </p>
        <div className="text-xs text-red-400 bg-red-950/50 p-2 rounded border border-red-900 font-mono">
          Este incidente ha sido registrado en {"Pesadilla en Casa"}.
        </div>
        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white py-2 px-4 rounded-xl font-bold font-sans text-xs"
        >
          Aceptar corrección
        </button>
      </div>
    </div>
  );
}

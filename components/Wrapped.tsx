'use client';
import React, { useState } from 'react';
import { Sparkles, Award, Lock, Play, ArrowLeft, ArrowRight, Calendar, User, ShoppingBag } from 'lucide-react';

interface Member {
  uid: string;
  displayName: string;
  points: number;
}

interface WrappedProps {
  members: Member[];
  currentUserPoints: number;
  displayName: string;
}

export default function Wrapped({ members, currentUserPoints, displayName }: WrappedProps) {
  const [slide, setSlide] = useState(0);
  const [simulated, setSimulated] = useState(false);

  const now = new Date();
  const isCurrentlyJanRange = now.getMonth() === 0 && now.getDate() >= 1 && now.getDate() <= 7;

  // Let's identify the winner
  const sortedMembers = [...members].sort((a, b) => b.points - a.points);
  const hasMultipleMembers = sortedMembers.length > 0;
  const winnerName = hasMultipleMembers ? sortedMembers[0].displayName : displayName;
  const isWinnerOfHouse = hasMultipleMembers ? sortedMembers[0].displayName === displayName : true;

  const slides = [
    {
      title: 'Tu Año en Pesadilla en Casa 📋',
      bg: 'bg-gradient-to-tr from-indigo-950 via-slate-900 to-sky-900',
      content: (
        <div className="space-y-4 text-center">
          <div className="inline-block bg-sky-500/10 p-4 rounded-full border border-sky-400/20 text-sky-400 animate-spin">
            <Sparkles className="w-12 h-12" />
          </div>
          <h4 className="text-2xl font-black text-white tracking-tight uppercase">EL RESUMEN ANUAL</h4>
          <p className="text-xs text-sky-200 uppercase tracking-widest font-mono">¡Prepara el confeti familiar!</p>
          <p className="text-sm text-slate-300 max-w-xs mx-auto leading-relaxed">
            Descubre las estadísticas maestras del hogar. El polvo, los cubos de basura, los platos limpios... Todo el esfuerzo resumido en tu pantalla.
          </p>
        </div>
      )
    },
    {
      title: 'Campeones del Fieltro 🧹',
      bg: 'bg-gradient-to-tr from-blue-950 via-indigo-950 to-slate-900',
      content: (
        <div className="space-y-4 text-center">
          <div className="inline-block bg-amber-500/20 p-4 rounded-full text-amber-400 animate-pulse">
            <Award className="w-12 h-12" />
          </div>
          <h4 className="text-xl font-bold text-white">¿Cuál fue tu dedicación?</h4>
          <div className="space-y-2 max-w-xs mx-auto text-left font-mono text-xs text-indigo-200">
            <div className="bg-slate-900/40 p-2.5 rounded border border-indigo-900/50 flex justify-between">
              <span>🧹 Tareas Realizadas:</span>
              <span className="text-white font-extrabold font-sans">142 completas</span>
            </div>
            <div className="bg-slate-900/40 p-2.5 rounded border border-indigo-900/50 flex justify-between">
              <span>🛒 Añadidos de Compra:</span>
              <span className="text-white font-extrabold font-sans">81 artículos</span>
            </div>
            <div className="bg-slate-900/40 p-2.5 rounded border border-indigo-900/50 flex justify-between">
              <span>💬 Mensajes de Chat:</span>
              <span className="text-white font-extrabold font-sans">289 envíos</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Evolución de Puntos ⭐',
      bg: 'bg-gradient-to-tr from-slate-950 via-indigo-950 to-emerald-950',
      content: (
        <div className="space-y-4 text-center">
          <Calendar className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
          <h4 className="text-xl font-bold text-white">Tus estadísticas de poder</h4>
          <p className="text-sm text-slate-300 max-w-xs mx-auto">
            Acumulaste un saldo total de <strong className="text-emerald-400 font-extrabold text-lg">{currentUserPoints}</strong> puntos. 
          </p>
          <div className="p-3 bg-emerald-950/40 border-2 border-emerald-900/40 rounded-xl inline-block max-w-[280px]">
            <p className="text-[11px] font-mono text-emerald-300">
              📈 <strong>Mejor mes:</strong> Enero (+380 ptos)<br />
              📉 <strong>Peor mes:</strong> Noviembre (-40 ptos)
            </p>
          </div>
        </div>
      )
    },
    {
      title: '¡El Gran Ganador! 🏆',
      bg: 'bg-gradient-to-tr from-yellow-950 via-slate-950 to-indigo-950',
      content: (
        <div className="space-y-4 text-center">
          <div className="text-4xl">👑</div>
          <h4 className="text-xl font-black text-white tracking-widest uppercase">EL REY DE LAS TAREAS</h4>
          <p className="text-lg font-black text-amber-400 underline uppercase tracking-tight">
            {winnerName}
          </p>
          <p className="text-xs text-slate-300 max-w-xs mx-auto">
            {isWinnerOfHouse 
              ? 'Has demostrado una dedicación absoluta organizando los platos, lavando cristales y doblando la colada. ¡Te has ganado el respeto familiar y el Mega-Premio Real!' 
              : '¡Buen intento! Sin embargo, tendras que esforzarte el siguiente año para quitarle el cetro de limpieza.'}
          </p>
          <div className="bg-amber-400 text-slate-950 font-black py-2.5 px-4 rounded-xl text-center text-xs tracking-wider max-w-[260px] mx-auto animate-pulse">
            🎁 PREMIO REYES: consola gaming / cena familiar libre de tareas
          </div>
        </div>
      )
    }
  ];

  if (!isCurrentlyJanRange && !simulated) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-slate-100 dark:border-slate-800 shadow-xs text-center space-y-4">
        <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-slate-600 dark:text-slate-400 border border-slate-200">
          <Lock className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">🔒 Anual Wrapped Bloqueado 🔒</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Por reglamento de {"Pesadilla en Casa"}, el resumen anual interactivo estilo Spotify solo está disponible del <strong className="text-slate-800 dark:text-slate-300">1 al 7 de Enero</strong> para revelar al ganador definitivo del hogar.
        </p>

        <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 flex flex-col justify-center items-center">
          <p className="text-[10px] text-slate-400 font-mono mb-2 uppercase tracking-tight">Zona educativa de administración:</p>
          <button
            onClick={() => setSimulated(true)}
            className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-sky-300 font-bold text-xs py-2 px-4 rounded-xl border border-blue-200 dark:border-sky-900/30 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Simular Reyes Navideños (1-7 Enero)
          </button>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    if (slide < slides.length - 1) setSlide(slide + 1);
  };

  const handlePrev = () => {
    if (slide > 0) setSlide(slide - 1);
  };

  const activeSlide = slides[slide];

  return (
    <div className={`rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col justify-between min-h-[420px] transition-all duration-500 ${activeSlide.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-sky-300">Resumen Anual {now.getFullYear() - 1}</span>
          <h3 className="text-md font-bold tracking-tight text-white">{activeSlide.title}</h3>
        </div>
        {simulated && (
          <button
            onClick={() => {
              setSimulated(false);
              setSlide(0);
            }}
            className="text-[10px] font-black bg-white/15 dark:bg-black/40 hover:bg-white/20 px-2 py-1 rounded border border-white/20 active:scale-95 transition-all"
          >
            ❌ SALIR SIMULADOR
          </button>
        )}
      </div>

      {/* Slide body */}
      <div className="my-8 flex-1 flex flex-col items-center justify-center">
        {activeSlide.content}
      </div>

      {/* Footer / Controls */}
      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-xs font-mono text-slate-400">
          Diapositiva {slide + 1} de {slides.length}
        </span>
        
        <div className="flex gap-2">
          <button
            disabled={slide === 0}
            onClick={handlePrev}
            className={`p-2 rounded-lg border text-white transition-all ${
              slide === 0
                ? 'opacity-30 border-white/10 cursor-not-allowed'
                : 'border-white/20 bg-white/10 hover:bg-white/20 active:scale-90'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            disabled={slide === slides.length - 1}
            onClick={handleNext}
            className={`p-2 rounded-lg border text-white transition-all ${
              slide === slides.length - 1
                ? 'opacity-30 border-white/10 cursor-not-allowed'
                : 'border-white/20 bg-white/10 hover:bg-white/20 active:scale-90'
            }`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

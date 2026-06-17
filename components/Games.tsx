'use client';
import React, { useState } from 'react';
import { Gamepad2, Play, Users, Skull, Sparkles, RefreshCw } from 'lucide-react';

interface Member {
  uid: string;
  displayName: string;
  role: string;
}

interface GamesProps {
  members: Member[];
  onTriggerAlarm: (msg: string) => void;
  onTriggerConfetti: () => void;
}

export default function Games({ members, onTriggerAlarm, onTriggerConfetti }: GamesProps) {
  const [activeTab, setActiveTab] = useState<'roulette' | 'impostor'>('roulette');
  
  // Roulette state
  const chores = [
    '🧹 Barrer el salón',
    '🧽 Limpiar los baños',
    '🍽️ Lavar los platos',
    '🗑️ Sacar las basuras',
    '🐶 Pasear al perro',
    '🧺 Poner la lavadora',
    '🥗 Preparar la cena',
    '🛏️ Hacer las camas'
  ];
  const [spinning, setSpinning] = useState(false);
  const [selectedChore, setSelectedChore] = useState<string | null>(null);
  const [selectedVictim, setSelectedVictim] = useState<string | null>(null);

  // Impostor state
  const [scanning, setScanning] = useState(false);
  const [impostorResult, setImpostorResult] = useState<{ name: string; trait: string } | null>(null);

  const traits = [
    '¡Esconde las cacas del perro debajo del sofá!',
    '¡Finge estar dormido cuando hay que poner la mesa!',
    '¡Lava los platos aclarando solo con agua fría!',
    '¡Hace la cama colocando la colcha encima del desorden!',
    '¡Su cuarto parece zona catastrófica y dice que está organizado!',
    '¡Lleva 3 días usando los mismos calcetines del revés!'
  ];

  const spinRoulette = () => {
    if (spinning) return;
    setSpinning(true);
    setSelectedChore(null);
    setSelectedVictim(null);

    let count = 0;
    const interval = setInterval(() => {
      setSelectedChore(chores[Math.floor(Math.random() * chores.length)]);
      if (members.length > 0) {
        setSelectedVictim(members[Math.floor(Math.random() * members.length)].displayName);
      } else {
        setSelectedVictim('Invitado');
      }
      count++;
      if (count > 20) {
        clearInterval(interval);
        // Final selections
        const finalChore = chores[Math.floor(Math.random() * chores.length)];
        const finalVictim = members.length > 0 
          ? members[Math.floor(Math.random() * members.length)].displayName 
          : 'Invitado';
        
        setSelectedChore(finalChore);
        setSelectedVictim(finalVictim);
        setSpinning(false);
        onTriggerConfetti();
      }
    }, 100);
  };

  const scanImpostor = () => {
    if (scanning) return;
    setScanning(true);
    setImpostorResult(null);

    setTimeout(() => {
      if (members.length === 0) {
        setImpostorResult({
          name: 'Invitado',
          trait: traits[Math.floor(Math.random() * traits.length)]
        });
      } else {
        const randomMember = members[Math.floor(Math.random() * members.length)];
        setImpostorResult({
          name: randomMember.displayName,
          trait: traits[Math.floor(Math.random() * traits.length)]
        });
      }
      setScanning(false);
      onTriggerAlarm('¡Impostor de la limpieza detectado!');
    }, 2500);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Gamepad2 className="text-blue-500 w-5 h-5 animate-spin" />
          Sala de Juegos Familiares
        </h3>
        <p className="text-xs text-blue-500 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full">
          Pesadilla Arcade
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
        <button
          onClick={() => setActiveTab('roulette')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'roulette'
              ? 'bg-blue-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          🎡 Deberes Al Azar
        </button>
        <button
          onClick={() => setActiveTab('impostor')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'impostor'
              ? 'bg-slate-900 dark:bg-slate-950 text-red-500 border border-red-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          🕵️‍♂️ ¿Quién es el Impostor?
        </button>
      </div>

      {activeTab === 'roulette' ? (
        <div className="space-y-4 text-center">
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            ¿Discutiendo por quién friega los platos hoy? Gira la Ruleta del Caos para adjudicar un deber de forma neutra y pacífica.
          </p>

          <div className="py-6 flex flex-col items-center justify-center relative">
            <div className={`w-36 h-36 rounded-full border-8 border-slate-900 flex items-center justify-center bg-blue-50 dark:bg-sky-950/20 relative transition-transform duration-100 ${spinning ? 'animate-spin' : ''}`}>
              <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-blue-500/30 transform -translate-x-1/2"></div>
              <div className="absolute left-0 right-0 top-1/2 h-1 bg-blue-500/30 transform -translate-y-1/2"></div>
              <Sparkles className="w-12 h-12 text-blue-500" />
            </div>

            {selectedChore && selectedVictim && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-100 dark:border-blue-900/50 rounded-xl max-w-sm mx-auto animate-fade-in">
                <span className="text-xs uppercase tracking-wider text-blue-500 font-extrabold block">¡Sorteo Completado!</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  🎯 Tarea: <span className="text-blue-600 dark:text-sky-400 font-extrabold">{selectedChore}</span>
                </p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  👤 Asignado a: <span className="text-slate-900 dark:text-white font-extrabold underline">{selectedVictim}</span>
                </p>
              </div>
            )}

            <button
              onClick={spinRoulette}
              disabled={spinning}
              className={`mt-6 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                spinning
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-md shadow-blue-500/20'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} />
              {spinning ? 'Girando la Suerte...' : '¡Girar Ruleta Familiar!'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-xs text-slate-500">
            Escanea quién del hogar está escaqueándose de limpiar las pelusas de su habitación de forma cómica.
          </p>

          <div className="py-6 flex flex-col items-center justify-center">
            <div className={`w-32 h-32 rounded-2xl border-4 ${scanning ? 'border-red-500 animate-pulse bg-red-950/10' : 'border-slate-800'} flex items-center justify-center transition-all bg-slate-950 relative overflow-hidden`}>
              {scanning && (
                <div className="absolute inset-x-0 h-1 bg-red-500 shadow-[0_0_10px_#ef4444] animate-bounce top-1/2"></div>
              )}
              <Skull className={`w-14 h-14 ${scanning ? 'text-red-500 animate-bounce' : 'text-slate-700'}`} />
            </div>

            {scanning && (
              <p className="text-xs font-mono text-red-500 mt-4 animate-pulse">
                🔍 Escaneando hábitos familiares... buscando calcetines mugrientos...
              </p>
            )}

            {impostorResult && (
              <div className="mt-6 p-4 bg-red-950/20 border-2 border-red-500/40 rounded-xl max-w-sm mx-auto">
                <span className="text-xs uppercase tracking-wider text-red-500 font-extrabold block">🚨 Impostor Confirmado 🚨</span>
                <p className="text-lg font-black text-white mt-1 uppercase tracking-tight">
                  {impostorResult.name}
                </p>
                <p className="text-xs font-mono text-red-400 mt-2 italic bg-red-950/50 p-2 rounded border border-red-900/30">
                  &quot;{impostorResult.trait}&quot;
                </p>
              </div>
            )}

            <button
              onClick={scanImpostor}
              disabled={scanning}
              className={`mt-6 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                scanning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-slate-950 hover:bg-black active:scale-95 text-red-500 border-2 border-red-600 shadow-md shadow-red-500/10'
              }`}
            >
              <Users className="w-5 h-5 text-red-500" />
              {scanning ? 'Detectando Saboteador...' : '¡Escanear Impostor de Limpieza!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

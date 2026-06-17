'use client';
import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, Clock, ArrowDownRight, ArrowUpRight, ShieldAlert, Sparkles } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

interface StatsProps {
  familyId: string;
  userId: string;
  displayName: string;
  userRole: string; // 'admin' | 'child'
  members: { uid: string; displayName: string }[];
}

interface PointsLog {
  id: string;
  userId: string;
  pointsChange: number;
  reason: string;
  createdAt: any;
}

export default function Stats({ familyId, userId, displayName, userRole, members }: StatsProps) {
  const [selectedUser, setSelectedUser] = useState(userId);
  const [prevUserId, setPrevUserId] = useState(userId);
  const [history, setHistory] = useState<PointsLog[]>([]);
  const isAdmin = userRole === 'admin';

  if (userId !== prevUserId) {
    setSelectedUser(userId);
    setPrevUserId(userId);
  }

  // Fetch points history for the selected user
  useEffect(() => {
    if (!familyId || !selectedUser) return;

    const q = query(
      collection(db, 'points_history'),
      where('familyId', '==', familyId),
      where('userId', '==', selectedUser),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const arr: PointsLog[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data();
        arr.push({
          id: snap.id,
          userId: d.userId,
          pointsChange: d.pointsChange || 0,
          reason: d.reason || '',
          createdAt: d.createdAt
        });
      });
      // Sort desc for history feed, keep asc for chart calculations
      setHistory(arr);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'points_history');
    });

    return () => unsub();
  }, [familyId, selectedUser]);

  // Calculate coordinates for custom SVG lines
  const pointsEvol: number[] = [];
  let currentAccum = 0;
  pointsEvol.push(currentAccum); // base 0

  history.forEach(log => {
    currentAccum += log.pointsChange;
    pointsEvol.push(currentAccum);
  });

  // SVG Dimension params
  const chartWidth = 400;
  const chartHeight = 160;
  const padding = 20;

  const maxPoints = Math.max(...pointsEvol, 10);
  const minPoints = Math.min(...pointsEvol, 0);
  const range = maxPoints - minPoints;

  const pointsCount = pointsEvol.length;

  const getCoordinatesStr = () => {
    if (pointsCount < 2) return '';
    return pointsEvol.map((val, idx) => {
      const x = padding + (idx * (chartWidth - padding * 2)) / (pointsCount - 1);
      // invert Y axis for SVG
      const y = chartHeight - padding - ((val - minPoints) * (chartHeight - padding * 2)) / range;
      return `${x},${y}`;
    }).join(' ');
  };

  const polylineCoords = getCoordinatesStr();

  // Selected user display name
  const currentSelectedName = members.find(m => m.uid === selectedUser)?.displayName || displayName;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="text-blue-500 w-5 h-5" />
            Evolución y Gráfica de Puntos
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isAdmin ? `Visualizando a: ${currentSelectedName}` : 'Tu expediente y trayectoria'}
          </p>
        </div>

        {/* Dropdown for Admin to view other members */}
        {isAdmin && (
          <div className="w-full sm:w-auto">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-full cursor-pointer"
            >
              <option value={userId}>Yo ({displayName})</option>
              {members
                .filter(m => m.uid !== userId)
                .map(m => (
                  <option key={m.uid} value={m.uid}>
                    {m.displayName}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Line Chart */}
      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center">
        <span className="text-[10px] font-black font-mono text-blue-500 mb-2 uppercase tracking-widest">📈 Gráfica de Evolución Temporal:</span>
        
        {pointsCount < 2 ? (
          <div className="py-12 text-center text-xs text-slate-400 font-mono">
            📊 El usuario no tiene transacciones registradas aún. ¡Completa tareas para ver la curva!
          </div>
        ) : (
          <div className="w-full max-w-[400px]">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full overflow-visible"
            >
              {/* Grid Lines */}
              <line
                x1={padding}
                y1={padding}
                x2={chartWidth - padding}
                y2={padding}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.1"
              />
              <line
                x1={padding}
                y1={chartHeight / 2}
                x2={chartWidth - padding}
                y2={chartHeight / 2}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.1"
              />
              <line
                x1={padding}
                y1={chartHeight - padding}
                x2={chartWidth - padding}
                y2={chartHeight - padding}
                stroke="#334155"
                strokeWidth="1.5"
                opacity="0.2"
              />

              {/* Min & Max value Labels */}
              <text x={padding - 10} y={padding + 4} fill="#64748b" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="end">
                {maxPoints}p
              </text>
              <text x={padding - 10} y={chartHeight - padding + 4} fill="#64748b" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="end">
                {minPoints}p
              </text>

              {/* Polyline */}
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylineCoords}
              />

              {/* Trend points circles */}
              {pointsEvol.map((val, idx) => {
                const x = padding + (idx * (chartWidth - padding * 2)) / (pointsCount - 1);
                const y = chartHeight - padding - ((val - minPoints) * (chartHeight - padding * 2)) / range;
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r="4.5"
                    className="fill-blue-500 stroke-white dark:stroke-slate-900 border"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Historical List */}
      <div>
        <h4 className="text-xs font-black text-slate-400 font-mono uppercase tracking-wider mb-2 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          Historial de Puntos:
        </h4>
        
        {history.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No hay transacciones guardadas.</p>
        ) : (
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {[...history].reverse().map((log) => {
              const isGain = log.pointsChange >= 0;
              return (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isGain ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-500 dark:bg-rose-950/20'}`}>
                      {isGain ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {log.reason}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        Historial de puntos
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-black font-mono ${isGain ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isGain ? `+${log.pointsChange}` : log.pointsChange} ptos
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

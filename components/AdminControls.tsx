'use client';
import React, { useState, useEffect } from 'react';
import { Users, Shield, Lock, Unlock, ShieldAlert, Award, Star, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';

interface AdminControlsProps {
  familyId: string;
  userId: string;
  members: FamilyMember[];
  onTriggerAlarm: (msg: string) => void;
  onTriggerConfetti: () => void;
}

interface FamilyMember {
  uid: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'child';
  points: number;
}

export default function AdminControls({ familyId, userId, members, onTriggerAlarm, onTriggerConfetti }: AdminControlsProps) {
  const [globalBlocked, setGlobalBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [editingPointsId, setEditingPointsId] = useState<string | null>(null);
  const [pointsChangeVal, setPointsChangeVal] = useState(10);
  const [penalizationText, setPenalizationText] = useState('Día sin limpiar el cuarto');

  // Load family block rules (walkie-talkie)
  useEffect(() => {
    if (!familyId) return;

    const unsub = onSnapshot(doc(db, 'families', familyId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setGlobalBlocked(d.walkieTalkieBlockedAll || false);
        setBlockedUsers(d.walkieTalkieBlockedUsers || []);
      }
    });

    return () => unsub();
  }, [familyId]);

  const toggleGlobalWalkieLock = async () => {
    try {
      await updateDoc(doc(db, 'families', familyId), {
        walkieTalkieBlockedAll: !globalBlocked
      });
      onTriggerAlarm(!globalBlocked ? 'Walkie-Talkie familiar completamente Bloqueado.' : 'Walkie-Talkie reactivado.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${familyId}`);
    }
  };

  const toggleUserWalkieLock = async (memberId: string, isCurrentlyBlocked: boolean) => {
    try {
      const familyRef = doc(db, 'families', familyId);
      if (isCurrentlyBlocked) {
        await updateDoc(familyRef, {
          walkieTalkieBlockedUsers: arrayRemove(memberId)
        });
        onTriggerConfetti();
      } else {
        await updateDoc(familyRef, {
          walkieTalkieBlockedUsers: arrayUnion(memberId)
        });
        onTriggerAlarm('Acceso individual bloqueado por padres.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${familyId}`);
    }
  };

  const toggleMemberRole = async (member: FamilyMember) => {
    if (member.uid === userId) {
      onTriggerAlarm('No puedes auto-degradar tu rol de administrador supremo.');
      return;
    }
    const nextRole = member.role === 'admin' ? 'child' : 'admin';
    try {
      await updateDoc(doc(db, 'users', member.uid), {
        role: nextRole
      });
      onTriggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${member.uid}`);
    }
  };

  const alterUserPoints = async (member: FamilyMember, delta: number) => {
    const finalPoints = Math.max(0, member.points + delta);
    try {
      // 1. Update user score
      await updateDoc(doc(db, 'users', member.uid), {
        points: finalPoints
      });

      // 2. Add description log
      await addDoc(collection(db, 'points_history'), {
        familyId,
        userId: member.uid,
        pointsChange: delta,
        reason: delta >= 0 
          ? `Bonificación especial de padres: +${delta}p` 
          : `Penalización de padres: ${delta}p (${penalizationText})`,
        createdAt: serverTimestamp()
      });

      setEditingPointsId(null);
      if (delta >= 0) {
        onTriggerConfetti();
      } else {
        onTriggerAlarm('Puntos penalizados por el administrador.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${member.uid}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="text-blue-500 w-5 h-5 animate-pulse" />
          Poder Parental (Control Súper-Admin)
        </h3>
        <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full font-bold">
          Modo Padres Activo
        </p>
      </div>

      {/* Global Lock Controls */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest font-mono">🔒 Ajustes globales de voz:</h4>
        <div className="flex justify-between items-center bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/50 dark:border-slate-850">
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Silenciar Walkie-Talkie para todo el hogar</p>
            <p className="text-[10px] text-slate-400 font-mono">Apaga los micrófonos para todos los niños al instante.</p>
          </div>
          <button
            onClick={toggleGlobalWalkieLock}
            className={`py-1.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center gap-1 active:scale-95 ${
              globalBlocked
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-xs'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs'
            }`}
          >
            {globalBlocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {globalBlocked ? 'Silenciado' : 'Abierto'}
          </button>
        </div>
      </div>

      {/* Control on individual members */}
      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 font-mono uppercase tracking-wider">👥 Gestión Individual de Miembros:</h4>
        <div className="space-y-3">
          {members.map((member) => {
            const isUserAdmin = member.role === 'admin';
            const isUserLocked = blockedUsers.includes(member.uid) || globalBlocked;
            const isIndividualLocked = blockedUsers.includes(member.uid);
            
            return (
              <div
                key={member.uid}
                className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3"
              >
                {/* Profile card and role change */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold font-mono text-slate-700 text-sm overflow-hidden border">
                      {member.photoURL ? (
                        <img src={member.photoURL} alt="pic" className="w-10 h-10 object-cover rounded-full" />
                      ) : (
                        <span>{member.displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        {member.displayName}
                        {isUserAdmin && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Puntos: <strong className="text-blue-500">{member.points}</strong> | Rol: {isUserAdmin ? '👑 Admin (Padres)' : '👶 Miembro (Hijo)'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle role */}
                  <button
                    onClick={() => toggleMemberRole(member)}
                    className="text-[10px] font-black border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 py-1.5 px-2.5 rounded-lg transition-all active:scale-95"
                  >
                    Rol: {isUserAdmin ? 'Degradar a Hijo' : 'Hacer Admin'}
                  </button>
                </div>

                {/* Sub-controls for Children only */}
                {!isUserAdmin && (
                  <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-3 flex flex-wrap gap-2 justify-between items-center">
                    
                    {/* Block individual Walkie Talkie */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 font-sans">Bloquear Walkie:</span>
                      <button
                        onClick={() => toggleUserWalkieLock(member.uid, isIndividualLocked)}
                        className={`text-[9px] font-bold py-1 px-2.5 rounded-lg border transition-all active:scale-95 flex items-center gap-1 ${
                          isIndividualLocked
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {isIndividualLocked ? '🔒 Bloqueado' : '🔓 Permitido'}
                      </button>
                    </div>

                    {/* Alter points panel */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingPointsId(member.uid)}
                        className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-500 dark:text-sky-300 rounded-lg py-1 px-2.5 font-bold text-[10px] active:scale-95 transition-all border border-blue-200/40 dark:border-sky-900/40"
                      >
                        ⚡ Ajustar Puntos
                      </button>
                    </div>

                    {editingPointsId === member.uid && (
                      <div className="w-full bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 mt-2 space-y-2 animate-fade-in text-left">
                        <p className="text-[10px] font-bold text-slate-500">🔧 Bonificar o Penalizar puntos:</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              value={pointsChangeVal}
                              onChange={(e) => setPointsChangeVal(Math.max(1, Number(e.target.value)))}
                              placeholder="Ej: 10"
                              className="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs outline-none font-bold"
                            />
                            <button
                              onClick={() => alterUserPoints(member, pointsChangeVal)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-extrabold px-3 py-1 rounded transition-all active:scale-95"
                            >
                              + Otorgar
                            </button>
                            <button
                              onClick={() => alterUserPoints(member, -pointsChangeVal)}
                              className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-extrabold px-3 py-1 rounded transition-all active:scale-95"
                            >
                              - Penalizar
                            </button>
                            <button
                              onClick={() => setEditingPointsId(null)}
                              className="text-[10px] text-slate-400 font-mono px-1 hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                          
                          {/* Penalization reason input */}
                          <input
                            type="text"
                            value={penalizationText}
                            onChange={(e) => setPenalizationText(e.target.value)}
                            placeholder="Motivo (Requerido solo para penalizaciones)"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-300/20 rounded px-2 py-1 text-[10px] outline-none"
                          />
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

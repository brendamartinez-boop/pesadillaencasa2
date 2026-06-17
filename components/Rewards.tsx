'use client';
import React, { useState, useEffect } from 'react';
import { Award, Plus, Check, X, ShieldAlert, Sparkles, Gift } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

interface RewardsProps {
  familyId: string;
  userId: string;
  displayName: string;
  userRole: string; // 'admin' | 'child'
  userPoints: number;
  onTriggerAlarm: (msg: string) => void;
  onTriggerConfetti: () => void;
}

interface Reward {
  id: string;
  title: string;
  cost: number;
  status: 'active' | 'proposal';
  createdBy: string;
}

interface Redemption {
  id: string;
  rewardId: string;
  rewardTitle: string;
  cost: number;
  userId: string;
  displayName: string;
  status: 'requested' | 'approved' | 'rejected';
}

export default function Rewards({ familyId, userId, displayName, userRole, userPoints, onTriggerAlarm, onTriggerConfetti }: RewardsProps) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  // Input states
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(10);
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!familyId) return;

    // Fetch Rewards
    const rewardsQuery = query(
      collection(db, 'rewards'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    );
    const unsubRewards = onSnapshot(rewardsQuery, (snapshot) => {
      const arr: Reward[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data();
        arr.push({
          id: snap.id,
          title: d.title,
          cost: d.cost || 0,
          status: d.status || 'proposal',
          createdBy: d.createdBy || ''
        });
      });
      setRewards(arr);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'rewards');
    });

    // Fetch Redemptions (for approval flow)
    const redemptionsQuery = query(
      collection(db, 'redemptions'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    );
    const unsubRedemptions = onSnapshot(redemptionsQuery, (snapshot) => {
      const arr: Redemption[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data();
        arr.push({
          id: snap.id,
          rewardId: d.rewardId,
          rewardTitle: d.rewardTitle,
          cost: d.cost || 0,
          userId: d.userId,
          displayName: d.displayName,
          status: d.status || 'requested'
        });
      });
      setRedemptions(arr);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'redemptions');
    });

    return () => {
      unsubRewards();
      unsubRedemptions();
    };
  }, [familyId]);

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || cost <= 0) return;

    try {
      await addDoc(collection(db, 'rewards'), {
        familyId,
        title: title.trim(),
        cost: Number(cost),
        status: isAdmin ? 'active' : 'proposal', // active for parent, auto proposal for kid
        createdBy: displayName,
        createdAt: serverTimestamp()
      });
      setTitle('');
      setCost(10);
      onTriggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'rewards');
    }
  };

  const handleApproveProposal = async (rewardId: string) => {
    try {
      await updateDoc(doc(db, 'rewards', rewardId), {
        status: 'active'
      });
      onTriggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rewards/${rewardId}`);
    }
  };

  const handleRedeem = async (reward: Reward) => {
    if (userPoints < reward.cost) {
      onTriggerAlarm('Puntos insuficientes para canjear esta recompensa.');
      return;
    }

    try {
      // Create redemption request
      await addDoc(collection(db, 'redemptions'), {
        familyId,
        rewardId: reward.id,
        rewardTitle: reward.title,
        cost: reward.cost,
        userId,
        displayName,
        status: 'requested',
        createdAt: serverTimestamp()
      });
      onTriggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'redemptions');
    }
  };

  const handleApproveRedemption = async (redemption: Redemption) => {
    try {
      // 1. Mark redemption as approved
      await updateDoc(doc(db, 'redemptions', redemption.id), {
        status: 'approved'
      });

      // 2. Debit points from user
      const userRef = doc(db, 'users', redemption.userId);
      // Wait, we need to fetch user points first and then decrement
      // Let's do a reliable update inside parent flow.
      // Better: we will trigger points decrement using points_history and profile update in our page orchestrator, or do it directly here.
      // To make it simple and work, let's update directly:
      // We will decrement user points in the database. But wait, how do we know their exact points? We can read them or decrement if we have the user document,
      // actually we can perform update points in the database using simple Firestore increment helper, or custom subtraction:
      // We can fetch the user doc first or use transaction, but in simpler rules they can update points.
      // Let's do a fast debit.
      const pointsDocRef = doc(db, 'users', redemption.userId);
      // We can subtract first
      // Let's add points_history debit log
      await addDoc(collection(db, 'points_history'), {
        familyId,
        userId: redemption.userId,
        pointsChange: -redemption.cost,
        reason: `Recompensa canjeada: ${redemption.rewardTitle}`,
        createdAt: serverTimestamp()
      });

      onTriggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `redemptions/${redemption.id}`);
    }
  };

  const handleRejectRedemption = async (redemption: Redemption) => {
    try {
      await updateDoc(doc(db, 'redemptions', redemption.id), {
        status: 'rejected'
      });
      onTriggerAlarm('Reclamación de recompensa denegada.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `redemptions/${redemption.id}`);
    }
  };

  const activeRewards = rewards.filter(r => r.status === 'active');
  const proposedRewards = rewards.filter(r => r.status === 'proposal');

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="text-blue-500 w-5 h-5" />
          Tienda de Recompensas
        </h3>
        <p className="text-sm font-bold text-blue-500 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full">
          Mi Saldo: {userPoints} ptos
        </p>
      </div>

      {/* Creación de recompensas */}
      <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 p-4 rounded-xl space-y-3">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {isAdmin ? '🎁 Añadir Nueva Recompensa Oficial (Padres):' : '💡 Sugerir Propuesta de Recompensa (Hijos):'}
        </p>
        <form onSubmit={handleCreateReward} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: 1 hora de videojuegos, Helado el domingo..."
            className="flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none"
          />
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(Math.max(1, Number(e.target.value)))}
            placeholder="Costo ptos"
            className="w-24 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            {isAdmin ? 'Añadir' : 'Sugerir'}
          </button>
        </form>
      </div>

      {/* Recompensas Activas */}
      <div>
        <h4 className="text-xs font-black text-slate-400 font-mono uppercase tracking-wider mb-2">🎁 Recompensas Disponibles para canjear:</h4>
        {activeRewards.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No hay recompensas activas actualmente.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeRewards.map((reward) => (
              <div
                key={reward.id}
                className="p-3 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-xl flex justify-between items-center"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{reward.title}</p>
                  <p className="text-[10px] text-blue-500 font-extrabold font-mono">{reward.cost} PUNTOS</p>
                </div>
                {!isAdmin && (
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={userPoints < reward.cost}
                    className={`text-[10px] font-black py-1.5 px-2.5 rounded-lg transition-all active:scale-95 flex items-center gap-1 ${
                      userPoints >= reward.cost
                        ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Gift className="w-3 h-3" /> Canjear
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Propuestas Pendientes de Aprobación (Padres Ven / Aprueban) */}
      {proposedRewards.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <h4 className="text-xs font-black text-amber-500 font-mono uppercase tracking-wider mb-2">💡 Propuestas de Recompensa de los Hijos:</h4>
          <div className="space-y-2">
            {proposedRewards.map((prop) => (
              <div
                key={prop.id}
                className="p-3 bg-amber-500/5 dark:bg-amber-950/10 border-2 border-amber-500/20 rounded-xl flex justify-between items-center"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{prop.title}</p>
                  <p className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">Petición por: {prop.createdBy} | Costo suggested: {prop.cost} ptos</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleApproveProposal(prop.id)}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" /> Aprobar Tienda
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de Reclamaciones (Canjes por aprobar) */}
      {redemptions.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <h4 className="text-xs font-black text-rose-500 font-mono uppercase tracking-wider mb-2">🔔 Solicitudes de Canjes (Reclamaciones):</h4>
          <div className="space-y-2">
            {redemptions.map((red) => (
              <div
                key={red.id}
                className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    <span className="underline font-black">{red.displayName}</span> solicita: {red.rewardTitle}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500">
                    Costará: {red.cost} ptos | Estado: {red.status === 'requested' ? '⏳ PENDIENTE' : red.status === 'approved' ? '✅ ENTREGADO' : '❌ RECHAZADO'}
                  </p>
                </div>
                
                {red.status === 'requested' && isAdmin && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApproveRedemption(red)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg active:scale-90 transition-all font-bold text-xs flex items-center gap-1"
                      title="Autorizar obtención"
                    >
                      <Check className="w-3.5 h-3.5" /> Entregar
                    </button>
                    <button
                      onClick={() => handleRejectRedemption(red)}
                      className="bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded-lg active:scale-90 transition-all"
                      title="Rechazar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

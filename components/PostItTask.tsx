'use client';
import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Check, X, ClipboardList, Clock, Star, BrainCircuit } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

interface PostItTaskProps {
  familyId: string;
  userId: string;
  displayName: string;
  userRole: string; // 'admin' | 'child'
  members: { uid: string; displayName: string }[];
  onTriggerAlarm: (msg: string) => void;
  onTriggerConfetti: () => void;
}

interface Task {
  id: string;
  title: string;
  desc: string;
  pointsValue: number;
  assignedTo: string;
  assignedName: string;
  status: 'pending' | 'completed_by_child' | 'approved' | 'rejected';
  timeLimit?: string;
  createdAt: any;
}

export default function PostItTask({ familyId, userId, displayName, userRole, members, onTriggerAlarm, onTriggerConfetti }: PostItTaskProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Create task input states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPoints, setTaskPoints] = useState(15);
  const [assigneeId, setAssigneeId] = useState('unassigned');
  const [deadline, setDeadline] = useState('Hoy antes de cenar');

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!familyId) return;

    // Listen to family chores
    const q = query(
      collection(db, 'tasks'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const arr: Task[] = [];
      snapshot.forEach((snap) => {
        const d = snap.data();
        const foundMemberName = members.find(m => m.uid === d.assignedTo)?.displayName || 'Sin asignar';
        arr.push({
          id: snap.id,
          title: d.title,
          desc: d.desc || '',
          pointsValue: d.pointsValue || 10,
          assignedTo: d.assignedTo || 'unassigned',
          assignedName: foundMemberName,
          status: d.status || 'pending',
          timeLimit: d.timeLimit || '',
          createdAt: d.createdAt
        });
      });
      setTasks(arr);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tasks');
    });

    return () => unsub();
  }, [familyId, members]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        familyId,
        title: taskTitle.trim(),
        desc: taskDesc.trim(),
        pointsValue: Number(taskPoints),
        assignedTo: assigneeId,
        status: 'pending',
        timeLimit: deadline,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Clean up fields
      setTaskTitle('');
      setTaskDesc('');
      setTaskPoints(15);
      setAssigneeId('unassigned');
      setDeadline('Hoy antes de cenar');
      onTriggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
    }
  };

  const handleFinishChoreByChild = async (taskId: string) => {
    // A child reports a chore as done, moving it to completed_by_child waiting for admin verify
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed_by_child',
        updatedAt: serverTimestamp()
      });
      onTriggerConfetti();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleResolveChoreByAdmin = async (task: Task, isApproved: boolean) => {
    try {
      // 1. Update Chore status
      await updateDoc(doc(db, 'tasks', task.id), {
        status: isApproved ? 'approved' : 'rejected',
        updatedAt: serverTimestamp()
      });

      if (isApproved && task.assignedTo !== 'unassigned') {
        // 2. Award Points to child in user model
        const userRef = doc(db, 'users', task.assignedTo);
        // Better: We will write points debit via transactional increment or manually create points_history log first
        // Let's create the history log so that the child can view points evolution
        await addDoc(collection(db, 'points_history'), {
          familyId,
          userId: task.assignedTo,
          pointsChange: task.pointsValue,
          reason: `Tarea completada y aprobada: ${task.title}`,
          createdAt: serverTimestamp()
        });

        onTriggerConfetti();
      } else if (!isApproved) {
        onTriggerAlarm(`Tarea rechazada por el administrador: "${task.title}". Tira de nuevo.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleDeleteChore = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  // Filter tasks based on assigned status and active user
  const myPendingTasks = tasks.filter(t => t.status === 'pending' && (t.assignedTo === userId || t.assignedTo === 'unassigned'));
  const allOtherTasks = tasks.filter(t => t.status !== 'approved'); // show active tasks that are not fully completed / approved yet

  return (
    <div className="space-y-6">
      
      {/* Task Creation module (Parent / Admin ONLY can create) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-blue-100 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-black text-slate-800 dark:text-white mb-3 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="text-blue-500 w-4 h-4 animate-bounce" />
            Asignar Nuevo Deber del Hogar (Padres)
          </h3>
          <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Ej: Fregar los cacharros, Barrer salón..."
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none text-slate-800 dark:text-white"
            />
            
            <input
              type="text"
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="Explicación o indicaciones (Opcional)..."
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none text-slate-800 dark:text-white"
            />

            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min="1"
                required
                value={taskPoints}
                onChange={(e) => setTaskPoints(Math.max(1, Number(e.target.value)))}
                placeholder="Valor (ptos)"
                className="col-span-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs outline-none font-bold text-center text-slate-800 dark:text-white"
              />
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="col-span-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs outline-none font-sans text-slate-700 dark:text-slate-300"
              >
                <option value="unassigned">Libre para reclamar</option>
                {members.map((member) => (
                  <option key={member.uid} value={member.uid}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="Límite: Ej. Hoy antes de cenar"
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs outline-none text-slate-800 dark:text-white"
            />

            <button
              type="submit"
              className="md:col-span-2 w-full bg-blue-500 hover:bg-blue-600 font-extrabold text-xs transition-all text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-blue-500/10"
            >
              <Plus className="w-4 h-4" /> Registrar Tarea Doméstica
            </button>
          </form>
        </div>
      )}

      {/* Task List styled like yellow stickies / post-its */}
      <div>
        <h4 className="text-xs font-black text-slate-400 font-mono uppercase tracking-widest mb-4">🎯 Deberes del Hogar Pendientes:</h4>
        
        {tasks.filter(t => t.status !== 'approved').length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-sm font-bold text-slate-400 font-sans">🎉 ¡Todos los platos limpios y el hogar despejado!</p>
            <p className="text-xs text-slate-400 font-mono mt-1">Gran armonía en Pesadilla en Casa.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tasks
              .filter(t => t.status !== 'approved')
              .map((task) => {
                const isUnderAwaiting = task.status === 'completed_by_child';
                const isRejected = task.status === 'rejected';
                
                // Color coordinate based on state
                // yellow-tan card for standard pending, light-blue for waiting approval, rose for rejected correction
                let cardClass = "bg-amber-100 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 shadow-amber-200/40 text-amber-900 dark:text-amber-200";
                if (isUnderAwaiting) {
                  cardClass = "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 shadow-blue-200/40 text-blue-900 dark:text-blue-200 animate-pulse";
                } else if (isRejected) {
                  cardClass = "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 shadow-rose-200/40 text-rose-900 dark:text-rose-200 border-dashed border-2";
                }

                return (
                  <div
                    key={task.id}
                    className={`p-5 rounded-2xl border-t-8 shadow-md transform hover:-rotate-1 hover:scale-101 hover:shadow-lg transition-transform duration-200 ${cardClass}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-black uppercase font-mono bg-white/60 dark:bg-black/30 px-2 py-0.5 rounded-full">
                        {task.pointsValue} Puntos
                      </span>

                      {/* Parent can delete chore */}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteChore(task.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                          title="Echar a la papelera"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <h5 className="text-sm font-extrabold font-sans mt-3 tracking-tight underline select-none">{task.title}</h5>
                    <p className="text-xs font-medium font-sans mt-2 opacity-80 min-h-[32px]">{task.desc || 'Sin instrucciones adicionales.'}</p>

                    <div className="mt-4 border-t border-black/5 dark:border-white/5 pt-3 flex flex-col gap-1.5 text-[10px] font-mono">
                      <div className="flex justify-between items-center">
                        <span className="opacity-70">👤 Encargado:</span>
                        <span className="font-extrabold underline">{task.assignedName}</span>
                      </div>
                      
                      {task.timeLimit && (
                        <div className="flex justify-between items-center">
                          <span className="opacity-70 flex items-center gap-1"><Clock className="w-3 h-3" /> Límite:</span>
                          <span className="font-bold">{task.timeLimit}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-1">
                        <span className="opacity-70">⏳ Estado:</span>
                        <span className="font-black tracking-tight rounded px-1.5 py-0.5 bg-white/40 dark:bg-black/20">
                          {task.status === 'pending' ? '⏳ PENDIENTE' : task.status === 'completed_by_child' ? '🔍 POR VALIDAR' : '❌ CORREGIR'}
                        </span>
                      </div>
                    </div>

                    {/* Flow Action triggers */}
                    <div className="mt-4 flex justify-end gap-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                      
                      {/* For Children (or anyone assigned) to submit completed chore status */}
                      {task.status !== 'completed_by_child' && (!isAdmin || task.assignedTo === userId) && (
                        <button
                          onClick={() => handleFinishChoreByChild(task.id)}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] uppercase py-2 px-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> ¡Completar Tarea!
                        </button>
                      )}

                      {/* For Admin (Parents) to approve and reward points or reject */}
                      {isAdmin && (
                        <div className="w-full flex gap-1.5">
                          {task.status === 'completed_by_child' ? (
                            <>
                              <button
                                onClick={() => handleResolveChoreByAdmin(task, true)}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Aprobar
                              </button>
                              <button
                                onClick={() => handleResolveChoreByAdmin(task, false)}
                                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Rechazar
                              </button>
                            </>
                          ) : (
                            // Admin also can auto-complete uncompleted chores
                            <button
                              onClick={() => handleResolveChoreByAdmin(task, true)}
                              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[9px] uppercase py-1.5 px-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" /> Auto-Aprobar
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

    </div>
  );
}

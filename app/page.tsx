'use client';
import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

// Common subcomponents
import Confetti from '../components/Confetti';
import Alarm from '../components/Alarm';
import PostItTask from '../components/PostItTask';
import Games from '../components/Games';
import WalkieTalkie from '../components/WalkieTalkie';
import Wrapped from '../components/Wrapped';
import Shopping from '../components/Shopping';
import Chat from '../components/Chat';
import Rewards from '../components/Rewards';
import Stats from '../components/Stats';
import AdminControls from '../components/AdminControls';

import { 
  Menu, X, Sun, Moon, LogOut, User, Users, Shield, 
  Home, ClipboardList, ShoppingBag, MessageSquare, Award, Gamepad2, Radio, TrendingUp, Sparkles, Edit3
} from 'lucide-react';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'child';
  points: number;
  familyId: string;
  email: string;
}

interface FamilyDoc {
  name: string;
  code: string;
  admins: string[];
  walkieTalkieBlockedAll?: boolean;
  walkieTalkieBlockedUsers?: string[];
}

export default function Page() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Family information states
  const [family, setFamily] = useState<FamilyDoc | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [showFamilyCreateForm, setShowFamilyCreateForm] = useState(false);

  // App Theme & Navigation Setup
  const [darkTheme, setDarkTheme] = useState(false);
  const [activeMenuPage, setActiveMenuPage] = useState<'home' | 'tasks' | 'shopping' | 'chat' | 'rewards' | 'games' | 'walkie' | 'stats' | 'wrapped' | 'admin'>('home');
  const [hamburgerOpen, setHamburgerOpen] = useState(false);

  // FX System
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAlarm, setShowAlarm] = useState(false);
  const [alarmMsg, setAlarmMsg] = useState('');

  // Profile Editor Modal
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const predefinedAvatars = [
    'https://picsum.photos/seed/avatar1/150/150',
    'https://picsum.photos/seed/avatar2/150/150',
    'https://picsum.photos/seed/avatar3/150/150',
    'https://picsum.photos/seed/avatar4/150/150',
    'https://picsum.photos/seed/avatar5/150/150',
    'https://picsum.photos/seed/avatar6/150/150',
    'https://picsum.photos/seed/avatar7/150/150',
    'https://picsum.photos/seed/avatar8/150/150'
  ];

  // System FX triggers
  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  };

  const triggerAlarm = (msg: string) => {
    setAlarmMsg(msg);
    setShowAlarm(true);
  };

  // Google Login popup
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user has guest data stored locally to migrate
      const guestPoints = localStorage.getItem('guest_points');
      const guestFamilyId = localStorage.getItem('guest_familyId');
      const guestRole = localStorage.getItem('guest_role');

      // Fetch or create profile doc on Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      let finalProfile: UserProfile;

      if (userDoc.exists()) {
        const d = userDoc.data();
        finalProfile = {
          uid: user.uid,
          displayName: d.displayName || user.displayName || 'Miembro',
          photoURL: d.photoURL || user.photoURL || predefinedAvatars[0],
          role: d.role || 'child',
          points: d.points || 0,
          familyId: d.familyId || '',
          email: d.email || user.email || ''
        };
      } else {
        // Create brand new profile, migrating guest fields if found
        const pointsToSet = guestPoints ? Number(guestPoints) : 10; // start with 10 bonus points
        const familyIdToSet = guestFamilyId ? guestFamilyId : '';
        const roleToSet = guestRole === 'admin' ? 'admin' : 'child';
        
        finalProfile = {
          uid: user.uid,
          displayName: user.displayName || 'Miembro Familiar',
          photoURL: user.photoURL || predefinedAvatars[0],
          role: roleToSet,
          points: pointsToSet,
          familyId: familyIdToSet,
          email: user.email || '',
        };

        await setDoc(userDocRef, {
          ...finalProfile,
          createdAt: new Date().toISOString()
        });

        // Clean guest caches info
        localStorage.removeItem('guest_points');
        localStorage.removeItem('guest_familyId');
        localStorage.removeItem('guest_role');
        triggerConfetti();
      }

      setCurrentUser(finalProfile);
    } catch (err) {
      console.error("Login failed:", err);
      triggerAlarm("Error de autenticación Google. Comprueba tu conexión.");
    }
  };

  // Guest Instant Access Simulator
  const handleGuestLogin = async () => {
    // Generates virtual localStorage guest session to comply with: "Los datos del usuario invitado se migran al hacer login"
    const guestUid = `guest_${Math.random().toString(36).substr(2, 9)}`;
    const guestProfile: UserProfile = {
      uid: guestUid,
      displayName: 'Invitado Especial',
      photoURL: predefinedAvatars[Math.floor(Math.random() * predefinedAvatars.length)],
      role: 'child',
      points: 25,
      familyId: '',
      email: 'invitado@pesadillaencasa.com'
    };

    // Save locally
    localStorage.setItem('guest_uid', guestUid);
    localStorage.setItem('guest_points', '25');
    localStorage.setItem('guest_role', 'child');
    setCurrentUser(guestProfile);
    triggerConfetti();
  };

  // Handle Logout
  const handleLogout = async () => {
    localStorage.removeItem('guest_uid');
    await signOut(auth);
    setCurrentUser(null);
    setFamily(null);
    setMembers([]);
    setActiveMenuPage('home');
  };

  // Profile avatar modifier
  const handleAvatarSelect = async (avatarUrl: string) => {
    if (!currentUser) return;

    try {
      if (!currentUser.uid.startsWith('guest_')) {
        await setDoc(doc(db, 'users', currentUser.uid), {
          photoURL: avatarUrl
        }, { merge: true });
      }
      setCurrentUser(prev => prev ? { ...prev, photoURL: avatarUrl } : null);
      setShowAvatarModal(false);
      triggerConfetti();
    } catch (err) {
      console.error("Change avatar failed:", err);
    }
  };

  // Core setup: Listen to auth transformations
  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (srvUser) => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      setAuthLoading(true);

      if (srvUser) {
        // Logged in with Google
        const userDocRef = doc(db, 'users', srvUser.uid);
        unsubUser = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setCurrentUser({
              uid: srvUser.uid,
              displayName: d.displayName || srvUser.displayName || 'Miembro',
              photoURL: d.photoURL || srvUser.photoURL || predefinedAvatars[0],
              role: d.role || 'child',
              points: d.points || 0,
              familyId: d.familyId || '',
              email: d.email || srvUser.email || ''
            });
          } else {
            setCurrentUser({
              uid: srvUser.uid,
              displayName: srvUser.displayName || 'Miembro',
              photoURL: srvUser.photoURL || predefinedAvatars[0],
              role: 'child',
              points: 0,
              familyId: '',
              email: srvUser.email || ''
            });
          }
          setAuthLoading(false);
        }, (err) => {
          console.error("User doc sync error:", err);
          setAuthLoading(false);
        });
      } else {
        // No Google session. Let's see if guest_uid is in localStorage
        const cachedUid = localStorage.getItem('guest_uid');
        if (cachedUid) {
          setCurrentUser({
            uid: cachedUid,
            displayName: 'Invitado Especial',
            photoURL: predefinedAvatars[0],
            role: (localStorage.getItem('guest_role') as 'admin' | 'child') || 'child',
            points: Number(localStorage.getItem('guest_points') || '25'),
            familyId: localStorage.getItem('guest_familyId') || '',
            email: 'invitado@pesadillaencasa.com'
          });
        } else {
          setCurrentUser(null);
        }
        setAuthLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUser) {
        unsubUser();
      }
    };
  }, []);

  // Family dynamic sync (when familyId changes)
  useEffect(() => {
    if (!currentUser || !currentUser.familyId) {
      const resetTimer = setTimeout(() => {
        setFamily(null);
        setMembers([]);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const familyRef = doc(db, 'families', currentUser.familyId);
    const unsubFamily = onSnapshot(familyRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setFamily({
          name: d.name,
          code: d.code,
          admins: d.admins || [],
          walkieTalkieBlockedAll: d.walkieTalkieBlockedAll || false,
          walkieTalkieBlockedUsers: d.walkieTalkieBlockedUsers || []
        });
      }
    });

    // Listen to all members of this family to display stats and rankings
    const membersQuery = query(
      collection(db, 'users'),
      where('familyId', '==', currentUser.familyId)
    );
    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      const arr: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        arr.push({
          uid: docSnap.id,
          displayName: d.displayName || 'Miembro',
          photoURL: d.photoURL || predefinedAvatars[0],
          role: d.role || 'child',
          points: d.points || 0,
          familyId: d.familyId || '',
          email: d.email || ''
        });
      });
      
      // Calculate guest matching within the array or fallback
      if (currentUser.uid.startsWith('guest_')) {
        const index = arr.findIndex(m => m.uid === currentUser.uid);
        if (index === -1) {
          arr.push(currentUser);
        } else {
          arr[index] = currentUser;
        }
      }

      setMembers(arr);
    });

    return () => {
      unsubFamily();
      unsubMembers();
    };
  }, [currentUser?.familyId]);

  // Create standard family group (creator becomes admin)
  const createFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim() || !currentUser) return;

    // Generate unique 6-character random alphanumeric passcode
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    const familyDocId = `fam_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const familyPayload = {
        name: newFamilyName.trim(),
        code,
        admins: [currentUser.uid],
        walkieTalkieBlockedAll: false,
        walkieTalkieBlockedUsers: [],
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'families', familyDocId), familyPayload);

      // Upgrade creator user to 'admin' role and assign familyId
      if (currentUser.uid.startsWith('guest_')) {
        localStorage.setItem('guest_familyId', familyDocId);
        localStorage.setItem('guest_role', 'admin');
        setCurrentUser(prev => prev ? { ...prev, familyId: familyDocId, role: 'admin' } : null);
      } else {
        await setDoc(doc(db, 'users', currentUser.uid), {
          familyId: familyDocId,
          role: 'admin'
        }, { merge: true });
      }

      triggerConfetti();
    } catch (err) {
      console.error(err);
      triggerAlarm("Error de creación de base de datos.");
    }
  };

  // Join existing family group via invite code
  const joinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inviteCodeInput.trim().toUpperCase();
    if (!cleanCode || !currentUser) return;

    try {
      const q = query(collection(db, 'families'), where('code', '==', cleanCode));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        triggerAlarm("Código familiar no encontrado. Inténtalo de nuevo.");
        return;
      }

      const familyDocSnap = querySnap.docs[0];
      const familyIdToJoin = familyDocSnap.id;

      // Update user document assigning family membership
      if (currentUser.uid.startsWith('guest_')) {
        localStorage.setItem('guest_familyId', familyIdToJoin);
        localStorage.setItem('guest_role', 'child');
        setCurrentUser(prev => prev ? { ...prev, familyId: familyIdToJoin, role: 'child' } : null);
      } else {
        await setDoc(doc(db, 'users', currentUser.uid), {
          familyId: familyIdToJoin,
          role: 'child' // child by default on joining standard parents code
        }, { merge: true });
      }

      setInviteCodeInput('');
      triggerConfetti();
    } catch (err) {
      console.error(err);
      triggerAlarm("Error al unirse al grupo familiar.");
    }
  };

  // Sort and identify the leadership score
  const sortedRanking = [...members].sort((a, b) => b.points - a.points);

  // Validate if Walkie talkie access of the user is restricted by parents
  const isWalkieTalkieMuted = family?.walkieTalkieBlockedAll || family?.walkieTalkieBlockedUsers?.includes(currentUser?.uid || '');

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${darkTheme ? 'bg-slate-950 text-slate-100 dark' : 'bg-blue-50/30 text-slate-800'}`}>
      
      {/* Dynamic FX cascades */}
      {showConfetti && <Confetti />}
      {showAlarm && <Alarm onClose={() => setShowAlarm(false)} message={alarmMsg} />}

      {/* HEADER BAR */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-blue-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          {currentUser && family && (
            <button
              onClick={() => setHamburgerOpen(!hamburgerOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-90 transition-all focus:outline-none"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-sky-400 bg-clip-text text-transparent flex items-center gap-1.5 select-none">
            📋 Pesadilla en Casa
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Switcher Button */}
          <button
            onClick={() => setDarkTheme(!darkTheme)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all active:scale-90"
            title="Cambiar diseño visual"
          >
            {darkTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {currentUser && (
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
              {/* User photo edit trigger */}
              <button
                onClick={() => setShowAvatarModal(true)}
                className="w-8 h-8 rounded-full bg-blue-100 overflow-hidden relative cursor-pointer border border-blue-200 outline-none hover:scale-105 active:scale-95 transition-all"
                title="Editar avatar de perfil"
              >
                <img src={currentUser.photoURL} alt="User profile" className="w-8 h-8 object-cover" />
                <span className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                  <Edit3 className="w-3.5 h-3.5 text-white" />
                </span>
              </button>

              <div className="hidden sm:block text-left text-xs">
                <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">{currentUser.displayName}</p>
                <span className="text-[10px] font-mono font-bold text-blue-500 uppercase">
                  {currentUser.role === 'admin' ? '👑 Padres (Admin)' : '👶 Miembro (Hijo)'}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 active:scale-90 transition-all font-bold text-xs"
                title="Cerrar sesion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* HAMBURGER SIDE BAR DRAWER */}
      {hamburgerOpen && currentUser && family && (
        <div className="fixed inset-0 z-40 flex">
          {/* Overlay mask */}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => setHamburgerOpen(false)}></div>
          
          <div className="relative w-72 max-w-xs bg-white dark:bg-slate-900 h-full p-5 flex flex-col justify-between border-r border-blue-50 dark:border-slate-800 transition-transform animate-slide-in">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-500 font-mono tracking-wider">Hogar familiar:</span>
                  <p className="font-black text-slate-900 dark:text-white truncate max-w-[180px]">{family.name}</p>
                </div>
                <button onClick={() => setHamburgerOpen(false)} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1.5">
                <button
                  onClick={() => { setActiveMenuPage('home'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'home' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <Home className="w-4 h-4" /> Panel de Control
                </button>

                <button
                  onClick={() => { setActiveMenuPage('tasks'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'tasks' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <ClipboardList className="w-4 h-4" /> Deberes y Tareas
                </button>

                <button
                  onClick={() => { setActiveMenuPage('shopping'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'shopping' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <ShoppingBag className="w-4 h-4" /> Lista de la Compra
                </button>

                <button
                  onClick={() => { setActiveMenuPage('chat'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'chat' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <MessageSquare className="w-4 h-4" /> Chat Familiar
                </button>

                <button
                  onClick={() => { setActiveMenuPage('rewards'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'rewards' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <Award className="w-4 h-4" /> Recompensas y Canjes
                </button>

                <button
                  onClick={() => { setActiveMenuPage('games'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'games' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <Gamepad2 className="w-4 h-4" /> Mini-Juegos Pesadilla
                </button>

                <button
                  onClick={() => { setActiveMenuPage('walkie'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'walkie' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <Radio className="w-4 h-4" /> Walkie-Talkie
                </button>

                <button
                  onClick={() => { setActiveMenuPage('stats'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'stats' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <TrendingUp className="w-4 h-4" /> Gráficas de Evolución
                </button>

                <button
                  onClick={() => { setActiveMenuPage('wrapped'); setHamburgerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${activeMenuPage === 'wrapped' ? 'bg-blue-500 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <Sparkles className="w-4 h-4" /> Spotify Wrapped Anual
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => { setActiveMenuPage('admin'); setHamburgerOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left border border-rose-200/50 dark:border-rose-950/40 text-rose-500 ${activeMenuPage === 'admin' ? 'bg-rose-500 text-white border-rose-500' : 'hover:bg-rose-50/50 dark:hover:bg-rose-950/20'}`}
                  >
                    <Shield className="w-4 h-4" /> Control Familiar (Admin)
                  </button>
                )}
              </nav>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
              <span className="text-[10px] font-mono text-slate-400">Código de Casa:</span>
              <p className="text-sm font-black font-mono tracking-widest text-slate-800 dark:text-slate-100">{family.code}</p>
            </div>
          </div>
        </div>
      )}

      {/* CORE FRAME CONTAINER */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:py-6 space-y-6">
        
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 font-mono">Abriendo agenda de Pesadilla en Casa...</p>
          </div>
        ) : !currentUser ? (
          /* LOGIN VIEW */
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 text-center shadow-xl shadow-blue-500/5 my-12">
            <div className="space-y-2">
              <div className="text-4xl">📋</div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Pesadilla en Casa</h1>
              <p className="text-xs text-slate-500 font-sans max-w-xs mx-auto">
                Organiza las tareas del hogar, haz retos simpáticos con ranking de puntos, conversa en el chat y canjea recompensas familiares.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-slate-900 hover:bg-black text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-97 flex items-center justify-center gap-2 cursor-pointer"
              >
                <img src="https://picsum.photos/seed/google/40/40" alt="google" className="w-4 h-4 rounded-full" />
                Iniciar sesión con Google (Popup)
              </button>

              <button
                onClick={handleGuestLogin}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold py-3 px-4 rounded-xl transition-all active:scale-97 border border-blue-200/50"
              >
                Entrar como Invitado (Rápido)
              </button>
            </div>

            <div className="text-[10px] text-slate-400 font-mono mt-4 italic">
              * El modo Invitado guarda tus puntos locales y los migra a tu cuenta Google automáticamente al registrarte.
            </div>
          </div>
        ) : !currentUser.familyId ? (
          /* NO FAMILY SCREEN - CHOOSE JOIN OR CREATE */
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-8 shadow-xl">
            <div className="text-center space-y-2">
              <div className="inline-block p-3 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-500">
                <Users className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">¡Hola, {currentUser.displayName}!</h2>
              <p className="text-xs text-slate-500">Para comenzar, une tu perfil a un grupo familiar o crea uno exclusivo para tu casa.</p>
            </div>

            <div className="space-y-6">
              {/* Unirse a Familia */}
              <form onSubmit={joinFamily} className="space-y-2.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">👥 Unirse a una Familia mediante código:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value)}
                    placeholder="Código de 6 caracteres (Ej: XYZ880)"
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white placeholder-slate-400 font-mono font-bold text-center tracking-widest uppercase rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-xs px-5 rounded-xl active:scale-95 transition-all"
                  >
                    Unirse
                  </button>
                </div>
              </form>

              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6">
                {!showFamilyCreateForm ? (
                  <button
                    onClick={() => setShowFamilyCreateForm(true)}
                    className="w-full py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl transition-all"
                  >
                    👑 Crear un nuevo grupo de Familia (Serás Administrador)
                  </button>
                ) : (
                  <form onSubmit={createFamily} className="space-y-3 animate-fade-in">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block">👑 Nombre de tu grupo Familiar:</label>
                    <input
                      type="text"
                      required
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      placeholder="Ej: Familia López Pérez"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl px-4 py-2.5 text-xs outline-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowFamilyCreateForm(false)}
                        className="text-xs font-bold text-slate-400 px-4 py-2 hover:underline"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="bg-slate-900 hover:bg-black text-white text-xs font-bold py-2 px-5 rounded-xl transition-all active:scale-95"
                      >
                        Crear Familia
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE DASHBOARD */
          <div className="space-y-6">
            
            {/* Quick stats on topmost layout */}
            <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4 shadow-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-500 font-mono tracking-widest block font-sans">Nuestra Cabaña:</span>
                <p className="text-md font-extrabold text-slate-800 dark:text-white">{family?.name}</p>
              </div>

              <div className="flex gap-3">
                <div className="bg-slate-50 dark:bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">Mi Saldo</span>
                  <strong className="text-xs text-blue-600 dark:text-sky-400 font-black font-mono">{currentUser.points} PUNTOS</strong>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">Código invitación</span>
                  <strong className="text-xs text-slate-700 dark:text-slate-300 font-black font-mono tracking-widest">{family?.code}</strong>
                </div>
              </div>
            </div>

            {/* MAIN ROUTER SHELL */}
            {activeMenuPage === 'home' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* COLUMN 1 & 2: TASKS & ACTION CORES */}
                <div className="md:col-span-2 space-y-6">
                  <PostItTask
                    familyId={currentUser.familyId}
                    userId={currentUser.uid}
                    displayName={currentUser.displayName}
                    userRole={currentUser.role}
                    members={members}
                    onTriggerAlarm={triggerAlarm}
                    onTriggerConfetti={triggerConfetti}
                  />
                </div>

                {/* COLUMN 3: POINTS RANKINGS & STATS */}
                <div className="space-y-6">
                  {/* Leaderboard Post-it card style */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 border-blue-105 dark:border-slate-800 shadow-md relative transform rotate-1">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-yellow-400/35 border-b border-yellow-250 select-none pointer-events-none"></div>
                    <div className="mt-3 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                        <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono uppercase tracking-widest">🏆 Tabla del Poder Familiar (Ranking)</h4>
                      </div>

                      <div className="space-y-2">
                        {sortedRanking.map((member, index) => (
                          <div
                            key={member.uid}
                            className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${member.uid === currentUser.uid ? 'bg-amber-100/50 dark:bg-amber-950/40 border border-amber-300' : 'bg-slate-50/40'}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold w-4 font-mono text-slate-400">
                                {index === 0 ? '👑' : `#${index + 1}`}
                              </span>
                              <div className="w-6 h-6 rounded-full overflow-hidden border">
                                <img src={member.photoURL} alt="p" className="w-6 h-6 object-cover" />
                              </div>
                              <span className={`font-bold ${member.uid === currentUser.uid ? 'underline text-slate-900 dark:text-white font-extrabold' : ''}`}>
                                {member.displayName}
                              </span>
                            </div>
                            <span className="font-sans font-black text-amber-600 dark:text-amber-400 font-mono">
                              {member.points} ptos
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-500 text-white rounded-2xl p-5 shadow-lg border-b-4 border-blue-700">
                    <h4 className="text-xs font-black font-sans tracking-wide uppercase">💡 Tip de Convivencia Familiar:</h4>
                    <p className="text-xs font-medium mt-1 leading-relaxed opacity-90 font-sans">
                      {"\"Para que en Pesadilla en Casa no haya conflicto, asigna los puntos de forma proporcional a la pereza de la tarea: fregar cristales o limpiar campana merece más bono.\""}
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* ROUTED SUB-PAGES */}
            {activeMenuPage === 'tasks' && (
              <PostItTask
                familyId={currentUser.familyId}
                userId={currentUser.uid}
                displayName={currentUser.displayName}
                userRole={currentUser.role}
                members={members}
                onTriggerAlarm={triggerAlarm}
                onTriggerConfetti={triggerConfetti}
              />
            )}

            {activeMenuPage === 'shopping' && (
              <Shopping
                familyId={currentUser.familyId}
                userId={currentUser.uid}
                displayName={currentUser.displayName}
              />
            )}

            {activeMenuPage === 'chat' && (
              <Chat
                familyId={currentUser.familyId}
                userId={currentUser.uid}
                displayName={currentUser.displayName}
                photoURL={currentUser.photoURL}
              />
            )}

            {activeMenuPage === 'rewards' && (
              <Rewards
                familyId={currentUser.familyId}
                userId={currentUser.uid}
                displayName={currentUser.displayName}
                userRole={currentUser.role}
                userPoints={currentUser.points}
                onTriggerAlarm={triggerAlarm}
                onTriggerConfetti={triggerConfetti}
              />
            )}

            {activeMenuPage === 'games' && (
              <Games
                members={members}
                onTriggerAlarm={triggerAlarm}
                onTriggerConfetti={triggerConfetti}
              />
            )}

            {activeMenuPage === 'walkie' && (
              <WalkieTalkie
                familyId={currentUser.familyId}
                userId={currentUser.uid}
                displayName={currentUser.displayName}
                isBlockedByAdmin={!!isWalkieTalkieMuted}
              />
            )}

            {activeMenuPage === 'stats' && (
              <Stats
                familyId={currentUser.familyId}
                userId={currentUser.uid}
                displayName={currentUser.displayName}
                userRole={currentUser.role}
                members={members}
              />
            )}

            {activeMenuPage === 'wrapped' && (
              <Wrapped
                members={members}
                currentUserPoints={currentUser.points}
                displayName={currentUser.displayName}
              />
            )}

            {activeMenuPage === 'admin' && currentUser.role === 'admin' && (
              <AdminControls
                familyId={currentUser.familyId}
                userId={currentUser.uid}
                members={members}
                onTriggerAlarm={triggerAlarm}
                onTriggerConfetti={triggerConfetti}
              />
            )}

          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center py-4 mt-12">
        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
          © {new Date().getFullYear()} Pesadilla en Casa • Control de Convivencia Familiar en Castellano
        </p>
      </footer>

      {/* AVATAR EDITOR MODAL */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => setShowAvatarModal(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 animate-scale-up text-center">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">🎭 Selecciona un Avatar Familiar</h3>
            <p className="text-xs text-slate-400 font-sans pb-2">Destaca tu usuario con los divertidos avatares preestablecidos.</p>
            
            <div className="grid grid-cols-4 gap-2.5">
              {predefinedAvatars.map((url, i) => (
                <button
                  key={i}
                  onClick={() => handleAvatarSelect(url)}
                  className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-200 hover:border-blue-500 hover:scale-105 active:scale-90 transition-all outline-none"
                >
                  <img src={url} alt={`avatar-${i}`} className="w-14 h-14 object-cover" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAvatarModal(false)}
              className="mt-4 w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2.5 px-4 rounded-xl font-bold text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

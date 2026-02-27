import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where,
  serverTimestamp,
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { 
  Clock, 
  Calendar, 
  FileText, 
  Repeat, 
  Users, 
  Settings, 
  LogOut, 
  Bell, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  BarChart3,
  Moon,
  Sun,
  Menu,
  X,
  Plus,
  ArrowRightLeft,
  FileUp,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'konecta-wfm-v1';

// --- CONSTANTS ---
const ROLES = {
  AGENT: 'agent',
  MANAGER: 'manager',
  ADMIN: 'admin'
};

const AUX_TYPES = [
  { id: 'break', label: 'Break', color: 'bg-blue-500', limit: 30 },
  { id: 'lunch', label: 'Lunch', color: 'bg-green-500', limit: 60 },
  { id: 'last_break', label: 'Last Break', color: 'bg-blue-400', limit: 15 },
  { id: 'meeting', label: 'Meeting', color: 'bg-purple-500' },
  { id: 'coaching', label: 'Coaching', color: 'bg-orange-500' },
  { id: 'training', label: 'Training', color: 'bg-yellow-500' },
  { id: 'tech', label: 'Tech Issue', color: 'bg-red-500' },
  { id: 'support', label: 'Floor Support', color: 'bg-indigo-500' }
];

// --- UTILS ---
const formatDuration = (seconds) => {
  if (!seconds) return "00:00:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- COMPONENTS ---

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (currUser) {
        const userRef = doc(db, 'artifacts', appId, 'users', currUser.uid, 'profile', 'data');
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          const defaultData = {
            uid: currUser.uid,
            firstName: "New",
            lastName: "Agent",
            email: currUser.email || `user_${currUser.uid.slice(0,5)}@konecta.com`,
            role: ROLES.AGENT,
            status: 'active',
            joinedAt: new Date().toISOString()
          };
          await setDoc(userRef, defaultData);
          setUserData(defaultData);
        }
        setUser(currUser);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Notification listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'notifications'));
    return onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!user) return <LoginScreen />;

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: BarChart3, roles: [ROLES.AGENT, ROLES.MANAGER, ROLES.ADMIN] },
    { name: 'Schedule', id: 'schedule', icon: Calendar, roles: [ROLES.AGENT, ROLES.MANAGER, ROLES.ADMIN] },
    { name: 'My Requests', id: 'requests', icon: FileText, roles: [ROLES.AGENT] },
    { name: 'Shift Swap', id: 'swap', icon: Repeat, roles: [ROLES.AGENT] },
    { name: 'Approvals', id: 'approvals', icon: CheckCircle, roles: [ROLES.MANAGER, ROLES.ADMIN] },
    { name: 'Team Management', id: 'team', icon: Users, roles: [ROLES.MANAGER, ROLES.ADMIN] },
    { name: 'System Admin', id: 'admin', icon: ShieldCheck, roles: [ROLES.ADMIN] },
  ];

  const filteredNav = navigation.filter(n => n.roles.includes(userData?.role));

  return (
    <div className={`${darkMode ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-900 flex text-slate-900 dark:text-slate-100`}>
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 overflow-hidden">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Clock size={24} />
          </div>
          {isSidebarOpen && <span className="font-bold text-lg text-indigo-900 dark:text-indigo-100 truncate">KONECTA WFM</span>}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                view === item.id 
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' 
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span className="font-medium">{item.name}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            {isSidebarOpen && <span>{darkMode ? 'Light' : 'Dark'} Mode</span>}
          </button>
          <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 p-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto h-screen relative">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-semibold capitalize">{view.replace('-', ' ')}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer">
              <Bell size={20} className="text-slate-500" />
              {notifications.some(n => !n.read) && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
              )}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold">{userData?.firstName} {userData?.lastName}</p>
              <p className="text-xs text-slate-500 uppercase">{userData?.role}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
              {userData?.firstName[0]}{userData?.lastName[0]}
            </div>
          </div>
        </header>

        <div className="p-6">
          {view === 'dashboard' && <Dashboard user={userData} />}
          {view === 'schedule' && <ScheduleView user={userData} />}
          {view === 'requests' && <LeaveRequests user={userData} />}
          {view === 'swap' && <ShiftSwap user={userData} />}
          {view === 'approvals' && <ManagerApprovals user={userData} />}
          {view === 'team' && <TeamManagement user={userData} />}
          {view === 'admin' && <AdminPanel user={userData} />}
        </div>
      </main>
    </div>
  );
}

// 2. Dashboard Component (Functional)
function Dashboard({ user }) {
  const [session, setSession] = useState(null);
  const [activeAux, setActiveAux] = useState(null);
  const [timer, setTimer] = useState(0);
  const [auxTimer, setAuxTimer] = useState(0);
  const [stats, setStats] = useState({ shiftTotal: 0, auxTotal: 0, lateArrivals: 0 });
  
  const timerRef = useRef(null);
  const auxTimerRef = useRef(null);

  useEffect(() => {
    // Sync active shift
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'attendance'),
      where('status', '==', 'active'),
      limit(1)
    );
    
    const unsubShift = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setSession({ id: doc.id, ...doc.data() });
        const start = doc.data().startTime.toDate();
        setTimer(Math.floor((new Date() - start) / 1000));
        if (!timerRef.current) timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      } else {
        setSession(null);
        setTimer(0);
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });

    // Sync active aux
    const qAux = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'aux_logs'),
      where('status', '==', 'active'),
      limit(1)
    );

    const unsubAux = onSnapshot(qAux, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setActiveAux({ id: doc.id, ...doc.data() });
        const start = doc.data().startTime.toDate();
        setAuxTimer(Math.floor((new Date() - start) / 1000));
        if (!auxTimerRef.current) auxTimerRef.current = setInterval(() => setAuxTimer(t => t + 1), 1000);
      } else {
        setActiveAux(null);
        setAuxTimer(0);
        clearInterval(auxTimerRef.current);
        auxTimerRef.current = null;
      }
    });

    return () => {
      unsubShift();
      unsubAux();
      clearInterval(timerRef.current);
      clearInterval(auxTimerRef.current);
    };
  }, [user.uid]);

  const toggleClock = async () => {
    if (!session) {
      // Check for late arrival (Mock schedule lookup)
      const now = new Date();
      const isLate = now.getHours() > 9; // If after 9 AM, late

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'attendance'), {
        startTime: serverTimestamp(),
        status: 'active',
        type: 'shift',
        isLate
      });
    } else {
      // End session and any active aux
      if (activeAux) await endAux();
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'attendance', session.id), {
        endTime: serverTimestamp(),
        status: 'completed',
        duration: timer
      });
    }
  };

  const startAux = async (typeId) => {
    if (!session) return;
    if (activeAux) await endAux();
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'aux_logs'), {
      type: typeId,
      startTime: serverTimestamp(),
      status: 'active'
    });
  };

  const endAux = async () => {
    if (!activeAux) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'aux_logs', activeAux.id), {
      endTime: serverTimestamp(),
      status: 'completed',
      duration: auxTimer
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Clock className="text-indigo-600" /> Session Status
            </h2>
            <p className="text-sm text-slate-500">Live work session tracking</p>
          </div>
          
          <div className="text-center py-6">
            <div className={`text-5xl font-mono font-bold mb-2 transition-colors ${session ? 'text-slate-800 dark:text-white' : 'text-slate-300'}`}>
              {formatDuration(timer)}
            </div>
            <p className={`text-xs font-bold uppercase tracking-widest ${session ? 'text-green-500' : 'text-slate-400'}`}>
              {session ? 'ON SHIFT' : 'OFFLINE'}
            </p>
          </div>
          
          <button
            onClick={toggleClock}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
              session ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {session ? 'Clock Out' : 'Clock In'}
          </button>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="text-amber-500" /> AUX Control
              </h2>
              {activeAux && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-indigo-600 animate-pulse">ACTIVE: {activeAux.type.toUpperCase()}</span>
                  <span className="text-xs font-mono">({formatDuration(auxTimer)})</span>
                </div>
              )}
            </div>
            {activeAux && (
              <button onClick={endAux} className="px-4 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200">
                RETURN TO AVAILABLE
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {AUX_TYPES.map((aux) => (
              <button
                key={aux.id}
                disabled={!session}
                onClick={() => startAux(aux.id)}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  activeAux?.type === aux.id 
                    ? `${aux.color} text-white border-transparent ring-4 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-800` 
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                } ${!session ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className={`w-3 h-3 rounded-full ${activeAux?.type === aux.id ? 'bg-white' : aux.color}`}></div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{aux.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Work Hours', value: '07:45', icon: Clock, color: 'text-blue-600', trend: '+12%' },
          { label: 'AUX Usage', value: '01:12', icon: BarChart3, color: 'text-amber-600', trend: '-2%' },
          { label: 'Adherence', value: '98%', icon: ShieldCheck, color: 'text-green-600', trend: 'Stable' },
          { label: 'Late Logins', value: '1', icon: AlertCircle, color: 'text-red-600', trend: '+1' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2 rounded-lg ${kpi.color} bg-opacity-10`}><kpi.icon size={18} /></div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${kpi.trend.includes('-') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {kpi.trend}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-tighter">{kpi.label}</p>
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Shift Swap Component (Functional)
function ShiftSwap({ user }) {
  const [agents, setAgents] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ targetAgent: '', date: '', reason: '' });

  useEffect(() => {
    // Load other agents
    const loadAgents = async () => {
      const q = query(collection(db, 'artifacts', appId, 'users', 'all_users', 'data'), where('role', '==', ROLES.AGENT));
      const snap = await getDocs(q);
      setAgents(snap.docs.filter(d => d.id !== user.uid).map(d => ({ id: d.id, ...d.data() })));
    };
    loadAgents();

    // Listen for swaps involving user
    const qSwap = query(collection(db, 'artifacts', appId, 'public', 'data', 'shift_swaps'));
    return onSnapshot(qSwap, (snapshot) => {
      setSwaps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => s.fromId === user.uid || s.toId === user.uid));
    });
  }, [user.uid]);

  const handleRequest = async (e) => {
    e.preventDefault();
    const target = agents.find(a => a.id === formData.targetAgent);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'shift_swaps'), {
      fromId: user.uid,
      fromName: `${user.firstName} ${user.lastName}`,
      toId: formData.targetAgent,
      toName: `${target.firstName} ${target.lastName}`,
      date: formData.date,
      reason: formData.reason,
      status: 'pending_agent',
      createdAt: serverTimestamp()
    });
    setModalOpen(false);
  };

  const updateSwap = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'shift_swaps', id), { status });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Shift Exchange</h2>
        <button onClick={() => setModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all">
          <Repeat size={18} /> Request Swap
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {swaps.map(swap => (
          <div key={swap.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <p className="font-bold">{swap.fromId === user.uid ? `To: ${swap.toName}` : `From: ${swap.fromName}`}</p>
                  <p className="text-xs text-slate-500">{swap.date}</p>
                </div>
              </div>
              <StatusBadge status={swap.status} />
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg italic">
              "{swap.reason}"
            </p>

            {swap.status === 'pending_agent' && swap.toId === user.uid && (
              <div className="flex gap-2">
                <button onClick={() => updateSwap(swap.id, 'rejected')} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-red-50 hover:text-red-600">Decline</button>
                <button onClick={() => updateSwap(swap.id, 'pending_manager')} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Accept</button>
              </div>
            )}
            
            {swap.status === 'pending_manager' && (
              <p className="text-xs text-center font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 py-2 rounded-lg">Awaiting Manager Approval</p>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold">New Swap Request</h3>
              <button onClick={() => setModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Colleague</label>
                <select 
                  className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" 
                  value={formData.targetAgent}
                  onChange={e => setFormData({...formData, targetAgent: e.target.value})}
                  required
                >
                  <option value="">Choose an agent...</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shift Date</label>
                <input type="date" className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" onChange={e => setFormData({...formData, date: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea rows="3" className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" placeholder="Why do you need to swap?" onChange={e => setFormData({...formData, reason: e.target.value})} required></textarea>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all">Submit Request</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 4. Leave Requests Component (Functional)
function LeaveRequests({ user }) {
  const [requests, setRequests] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ type: 'annual', startDate: '', endDate: '', reason: '' });

  useEffect(() => {
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'leave_requests'), 
      where('userId', '==', user.uid),
      orderBy('requestedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.log("Leave Snap Error:", err));
  }, [user.uid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leave_requests'), {
      ...formData,
      userId: user.uid,
      userName: `${user.firstName} ${user.lastName}`,
      status: 'pending',
      requestedAt: serverTimestamp()
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Leave Management</h2>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700">
          <Plus size={18} /> New Request
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase text-slate-400">
                <th className="p-4">Type</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Status</th>
                <th className="p-4">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {requests.length === 0 ? (
                <tr><td colSpan="4" className="p-12 text-center text-slate-500 italic">No request history found.</td></tr>
              ) : requests.map(req => (
                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <td className="p-4 font-bold capitalize">{req.type.replace('_', ' ')}</td>
                  <td className="p-4">{req.startDate} {req.endDate ? `to ${req.endDate}` : ''}</td>
                  <td className="p-4"><StatusBadge status={req.status} /></td>
                  <td className="p-4 text-slate-400">
                    {req.requestedAt?.toDate()?.toLocaleDateString() || 'Pending...'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold">Request Absence</h3>
              <button onClick={() => setModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="overtime">Overtime</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3" onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                <input type="date" className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3" onChange={e => setFormData({...formData, endDate: e.target.value})} />
              </div>
              <textarea rows="3" className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3" placeholder="Additional details..." onChange={e => setFormData({...formData, reason: e.target.value})} required></textarea>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700">Submit Request</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 5. Shared UI Utilities
function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-700',
    pending_agent: 'bg-blue-100 text-blue-700',
    pending_manager: 'bg-purple-100 text-purple-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-slate-100 text-slate-700'
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status] || styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// 6. Manager Approvals
function ManagerApprovals({ user }) {
  const [requests, setRequests] = useState([]);
  const [swaps, setSwaps] = useState([]);

  useEffect(() => {
    const qReq = query(collection(db, 'artifacts', appId, 'public', 'data', 'leave_requests'), where('status', '==', 'pending'));
    const qSwap = query(collection(db, 'artifacts', appId, 'public', 'data', 'shift_swaps'), where('status', '==', 'pending_manager'));
    
    const unsubReq = onSnapshot(qReq, snap => setRequests(snap.docs.map(d => ({id: d.id, ...d.data(), cat: 'leave'}))));
    const unsubSwap = onSnapshot(qSwap, snap => setSwaps(snap.docs.map(d => ({id: d.id, ...d.data(), cat: 'swap'}))));
    
    return () => { unsubReq(); unsubSwap(); };
  }, []);

  const handleAction = async (id, cat, status) => {
    const coll = cat === 'leave' ? 'leave_requests' : 'shift_swaps';
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id), {
      status,
      processedBy: user.uid,
      processedAt: serverTimestamp()
    });
  };

  const allPending = [...requests, ...swaps];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-3">
        Action Center
        <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{allPending.length}</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allPending.map(item => (
          <div key={item.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-100 dark:shadow-none animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900 text-indigo-600 flex items-center justify-center font-bold">
                  {item.cat === 'leave' ? item.userName[0] : item.fromName[0]}
                </div>
                <div>
                  <p className="font-bold text-sm">{item.cat === 'leave' ? item.userName : `${item.fromName} → ${item.toName}`}</p>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase">{item.cat === 'leave' ? item.type : 'SHIFT SWAP'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl mb-6 text-sm">
              <p className="text-slate-400 text-xs mb-1">Duration/Date:</p>
              <p className="font-bold mb-2">{item.startDate || item.date} {item.endDate ? `to ${item.endDate}` : ''}</p>
              <p className="italic text-slate-500">"{item.reason}"</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleAction(item.id, item.cat, 'rejected')} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-red-50 hover:text-red-600 transition-colors">Reject</button>
              <button onClick={() => handleAction(item.id, item.cat, 'approved')} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-shadow shadow-md shadow-indigo-100 dark:shadow-none">Approve</button>
            </div>
          </div>
        ))}

        {allPending.length === 0 && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <CheckCircle size={64} className="mb-4 opacity-20" />
            <p className="text-xl font-bold">Inbox is empty!</p>
            <p>You've processed all pending team requests.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 7. Schedule View
function ScheduleView({ user }) {
  const [schedule, setSchedule] = useState([]);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Shift Schedule</h2>
        <div className="flex bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
          <button className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold">Week</button>
          <button className="px-4 py-1.5 text-slate-500 text-sm font-bold">Month</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {days.map((day, i) => (
          <div key={day} className="space-y-4">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</p>
              <p className="text-xl font-black text-slate-700 dark:text-slate-300">{24 + i}</p>
            </div>
            <div className={`p-4 rounded-2xl h-48 border flex flex-col items-center justify-center gap-2 ${i >= 5 ? 'bg-slate-100 dark:bg-slate-900/50 border-dashed border-slate-300' : 'bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-900/50 shadow-sm'}`}>
              {i < 5 ? (
                <>
                  <div className="bg-indigo-50 dark:bg-indigo-900/50 p-2 rounded-lg text-indigo-600">
                    <Clock size={16} />
                  </div>
                  <p className="text-xs font-black text-slate-800 dark:text-white">08:00 - 17:00</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Main Shift</p>
                </>
              ) : (
                <p className="text-[10px] font-black text-slate-400 uppercase rotate-45">Day Off</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 8. Team Management
function TeamManagement({ user }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Team Performance</h2>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700"><Plus size={16} /> Add Agent</button>
          <button className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl"><Filter size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: 'Alex Thompson', status: 'active', aux: 'lunch', performance: '98%' },
          { name: 'Sarah Miller', status: 'active', aux: 'coaching', performance: '102%' },
          { name: 'David Lee', status: 'idle', aux: 'none', performance: '85%' },
          { name: 'Emma Wilson', status: 'active', aux: 'none', performance: '94%' },
          { name: 'Michael Chen', status: 'idle', aux: 'none', performance: '91%' },
        ].map((member, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-400">
                  {member.name[0]}
                </div>
                <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-800 ${member.status === 'active' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{member.name}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black">{member.status === 'active' ? 'Currently Online' : 'Offline'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-indigo-600">{member.performance}</p>
                <p className="text-[10px] text-slate-400 uppercase">Score</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 pt-3 border-t border-slate-50 dark:border-slate-700">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                AUX: {member.aux.replace('none', 'Available')}
              </div>
              <button className="text-indigo-600 hover:underline">View History</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 9. Admin Panel
function AdminPanel({ user }) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-indigo-600 rounded-2xl text-white flex items-center justify-between shadow-xl shadow-indigo-100 dark:shadow-none overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">System Administration</h2>
          <p className="text-xs text-indigo-100 font-medium">Enterprise workforce controls and system monitoring</p>
        </div>
        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md relative z-10">
          <Settings size={24} />
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-4 hover:border-indigo-500 transition-all group">
          <div className="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users size={28} />
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-wider">User Directory</p>
            <p className="text-xs text-slate-400 mt-1">Manage 128 active accounts</p>
          </div>
        </button>
        <button className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-4 hover:border-indigo-500 transition-all group">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileUp size={28} />
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-wider">CSV Bulk Upload</p>
            <p className="text-xs text-slate-400 mt-1">Schedules & Payroll Data</p>
          </div>
        </button>
        <button className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-4 hover:border-indigo-500 transition-all group">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <BarChart3 size={28} />
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-wider">System Reports</p>
            <p className="text-xs text-slate-400 mt-1">Historical performance analysis</p>
          </div>
        </button>
        <button className="p-6 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-4 hover:border-indigo-500 transition-all group">
          <div className="h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-wider">Audit Logs</p>
            <p className="text-xs text-slate-400 mt-1">Track administrative actions</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// 10. Login & Registration
function LoginScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      if (!formData.email.endsWith('@konecta.com')) return setError('Use a @konecta.com email address.');
      if (formData.password.length < 8 || !/\d/.test(formData.password)) return setError('Password must be 8+ chars with a number.');
      if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.');
    }

    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
      
      if (isRegistering) {
        const user = auth.currentUser;
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
          uid: user.uid,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role: ROLES.AGENT,
          status: 'pending_approval',
          joinedAt: new Date().toISOString()
        });
        // Create global record for team view
        await setDoc(doc(db, 'artifacts', appId, 'users', 'all_users', 'data', user.uid), {
          uid: user.uid,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: ROLES.AGENT
        });
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
        <div className="p-8 md:p-12 w-full">
          <div className="mb-10 flex flex-col items-center">
            <div className="bg-indigo-600 w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-100 dark:shadow-none">
              <Clock size={32} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">KONECTA WFM</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Workforce Intelligence</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="First Name" 
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  required
                />
                <input 
                  placeholder="Last Name" 
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  required
                />
              </div>
            )}
            
            <div className="relative">
              <input 
                type="email" 
                placeholder="Konecta Email" 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                required
              />
              {!isRegistering && <span className="absolute right-5 top-4.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">Verified</span>}
            </div>
            
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              required
            />

            {isRegistering && (
              <input 
                type="password" 
                placeholder="Confirm Password" 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                value={formData.confirmPassword}
                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                required
              />
            )}
            
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-100 dark:shadow-none uppercase tracking-widest text-xs">
              {isRegistering ? 'Initialize Account' : 'Authenticate Access'}
            </button>
          </form>

          <div className="mt-8 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
            {isRegistering ? 'Portal established?' : "Unauthorized credentials?"}
            <button onClick={() => setIsRegistering(!isRegistering)} className="ml-2 text-indigo-600 hover:underline">
              {isRegistering ? 'Sign In' : 'Create Registry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
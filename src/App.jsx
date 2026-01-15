import { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc,
  updateDoc,
  limit,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut,
  signInWithPopup
} from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { getSeasonWeekends, getHolidays } from './utils/dateHelpers';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import AdminPanel from './components/AdminPanel';
import { ShieldAlert, Loader2, Lock } from 'lucide-react';

export default function App() {
  const today = new Date();
  const initialYear = today.getFullYear();
  const [year, setYear] = useState(initialYear);
  const [weekendDates, setWeekendDates] = useState([]);
  const [holidays, setHolidays] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const [availability, setAvailability] = useState({ in: [], out: [] });
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [access, setAccess] = useState('unknown'); // 'unknown' | 'approved' | 'pending' | 'suspended'
  const [showAdmin, setShowAdmin] = useState(false);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  // Auth Listener
  useEffect(() => {
    // Handle redirect result (if needed)
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect auth error:', error);
      setStatusMessage(error.message);
    });

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Check if user already exists
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          let userData = null;

          if (userSnap.exists()) {
             userData = userSnap.data();
             // Respect stored status, default to approved if missing (legacy support)
             setAccess(userData.status || 'approved');
          } else {
             // 2. New (or Deleted) User Check
             
             // ZOMBIE CHECK: If the Auth User was created more than 5 minutes ago
             // but has no profile, it means they were likely DELETED by an admin.
             // We should NOT auto-create a profile for them.
             const creationTime = new Date(user.metadata.creationTime).getTime();
             const now = Date.now();
             const isRecentAuth = (now - creationTime) < (5 * 60 * 1000); // 5 minutes

             // Special Check for First User (Bootstrap)
             const q = query(collection(db, 'users'), limit(1));
             const allSnap = await getDocs(q);
             const isFirstUserEver = allSnap.empty;

             if (isRecentAuth || isFirstUserEver) {
                 // Genuine New User - Create Profile
                 const initialStatus = isFirstUserEver ? 'approved' : 'pending';
                 const initialRole = isFirstUserEver ? 'admin' : 'user';

                 userData = {
                    uid: user.uid,
                    status: initialStatus,
                    role: initialRole,
                    name: user.displayName || user.email || 'Unknown player',
                    email: user.email || ''
                 };
                 
                 setAccess(initialStatus);
                 await ensureUserProfile(user, initialStatus, initialRole);
             } else {
                 // Zombie User Case
                 console.warn("Detected zombie user (old auth, missing profile). Treating as deleted.");
                 setAccess('deleted');
                 userData = { 
                     uid: user.uid, 
                     status: 'deleted',
                     name: user.displayName,
                     email: user.email
                 };
             }
          }
          
          setCurrentUser({
             uid: user.uid,
             name: userData.name || user.displayName || user.email,
             email: userData.email || user.email,
             role: userData.role || 'user',
             status: userData.status || 'pending'
          });

        } catch (e) {
          console.error("Auth Error:", e);
          setAccess('pending'); // Fail safe
        }
      } else {
        setCurrentUser(null);
        setAccess('unknown');
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Sync Users when authenticated
  useEffect(() => {
    if (currentUser && access === 'approved') {
      loadUsers();
    }
  }, [currentUser, access]);

  // Load Calendar Data
  useEffect(() => {
    loadCalendar(year);
  }, [year]);

  // Load Availability for selected date
  useEffect(() => {
    if (selectedDate) loadAvailability(selectedDate);
  }, [selectedDate, usersById]); // Re-run if users list updates to resolve names

  async function loadUsers() {
    try {
      const q = query(collection(db, 'users'), orderBy('name'));
      const snapshot = await getDocs(q);
      const userList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }

  async function loadCalendar(targetYear) {
    try {
      const weekendsRes = getSeasonWeekends(targetYear);
      const holidaysRes = getHolidays(targetYear);

      // Merge weekends and holidays
      const combinedDates = new Set(weekendsRes.dates || []);
      if (holidaysRes.holidays) {
        holidaysRes.holidays.forEach(h => combinedDates.add(h.date));
      }
      const sortedDates = Array.from(combinedDates).sort();

      setWeekendDates(sortedDates);
      const holidayMap = {};
      for (const h of holidaysRes.holidays || []) {
        holidayMap[h.date] = h.name;
      }
      setHolidays(holidayMap);
      
      // Auto-select first date if none selected or if switching years
      if ((!selectedDate || !selectedDate.startsWith(String(targetYear))) && sortedDates.length) {
        setSelectedDate(sortedDates[0]);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Error loading calendar data.');
    }
  }

  async function loadAvailability(dateStr) {
    try {
      const q = query(collection(db, 'availability'), where('date', '==', dateStr));
      const snapshot = await getDocs(q);
      const inList = [];
      const outList = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const userInfo = usersById[data.user_id] || { id: data.user_id, name: 'Unknown', email: '' }; // Fallback
        const entry = { ...userInfo, guests: data.guests || 0 };
        if (data.status === 'in') inList.push(entry);
        else outList.push(entry);
      }
      setAvailability({ in: inList, out: outList });
    } catch (err) {
      console.error(err);
      setAvailability({ in: [], out: [] });
    }
  }

  async function ensureUserProfile(user, status = 'pending', role = 'user') {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        name: user.displayName || user.email || 'Unknown player',
        email: user.email || '',
        role: role,
        status: status,
        created_at: serverTimestamp()
      });
      await loadUsers(); // Refresh list immediately
    }
  }

  async function handleSignIn() {
    setLoading(true);
    setStatusMessage('');
    try {
      // Use redirect for mobile friendliness, or popup based on preference
      // The original code used redirect then popup in different blocks. 
      // Popup provides immediate feedback in API, redirect breaks context.
      // I'll stick to popup for smoother SPA feel if possible, or redirect if popup fails.
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setStatusMessage('Sign in failed. using redirect...');
      signInWithRedirect(auth, googleProvider).catch(e => setStatusMessage(e.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setAccess('unknown');
    setAvailability({ in: [], out: [] });
  }

  async function setMyStatus(status, guests = 0) {
    if (!currentUser || !selectedDate) return;
    setLoading(true);
    setStatusMessage('');
    try {
      const q = query(
        collection(db, 'availability'),
        where('user_id', '==', currentUser.uid),
        where('date', '==', selectedDate),
        limit(1)
      );
      const existing = await getDocs(q);
      
      const data = {
        status,
        guests: status === 'in' ? guests : 0
      };

      if (!existing.empty) {
        // user could click actual button 'in' when already 'in', we just update it
        // Or toggle? Requirement says "I'm in" / "Can't make it" buttons.
        await updateDoc(existing.docs[0].ref, data);
      } else {
        await addDoc(collection(db, 'availability'), {
          user_id: currentUser.uid,
          date: selectedDate,
          ...data,
          created_at: Timestamp.now()
        });
      }
      await loadAvailability(selectedDate);
      // setStatusMessage(`Saved as ${status === 'in' ? 'IN' : 'OUT'}`);
      // Clear message after 3s
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Routing Logic
  if (!authReady) {
    // Show splash state (reuse AuthPage loading state)
    return <AuthPage loading={true} />; 
  }

  if (access === 'suspended' || access === 'deleted') {
    const isDeleted = access === 'deleted';
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{isDeleted ? 'Account Removed' : 'Account Suspended'}</h1>
        <p className="text-navy-100/50 mb-8 max-w-md">
          {isDeleted 
            ? "Your account has been removed by an administrator. To join again, you must sign out and sign in to create a new request." 
            : "Your account has been suspended by an administrator. Please contact specific club admins to resolve this issue."}
        </p>
        <button 
          onClick={handleSignOut}
          className="px-6 py-2 bg-navy-800 text-white rounded-lg hover:bg-navy-700 transition"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (access === 'pending') {
     return (
        <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6 text-center">
           <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6 border border-yellow-500/20 animate-pulse">
              <Lock className="w-10 h-10 text-cricket-gold" />
           </div>
           <h1 className="text-2xl font-bold text-white mb-2">Pending Approval</h1>
           <p className="text-navy-100/50 mb-8 max-w-md">Thanks for signing up! An administrator needs to approve your account before you can check in for practice.</p>
           <button 
              onClick={handleSignOut}
              className="px-6 py-2 bg-navy-800 text-white rounded-lg hover:bg-navy-700 transition"
           >
              Sign Out
           </button>
           <div className="mt-8 pt-8 border-t border-navy-800/50 w-full max-w-xs">
              <p className="text-xs text-navy-100/30">User ID: <span className="font-mono">{currentUser?.uid}</span></p>
           </div>
        </div>
     );
  }

  if (!currentUser) {
    return (
      <AuthPage 
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        loading={loading}
        statusMessage={statusMessage}
        user={currentUser}
        access={access}
      />
    );
  }

  return (
    <>
      <Dashboard 
        user={currentUser}
        users={users}
        year={year}
        setYear={setYear}
        weekendDates={weekendDates}
        holidays={holidays}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        availability={availability}
        onSetStatus={setMyStatus}
        onSignOut={handleSignOut}
        loading={loading}
        statusMessage={statusMessage}
        isAdmin={currentUser.role === 'admin'}
        onOpenAdmin={() => setShowAdmin(true)}
      />
      {showAdmin && (
         <AdminPanel 
           users={users} 
           onClose={() => setShowAdmin(false)} 
           onRefresh={loadUsers}
         />
      )}
    </>
  );
}

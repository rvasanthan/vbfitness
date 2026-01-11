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
  const [access, setAccess] = useState('unknown'); // 'unknown' | 'approved' | 'pending'

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
        // Check allowlist
        try {
          const email = (user.email || '').toLowerCase();
          // CLIENT-SIDE CHECK (Since we are serverless on Spark plan)
          // 1. Check if user already exists
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
             setAccess('approved');
             ensureUserProfile(user).catch(console.error);
          } else {
             // 2. Open Beta: Approve everyone who signs in
             setAccess('approved');
             ensureUserProfile(user).catch(console.error);
          }
        } catch (e) {
          console.error(e);
          setAccess('approved'); // Default to approved on error for reliability
        }
        setCurrentUser({
          uid: user.uid,
          name: user.displayName || user.email || 'Unknown player',
          email: user.email || ''
        });
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
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

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

  async function ensureUserProfile(user) {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        name: user.displayName || user.email || 'Unknown player',
        email: user.email || '',
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

  if (!currentUser || access === 'pending') {
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
    />
  );
}

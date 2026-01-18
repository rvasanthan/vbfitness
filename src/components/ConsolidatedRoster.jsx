import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { Check, X, Minus, User, Loader2 } from 'lucide-react';
import { parseLocalDate } from '../utils/dateHelpers';

export default function ConsolidatedRoster({ year, dates, users, isAdmin }) {
  const [availabilityMap, setAvailabilityMap] = useState({}); // { [userId]: { [date]: { status, guests } } }
  const [matchesMap, setMatchesMap] = useState({}); // { [date]: { captain1Id, captain2Id } }
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null); // Key: `${date}_${userId}`

  // Stats for the header rows
  const statsByDate = useMemo(() => {
    const stats = {};
    dates.forEach(date => {
      stats[date] = { in: 0, out: 0, pending: 0 };
    });

    Object.values(availabilityMap).forEach(userDates => {
      dates.forEach(date => {
        const entry = userDates[date];
        if (entry?.status === 'in') {
             stats[date].in += 1 + (entry.guests || 0);
        } else if (entry?.status === 'out') {
             stats[date].out += 1;
        } else {
             stats[date].pending += 1;
        }
      });
    });
    return stats;
  }, [availabilityMap, dates]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        const q = query(
          collection(db, 'availability'),
          where('date', '>=', start),
          where('date', '<=', end)
        );
        const snap = await getDocs(q);
        const mapping = {};
        
        snap.docs.forEach(doc => {
           const d = doc.data();
           if (!mapping[d.user_id]) mapping[d.user_id] = {};
           mapping[d.user_id][d.date] = { status: d.status, guests: d.guests || 0 };
        });
        setAvailabilityMap(mapping);

        // Fetch Matches for Captain info
        const matchesQ = query(
            collection(db, 'matches'),
            where('date', '>=', start),
            where('date', '<=', end)
        );
        const matchSnap = await getDocs(matchesQ);
        const matchMapping = {};
        matchSnap.docs.forEach(doc => {
            const d = doc.data();
            matchMapping[d.date] = { 
                captain1Id: d.captain1Id, 
                captain2Id: d.captain2Id 
            };
        });
        setMatchesMap(matchMapping);

      } catch (e) {
        console.error("Error fetching roster:", e);
      } finally {
        setLoading(false);
      }
    }
    
    if (year) fetchAll();
  }, [year]);

  const handleToggleStatus = async (user, date, currentStatus) => {
    if (!isAdmin || processing) return;
    
    const key = `${date}_${user.id}`;
    setProcessing(key);

    try {
        let newStatus = null; // null means delete (pending)
        if (!currentStatus) newStatus = 'in';
        else if (currentStatus === 'in') newStatus = 'out';
        else if (currentStatus === 'out') newStatus = null;

        const docRef = doc(db, 'availability', `${date}_${user.id}`); // Using composite key for direct access if consistent
        // Note: The main app uses addDoc with auto-ID in some places, but also query. 
        // Ideally we should use a consistent ID format like `date_uid` to avoid duplicates.
        // Let's first try to find the existing doc ID from our map logic or query it to be safe, 
        // OR enforce `date_uid` ID usage. 
        // Given the existing code in App.jsx wraps addDoc, we might have auto-ids.
        // To support admin interaction safely, let's query the doc to update/delete it.
        
        const q = query(
            collection(db, 'availability'),
            where('user_id', '==', user.id),
            where('date', '==', date)
        );
        const snapshot = await getDocs(q);
        
        if (newStatus) {
            const data = {
                user_id: user.id,
                date: date,
                status: newStatus,
                guests: 0,
                // created_at: Timestamp.now() // Optional update
            };

            if (!snapshot.empty) {
                await setDoc(snapshot.docs[0].ref, data, { merge: true });
            } else {
                await setDoc(docRef, { ...data, created_at: Timestamp.now() }); // Fallback to deterministic ID if new
            }
        } else {
            // Delete
            if (!snapshot.empty) {
               await deleteDoc(snapshot.docs[0].ref);
            }
        }

        // Optimistic Update
        setAvailabilityMap(prev => ({
            ...prev,
            [user.id]: {
                ...prev[user.id],
                [date]: newStatus ? { status: newStatus, guests: 0 } : undefined
            }
        }));

    } catch (e) {
        console.error("Error updating status:", e);
        alert("Failed to update status");
    } finally {
        setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-navy-100/50">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p>Loading roster data...</p>
      </div>
    );
  }

  return (
    <div className="bg-navy-900 border border-navy-800/50 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-navy-800">
            <thead>
              <tr className="bg-navy-950 shadow-sm z-30">
                <th scope="col" className="sticky top-0 left-0 z-40 py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-navy-100 bg-navy-950 border-r border-navy-800 min-w-[200px] h-20 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                  <div>Player</div>
                  <div className="text-[10px] text-navy-100/40 font-normal uppercase tracking-wider mt-1">Status</div>
                </th>
                {dates.map(date => {
                  const d = parseLocalDate(date);
                  const isPast = new Date(date) < new Date().setHours(0,0,0,0);
                  return (
                    <th key={date} scope="col" className={`sticky top-0 z-30 px-2 py-3 text-center text-xs font-semibold min-w-[60px] h-20 bg-navy-950 ${isPast ? 'text-navy-100/30' : 'text-navy-100'}`}>
                      <div className="flex flex-col items-center justify-between h-full">
                         <div className="flex flex-col items-center">
                            <span className="uppercase text-[10px] tracking-wider mb-0.5 opacity-70">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                            <span className="text-lg leading-none">{d.getDate()}</span>
                            <span className="text-[9px] opacity-50">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                         </div>
                         
                         {/* Integrated Stats in Header */}
                         <div className="flex items-center gap-1 mt-2 text-[10px] font-mono leading-none">
                            <span className={`${statsByDate[date].in > 0 ? 'text-green-400 font-bold' : 'text-navy-100/20'}`}>
                              {statsByDate[date].in}
                            </span>
                            <span className="text-navy-100/20">/</span>
                            <span className={`${statsByDate[date].out > 0 ? 'text-red-400' : 'text-navy-100/20'}`}>
                              {statsByDate[date].out}
                            </span>
                         </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/50 bg-navy-900/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-navy-800/30 transition-colors">
                  <td className="sticky left-0 z-10 whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-navy-100 bg-navy-900 border-r border-navy-800">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-navy-800 flex items-center justify-center text-[10px] text-navy-100/70">
                         {user.name.charAt(0)}
                       </div>
                       {user.name}
                    </div>
                  </td>
                  {dates.map(date => {
                    const entry = availabilityMap[user.id]?.[date];
                    const status = entry?.status;
                    const guests = entry?.guests || 0;
                    const isProcessing = processing === `${date}_${user.id}`;
                    
                    const matchInfo = matchesMap[date];
                    const isC1 = matchInfo?.captain1Id === user.id;
                    const isC2 = matchInfo?.captain2Id === user.id;

                    return (
                      <td 
                        key={date} 
                        onClick={() => handleToggleStatus(user, date, status)}
                        className={`whitespace-nowrap px-2 py-3 text-center transition-colors ${isAdmin ? 'cursor-pointer hover:bg-navy-800/50' : ''} ${isC1 || isC2 ? 'bg-cricket-gold/5' : ''}`}
                        title={isAdmin ? "Click to toggle availability" : ""}
                      >
                        <div className={`flex flex-col items-center justify-center ${isProcessing ? 'opacity-50 scale-90' : ''}`}>
                          {status === 'in' ? (
                            <div className="flex items-center justify-center relative">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isC1 || isC2 ? 'bg-cricket-gold text-navy-900 shadow-md ring-1 ring-cricket-gold' : 'bg-green-500/20 text-green-400'}`}>
                                  {isC1 ? <span className="text-[10px] font-bold">C1</span> : isC2 ? <span className="text-[10px] font-bold">C2</span> : <Check size={14} strokeWidth={3} />}
                                </span>
                                {guests > 0 && <span className="ml-1 text-[10px] font-bold text-green-400">+{guests}</span>}
                            </div>
                          ) : status === 'out' ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-500/50">
                              <X size={14} strokeWidth={3} />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 text-navy-800">
                              <Minus size={14} />
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

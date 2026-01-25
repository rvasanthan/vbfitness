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

  // Calculate Waitlist Status for each date
  const waitlistMap = useMemo(() => {
     const result = {}; // { [date]: Set<userId> }
     
     dates.forEach(date => {
         const entries = [];
         Object.keys(availabilityMap).forEach(uid => {
             const entry = availabilityMap[uid][date];
             if (entry && entry.status === 'in') {
                 entries.push({ id: uid, ...entry });
             }
         });
         
         // Sort by timestamp
         entries.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
         
         // Apply strict 24 cap
         const MAX = 24;
         let headcount = 0;
         const waitlistedCoords = new Set();
         
         entries.forEach(e => {
             const size = 1 + (e.guests || 0);
             if (headcount + size <= MAX) {
                 headcount += size;
             } else {
                 waitlistedCoords.add(e.id);
             }
         });
         
         result[date] = waitlistedCoords;
     });
     
     return result;
  }, [availabilityMap, dates]);

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
           let ts = 0;
           if (d.created_at && typeof d.created_at.toMillis === 'function') {
                ts = d.created_at.toMillis();
           } else if (d.created_at) { 
                ts = new Date(d.created_at).getTime();
           }

           if (!mapping[d.user_id]) mapping[d.user_id] = {};
           mapping[d.user_id][d.date] = { status: d.status, guests: d.guests || 0, joinedAt: ts };
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
            };
            
            // If marking as IN, set timestamp to now so they go to end of list
            if (newStatus === 'in') {
                data.created_at = Timestamp.now();
            }

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
                [date]: newStatus ? { status: newStatus, guests: 0, joinedAt: Date.now() } : undefined
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
      <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p>Loading roster data...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-bg-primary shadow-sm z-30">
                <th scope="col" className="sticky top-0 left-0 z-40 py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-text-primary bg-bg-primary border-r border-border min-w-[200px] h-20 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                  <div>Player</div>
                  <div className="text-[10px] text-text-tertiary font-normal uppercase tracking-wider mt-1">Status</div>
                </th>
                {dates.map(date => {
                  const d = parseLocalDate(date);
                  const isPast = new Date(date) < new Date().setHours(0,0,0,0);
                  return (
                    <th key={date} scope="col" className={`sticky top-0 z-30 px-2 py-3 text-center text-xs font-semibold min-w-[60px] h-20 bg-bg-primary ${isPast ? 'text-text-tertiary' : 'text-text-primary'}`}>
                      <div className="flex flex-col items-center justify-between h-full">
                         <div className="flex flex-col items-center">
                            <span className="uppercase text-[10px] tracking-wider mb-0.5 opacity-70">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                            <span className="text-lg leading-none">{d.getDate()}</span>
                            <span className="text-[9px] opacity-50">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                         </div>
                         
                         {/* Integrated Stats in Header */}
                         <div className="flex items-center gap-1 mt-2 text-[10px] font-mono leading-none">
                            <span className={`${statsByDate[date].in > 0 ? 'text-success font-bold' : 'text-text-tertiary/20'}`}>
                              {statsByDate[date].in}
                            </span>
                            <span className="text-text-tertiary/20">/</span>
                            <span className={`${statsByDate[date].out > 0 ? 'text-error' : 'text-text-tertiary/20'}`}>
                              {statsByDate[date].out}
                            </span>
                         </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-bg-secondary/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-bg-tertiary/30 transition-colors">
                  <td className="sticky left-0 z-10 whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-text-primary bg-bg-secondary border-r border-border">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center text-[10px] text-text-tertiary">
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
                    const isWaitlisted = waitlistMap[date]?.has(user.id);

                    return (
                      <td 
                        key={date} 
                        onClick={() => handleToggleStatus(user, date, status)}
                        className={`whitespace-nowrap px-2 py-3 text-center transition-colors ${isAdmin ? 'cursor-pointer hover:bg-bg-tertiary/50' : ''} ${isC1 || isC2 ? 'bg-accent/5' : ''}`}
                        title={isAdmin ? "Click to toggle availability" : ""}
                      >
                        <div className={`flex flex-col items-center justify-center ${isProcessing ? 'opacity-50 scale-90' : ''}`}>
                          {status === 'in' ? (
                            <div className="flex items-center justify-center relative">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                                    isC1 || isC2 ? 'bg-accent text-white shadow-md ring-1 ring-accent' 
                                    : isWaitlisted ? 'bg-waiting/20 text-waiting' // Amber for Waitlist
                                    : 'bg-success/20 text-success'
                                }`}>
                                  {isC1 ? <span className="text-[10px] font-bold">C1</span> : isC2 ? <span className="text-[10px] font-bold">C2</span> : <Check size={14} strokeWidth={3} />}
                                </span>
                                {guests > 0 && <span className={`ml-1 text-[10px] font-bold ${isWaitlisted ? 'text-waiting' : 'text-success'}`}>+{guests}</span>}
                            </div>
                          ) : status === 'out' ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-error/10 text-error/50">
                              <X size={14} strokeWidth={3} />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 text-text-tertiary">
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

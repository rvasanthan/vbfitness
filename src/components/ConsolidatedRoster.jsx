import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { Check, X, Minus, User, Loader2 } from 'lucide-react';
import { parseLocalDate } from '../utils/dateHelpers';

export default function ConsolidatedRoster({ year, dates, users }) {
  const [availabilityMap, setAvailabilityMap] = useState({}); // { [userId]: { [date]: { status, guests } } }
  const [loading, setLoading] = useState(true);

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
      } catch (e) {
        console.error("Error fetching roster:", e);
      } finally {
        setLoading(false);
      }
    }
    
    if (year) fetchAll();
  }, [year]);

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
              <tr className="bg-navy-950/50">
                <th scope="col" className="sticky left-0 z-20 py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-navy-100 bg-navy-950/95 backdrop-blur border-r border-navy-800 min-w-[200px]">
                  Player
                </th>
                {dates.map(date => {
                  const d = parseLocalDate(date);
                  const isPast = new Date(date) < new Date().setHours(0,0,0,0);
                  return (
                    <th key={date} scope="col" className={`px-2 py-3 text-center text-xs font-semibold min-w-[60px] ${isPast ? 'text-navy-100/30' : 'text-navy-100'}`}>
                      <div className="flex flex-col items-center">
                         <span className="uppercase text-[10px] tracking-wider mb-0.5 opacity-70">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                         <span className="text-lg leading-none">{d.getDate()}</span>
                         <span className="text-[9px] opacity-50">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
              {/* Stats Row */}
              <tr className="bg-navy-800/30 font-mono text-xs border-b border-navy-800/50">
                <td className="sticky left-0 z-20 py-2 pl-4 pr-3 text-left font-medium text-navy-100/70 bg-navy-900/95 border-r border-navy-800">
                  Total Confirmed
                </td>
                {dates.map(date => (
                  <td key={date} className="px-2 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded ${statsByDate[date].in > 0 ? 'bg-green-500/20 text-green-400 font-bold' : 'text-navy-100/20'}`}>
                      {statsByDate[date].in}
                    </span>
                  </td>
                ))}
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
                    
                    return (
                      <td key={date} className="whitespace-nowrap px-2 py-3 text-center">
                        <div className="flex flex-col items-center justify-center">
                          {status === 'in' ? (
                            <div className="flex items-center justify-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400">
                                  <Check size={14} strokeWidth={3} />
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

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { MapPin, Clock, Trophy, Swords, Trash2, Calendar, Loader2 } from 'lucide-react';
import { parseLocalDate } from '../utils/dateHelpers';

export default function MatchesList({ isAdmin }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const q = query(collection(db, 'matches'), orderBy('date', 'asc'));
        const snapshot = await getDocs(q);
        setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error fetching matches:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this match?')) return;
    try {
        await deleteDoc(doc(db, 'matches', id));
        setMatches(matches.filter(m => m.id !== id));
    } catch (e) {
        alert('Error deleting match');
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-12 text-navy-100/50">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p>Loading fixtures...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy-100 tracking-tight">Season Fixtures</h2>
            <p className="text-navy-100/60 text-sm mt-1">Upcoming matches and results</p>
          </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {matches.map(match => {
          const dateObj = parseLocalDate(match.date);
          const isPast = new Date(match.date) < new Date().setHours(0,0,0,0);

          return (
          <div key={match.id} className={`bg-navy-900 border border-navy-800 rounded-xl p-5 shadow-sm hover:border-navy-700 transition-colors relative group ${isPast ? 'opacity-60 grayscale-[0.8] hover:grayscale-0 hover:opacity-100' : ''}`}>
             {/* Date Header */}
             <div className="flex items-center gap-2 mb-4 text-cricket-gold font-bold text-sm uppercase tracking-wider bg-navy-950/50 px-3 py-1.5 rounded-lg w-fit">
               <Calendar size={14} />
               {dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
             </div>
             
             {/* Title */}
             <div className="flex items-start gap-4 mb-5">
               <div className="p-3 bg-gradient-to-br from-navy-800 to-navy-950 rounded-xl text-white shadow-inner">
                 <Swords size={24} />
               </div>
               <div>
                  <div className="text-navy-100 font-bold text-lg leading-tight mb-1">
                    {match.opponent || "Internal Match"}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                      match.status === 'completed' ? 'bg-navy-800 text-navy-100/50 border border-navy-700' : 
                      match.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse' : 
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {match.status}
                  </span>
               </div>
             </div>

             {/* Details */}
             <div className="space-y-2.5 text-sm text-navy-100/60 border-t border-navy-800/50 pt-4">
               <div className="flex items-center gap-2.5">
                 <MapPin size={14} className="text-navy-100/40" /> {match.venue}
               </div>
               <div className="flex items-center gap-2.5">
                 <Clock size={14} className="text-navy-100/40" /> {match.time}
               </div>
               <div className="flex items-center gap-2.5">
                 <Trophy size={14} className="text-navy-100/40" /> {match.format}
               </div>
             </div>
             
             {isAdmin && (
                <button 
                  onClick={() => handleDelete(match.id)}
                  className="absolute top-4 right-4 p-2 text-navy-100/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Match"
                >
                    <Trash2 size={16} />
                </button>
             )}
          </div>
        )})}
        {matches.length === 0 && (
            <div className="col-span-full py-20 text-center text-navy-100/30 border-2 border-dashed border-navy-800/50 rounded-2xl bg-navy-900/20">
                <Swords className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No matches scheduled yet.</p>
            </div>
        )}
      </div>
    </div>
  );
}

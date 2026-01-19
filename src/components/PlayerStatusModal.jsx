import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Clock, Shield } from 'lucide-react';

export default function PlayerStatusModal({ isOpen, onClose, match, users, isAdmin, onCheckIn }) {
  if (!isOpen || !match) return null;

  // Helper to find user details
  const getUser = (id) => users.find(u => u.uid === id || u.id === id);

  // Teams
  const team1Ids = match.team1 || [];
  const team2Ids = match.team2 || [];
  const checkedInIds = match.checkedInPlayers || [];

  // Categorize
  const players = [];

  // Process Team 1 (Spartans - Red)
  team1Ids.forEach(id => {
    const user = getUser(id);
    if (user) {
        players.push({
            id,
            name: user.name || 'Unknown',
            team: 'Spartans',
            colorClass: 'text-red-400',
            bgClass: 'bg-red-500/10 border-red-500/20',
            checkedIn: checkedInIds.includes(id)
        });
    }
  });

  // Process Team 2 (Warriors - Blue)
  team2Ids.forEach(id => {
    const user = getUser(id);
    if (user) {
        players.push({
            id,
            name: user.name || 'Unknown',
            team: 'Warriors',
            colorClass: 'text-blue-400',
            bgClass: 'bg-blue-500/10 border-blue-500/20',
            checkedIn: checkedInIds.includes(id)
        });
    }
  });

  const checkedInList = players.filter(p => p.checkedIn);
  const othersList = players.filter(p => !p.checkedIn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-navy-900 w-full max-w-lg rounded-2xl shadow-2xl border border-navy-800 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-navy-800 bg-navy-950/50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-navy-100 flex items-center gap-2">
                <Shield className="text-cricket-gold" size={20} />
                Player Status
            </h3>
            <p className="text-xs text-navy-100/50 mt-1">Check-in manifest for {match.opponent || 'Match'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-full text-navy-100/50 hover:text-navy-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{checkedInList.length}</div>
                    <div className="text-xs text-green-400/60 uppercase tracking-wider font-bold">Checked In</div>
                </div>
                <div className="bg-navy-800/50 border border-navy-700 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-navy-100 mb-1">{othersList.length}</div>
                    <div className="text-xs text-navy-100/40 uppercase tracking-wider font-bold">Yet to Come</div>
                </div>
            </div>

            {/* Lists */}
            <div className="space-y-4">
                {/* Checked In */}
                <div>
                   <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                     <CheckCircle2 size={14} /> Checked In
                   </h4>
                   {checkedInList.length === 0 ? (
                       <p className="text-navy-100/30 text-sm italic">No players checked in yet.</p>
                   ) : (
                       <div className="grid grid-cols-2 gap-2">
                           {checkedInList.map(p => (
                               <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.bgClass} group`}>
                                   <div className={`w-2 h-2 rounded-full ${p.team === 'Spartans' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                   <span className={`text-sm font-medium ${p.colorClass} truncate flex-1`}>{p.name}</span>
                                   {isAdmin && (
                                       <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCheckIn(match.id, p.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded hover:bg-red-500 hover:text-white whitespace-nowrap"
                                       >
                                           Check Out
                                       </button>
                                   )}
                               </div>
                           ))}
                       </div>
                   )}
                </div>

                <div className="h-px bg-navy-800" />

                {/* Yet to Come */}
                <div>
                   <h4 className="text-xs font-bold text-navy-100/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                     <Clock size={14} /> Yet to Come
                   </h4>
                   {othersList.length === 0 ? (
                       <p className="text-navy-100/30 text-sm italic">All players accounted for.</p>
                   ) : (
                       <div className="grid grid-cols-2 gap-2">
                           {othersList.map(p => (
                               <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.bgClass} opacity-60 hover:opacity-100 transition-all group`}>
                                   <div className={`w-2 h-2 rounded-full ${p.team === 'Spartans' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                   <span className={`text-sm font-medium ${p.colorClass} truncate flex-1`}>{p.name}</span>
                                   {isAdmin && (
                                       <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCheckIn(match.id, p.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-green-500 text-navy-950 text-[10px] font-bold px-2 py-0.5 rounded hover:bg-green-400 whitespace-nowrap"
                                       >
                                           Check In
                                       </button>
                                   )}
                               </div>
                           ))}
                       </div>
                   )}
                </div>
            </div>
        </div>

      </motion.div>
    </div>
  );
}

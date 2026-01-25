import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Clock, Shield, Navigation, Coffee } from 'lucide-react';

export default function PlayerStatusModal({ isOpen, onClose, match, users, isAdmin, onCheckIn }) {
  if (!isOpen || !match) return null;

  // Helper to find user details
  const getUser = (id) => users.find(u => u.uid === id || u.id === id);

  // Teams
  const team1Ids = match.team1 || [];
  const team2Ids = match.team2 || [];
  const checkedInIds = match.checkedInPlayers || [];
  const onMyWayIds = match.onMyWayPlayers || [];
  const coffeeIds = match.coffeePlayerIds || [];

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
            colorClass: 'text-team1',
            bgClass: 'bg-team1/10 border-team1/20',
            checkedIn: checkedInIds.includes(id),
            onMyWay: onMyWayIds.includes(id),
            bringsCoffee: coffeeIds.includes(id)
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
            colorClass: 'text-team2',
            bgClass: 'bg-team2/10 border-team2/20',
            checkedIn: checkedInIds.includes(id),
            onMyWay: onMyWayIds.includes(id),
            bringsCoffee: coffeeIds.includes(id)
        });
    }
  });

  const checkedInList = players.filter(p => p.checkedIn);
  const onMyWayList = players.filter(p => p.onMyWay && !p.checkedIn);
  const coffeeList = players.filter(p => p.bringsCoffee);
  const othersList = players.filter(p => !p.checkedIn && !p.onMyWay);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg-secondary w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-bg-primary/50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Shield className="text-accent" size={20} />
                Player Status
            </h3>
            <p className="text-xs text-text-secondary mt-1">Check-in manifest for {match.opponent || 'Match'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-full text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-success/5 border border-success/20 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-success mb-1">{checkedInList.length}</div>
                    <div className="text-[10px] text-success/60 uppercase tracking-wider font-bold">Checked In</div>
                </div>
                <div className="bg-info/5 border border-info/20 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-info mb-1">{onMyWayList.length}</div>
                    <div className="text-[10px] text-info/60 uppercase tracking-wider font-bold">On My Way</div>
                </div>
                <div className="bg-bg-tertiary border border-border rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-text-primary mb-1">{othersList.length}</div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Waiting</div>
                </div>
            </div>

            {/* Lists */}
                        <div className="space-y-6">
                                {/* Bringing Coffee */}
                                {coffeeList.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-coffee uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Coffee size={14} /> Bringing Coffee
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {coffeeList.map(p => (
                                                <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-coffee/10 border-coffee/30`}>
                                                    <Coffee size={12} className="text-coffee" />
                                                    <span className="text-sm font-bold text-text-primary truncate flex-1">{p.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                {/* Checked In */}
                <div>
                   <h4 className="text-xs font-bold text-success uppercase tracking-wider mb-3 flex items-center gap-2">
                     <CheckCircle2 size={14} /> Checked In
                   </h4>
                   {checkedInList.length === 0 ? (
                       <p className="text-text-secondary text-sm italic">No players checked in yet.</p>
                   ) : (
                       <div className="grid grid-cols-2 gap-2">
                           {checkedInList.map(p => (
                               <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.bgClass} group`}>
                                   <div className={`w-2 h-2 rounded-full ${p.team === 'Spartans' ? 'bg-team2' : 'bg-team1'}`} />
                                   <span className={`text-sm font-medium ${p.colorClass} truncate flex-1`}>{p.name}</span>
                                   {isAdmin && (
                                       <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCheckIn(match.id, p.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-error/20 text-error text-[10px] font-bold px-2 py-0.5 rounded hover:bg-error hover:text-white whitespace-nowrap"
                                       >
                                           Check Out
                                       </button>
                                   )}
                               </div>
                           ))}
                       </div>
                   )}
                </div>

                {onMyWayList.length > 0 && <div className="h-px bg-border" />}
                
                {/* On My Way - Only show if there are players */}
                {onMyWayList.length > 0 && (
                <div>
                   <h4 className="text-xs font-bold text-info uppercase tracking-wider mb-3 flex items-center gap-2">
                     <Navigation size={14} /> On My Way
                   </h4>
                   <div className="grid grid-cols-2 gap-2">
                       {onMyWayList.map(p => (
                           <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.bgClass} group`}>
                               <div className={`w-2 h-2 rounded-full ${p.team === 'Spartans' ? 'bg-team2' : 'bg-team1'}`} />
                               <span className={`text-sm font-medium ${p.colorClass} truncate flex-1`}>{p.name}</span>
                               {isAdmin && (
                                   <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCheckIn(match.id, p.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded hover:opacity-90 whitespace-nowrap"
                                   >
                                       Check In
                                   </button>
                               )}
                           </div>
                       ))}
                   </div>
                </div>
                )}

                <div className="h-px bg-border" />

                {/* Yet to Come */}
                <div>
                   <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                     <Clock size={14} /> Yet to Come
                   </h4>
                   {othersList.length === 0 ? (
                       <p className="text-text-secondary text-sm italic">All players accounted for.</p>
                   ) : (
                       <div className="grid grid-cols-2 gap-2">
                           {othersList.map(p => (
                               <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.bgClass} opacity-60 hover:opacity-100 transition-all group`}>
                                   <div className={`w-2 h-2 rounded-full ${p.team === 'Spartans' ? 'bg-team2' : 'bg-team1'}`} />
                                   <span className={`text-sm font-medium ${p.colorClass} truncate flex-1`}>{p.name}</span>
                                   {isAdmin && (
                                       <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCheckIn(match.id, p.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded hover:opacity-90 whitespace-nowrap"
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

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { MapPin, Clock, Trophy, Swords, Trash2, Calendar, Loader2, CheckCircle, Users, Navigation, Disc, Play, RotateCcw } from 'lucide-react';
import { parseLocalDate } from '../utils/dateHelpers';
import PlayerStatusModal from './PlayerStatusModal';
import TossModal from './TossModal';
import ScoringSetupModal from './ScoringSetupModal';
import ScoringInterface from './ScoringInterface';

export default function MatchesList({ isAdmin, user, users }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(null);
  const [statusModalMatch, setStatusModalMatch] = useState(null);
  const [tossModalMatch, setTossModalMatch] = useState(null);
  const [scoringSetupMatch, setScoringSetupMatch] = useState(null);
  const [activeScoringMatch, setActiveScoringMatch] = useState(null);

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
  }, [checkingIn]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this match?')) return;
    try {
        await deleteDoc(doc(db, 'matches', id));
        setMatches(matches.filter(m => m.id !== id));
    } catch (e) {
        alert('Error deleting match');
    }
  }

  const handleCheckIn = async (matchId, targetUserId = user.uid) => {
      setCheckingIn(matchId);
      try {
          const match = matches.find(m => m.id === matchId);
          const isCheckedIn = match?.checkedInPlayers?.includes(targetUserId);
          
          const matchRef = doc(db, 'matches', matchId);
          await updateDoc(matchRef, {
              checkedInPlayers: isCheckedIn ? arrayRemove(targetUserId) : arrayUnion(targetUserId),
              onMyWayPlayers: arrayRemove(targetUserId) // Ensure they are removed from OMW if checking in
          });
          
          // Update local state to reflect immediately
          const updateLocalState = (m) => {
              let newCheckedIn = m.checkedInPlayers || [];
              let newOnMyWay = m.onMyWayPlayers || [];

              if (isCheckedIn) {
                   newCheckedIn = newCheckedIn.filter(id => id !== targetUserId);
              } else {
                   newCheckedIn = [...newCheckedIn, targetUserId];
                   newOnMyWay = newOnMyWay.filter(id => id !== targetUserId);
              }
              return { ...m, checkedInPlayers: newCheckedIn, onMyWayPlayers: newOnMyWay };
          };

          setMatches(matches.map(m => {
              if (m.id === matchId) {
                  return updateLocalState(m);
              }
              return m;
          }));

          // Update modal state if open
          if (statusModalMatch && statusModalMatch.id === matchId) {
              setStatusModalMatch(prev => updateLocalState(prev));
          }
      } catch (e) {
          console.error("Check in toggle failed", e);
          alert("Action failed. Please try again.");
      } finally {
          setCheckingIn(null);
      }
  };

  const handleOnMyWay = async (matchId) => {
    try {
        const match = matches.find(m => m.id === matchId);
        const isOnMyWay = match?.onMyWayPlayers?.includes(user?.uid);
        
        const matchRef = doc(db, 'matches', matchId);
        await updateDoc(matchRef, {
            onMyWayPlayers: isOnMyWay ? arrayRemove(user.uid) : arrayUnion(user.uid)
        });

         // Update local
         const updateLocalState = (m) => {
            let newOnMyWay = m.onMyWayPlayers || [];
            if (isOnMyWay) {
                newOnMyWay = newOnMyWay.filter(id => id !== user.uid);
            } else {
                newOnMyWay = [...newOnMyWay, user.uid];
            }
            return { ...m, onMyWayPlayers: newOnMyWay };
        };

        setMatches(matches.map(m => {
            if (m.id === matchId) return updateLocalState(m);
            return m;
        }));

        if (statusModalMatch && statusModalMatch.id === matchId) {
            setStatusModalMatch(prev => updateLocalState(prev));
        }

    } catch (e) {
        console.error("On my way toggle failed", e);
    }
  };

  const handleSaveToss = async (matchId, tossData) => {
    try {
        const matchRef = doc(db, 'matches', matchId);
        await updateDoc(matchRef, tossData);
        
        // Update local state
        setMatches(matches.map(m => {
            if (m.id === matchId) {
                return { ...m, ...tossData };
            }
            return m;
        }));
    } catch (e) {
        console.error("Error saving toss:", e);
        alert("Failed to save toss result");
    }
  };

  const handleStartMatchInteraction = (match) => {
      // If toss hasn't happened yet, warn or allow anyway? 
      // Ideally toss should happen.
      if (!match.tossWinner) {
          alert("Please record the Toss result first.");
          return;
      }
      setScoringSetupMatch(match);
  };

  const handleStartScoring = async (matchId, startData) => {
    try {
        const matchRef = doc(db, 'matches', matchId);
        await updateDoc(matchRef, startData);
        
        // Update local
        setMatches(matches.map(m => {
            if (m.id === matchId) return { ...m, ...startData };
            return m;
        }));
    } catch (e) {
        console.error("Start match failed", e);
        alert("Failed to start match");
    }
  };

  const handleResetMatch = async (matchId) => {
      if (!confirm("Are you SURE you want to Reset this match?\n\nThis will ERASE the Toss, Score, and Status. It cannot be undone.")) return;
      try {
          const matchRef = doc(db, 'matches', matchId);
          await updateDoc(matchRef, {
              status: 'scheduled',
              tossWinner: deleteField(),
              tossWinnerName: deleteField(),
              tossChoice: deleteField(),
              scoring: deleteField()
          });

          // Update local
          setMatches(matches.map(m => {
              if (m.id === matchId) {
                  const newMatch = { ...m, status: 'scheduled' };
                  delete newMatch.tossWinner;
                  delete newMatch.tossWinnerName;
                  delete newMatch.tossChoice;
                  delete newMatch.scoring;
                  return newMatch;
              }
              return m;
          }));
      } catch (e) {
          console.error("Match reset failed", e);
          alert("Failed to reset match");
      }
  };

  // Filter out past matches
  const upcomingMatches = matches.filter(match => {
      // Create date at midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const matchDate = parseLocalDate(match.date);
      // If match date is today or future, keep it
      return matchDate >= today;
  });

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
        {upcomingMatches.length === 0 && (
            <div className="col-span-full py-20 text-center text-navy-100/30 border-2 border-dashed border-navy-800/50 rounded-2xl bg-navy-900/20">
                <Swords className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No upcoming matches scheduled.</p>
            </div>
        )}

        {upcomingMatches.map(match => {
          const dateObj = parseLocalDate(match.date);
          const captain1 = users?.find(u => u.uid === match.captain1Id || u.id === match.captain1Id);
          const captain2 = users?.find(u => u.uid === match.captain2Id || u.id === match.captain2Id);
          
          const isPlayerInRoster = (match.team1?.includes(user?.uid) || match.team2?.includes(user?.uid));
          const isCheckedIn = match.checkedInPlayers?.includes(user?.uid);
          const isCaptain = match.captain1Id === user?.uid || match.captain2Id === user?.uid;
          const canManageToss = isAdmin || isCaptain;

          return (
          <div key={match.id} className="bg-navy-900 border border-navy-800 rounded-xl p-5 shadow-sm hover:border-navy-700 transition-colors relative group">
             {/* Match Header: Date & Overs */}
             <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2 text-cricket-gold font-bold text-sm uppercase tracking-wider bg-navy-950/50 px-3 py-1.5 rounded-lg">
                    <Calendar size={14} />
                    {dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                 </div>
                 {match.format && (
                     <span className="text-xs font-bold text-navy-100/40 bg-navy-800/50 px-2 py-1 rounded">
                         {match.format}
                     </span>
                 )}
             </div>
             
             {/* Captains Display */}
             <div className="flex items-center justify-between gap-4 mb-5 px-1">
                {/* Captain 1 (Red/Spartans) */}
                <div className="flex flex-col items-center text-center w-1/2">
                   <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 font-bold mb-1 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                      {captain1 ? captain1.name.charAt(0) : '?'}
                   </div>
                   <div className="text-xs font-bold text-red-400 truncate w-full">{captain1?.name || 'TBD'}</div>
                   <div className="text-[10px] text-red-500/50 uppercase tracking-widest font-black">Spartans</div>
                </div>

                <div className="text-navy-100/20 font-black text-xs">VS</div>

                {/* Captain 2 (Blue/Warriors) */}
                <div className="flex flex-col items-center text-center w-1/2">
                   <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 font-bold mb-1 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                      {captain2 ? captain2.name.charAt(0) : '?'}
                   </div>
                   <div className="text-xs font-bold text-blue-400 truncate w-full">{captain2?.name || 'TBD'}</div>
                   <div className="text-[10px] text-blue-500/50 uppercase tracking-widest font-black">Warriors</div>
                </div>
             </div>

             {/* Details */}
             <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-navy-100/60 border-t border-navy-800/50 pt-3 mb-3">
               <div className="flex items-center gap-1.5">
                 <MapPin size={14} className="text-navy-100/40" /> {match.venue || 'Rahway River Park'}
               </div>
               <div className="flex items-center gap-1.5">
                 <Clock size={14} className="text-navy-100/40" /> {match.time || '1:00 PM'}
               </div>
             </div>

             {/* Toss Result Badge */}
             {match.tossWinner && (
                <div className="mb-4 bg-navy-950/50 border border-navy-800 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cricket-gold/10 flex items-center justify-center shrink-0">
                        <Disc size={16} className="text-cricket-gold animate-pulse" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-navy-100">
                            <span className={match.tossWinner === 'team1' ? 'text-red-400' : 'text-blue-400'}>
                                {match.tossWinnerName || (match.tossWinner === 'team1' ? 'Spartans' : 'Warriors')}
                            </span>
                            <span className="text-navy-100/60"> won the toss</span>
                        </div>
                        <div className="text-[10px] text-navy-100/40 font-medium uppercase tracking-wider">
                            Elected to {match.tossChoice}
                        </div>
                    </div>
                </div>
             )}
             
                          {/* Actions Area */}
             <div className="flex flex-col gap-3">
                 
                 {/* Admin / Captain Controls */}
                 {canManageToss && (
                    <div className="grid grid-cols-[1fr_auto] gap-2 p-2 bg-navy-950/40 rounded-lg border border-navy-800/50">
                        <div className="grid grid-cols-2 gap-2">
                             {/* Win Toss */}
                             {!match.tossWinner ? (
                                <button
                                    onClick={() => setTossModalMatch(match)}
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold bg-navy-800 text-navy-100 hover:bg-navy-700 hover:text-white transition-all border border-navy-700"
                                >
                                    <Disc size={14} /> Win Toss
                                </button>
                             ) : (
                                <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-navy-900/50 text-navy-100/30 border border-navy-800 border-dashed cursor-default">
                                    <CheckCircle size={12} /> Toss Done
                                </div>
                             )}

                             {/* Start / Score Match */}
                             {match.status !== 'active' ? (
                                <button
                                    onClick={() => handleStartMatchInteraction(match)}
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-500 transition-all shadow-lg shadow-green-900/20"
                                >
                                    <Play size={14} fill="currentColor" /> Start Match
                                </button>
                             ) : (
                                <button
                                    onClick={() => setActiveScoringMatch(match)}
                                    className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-900/20 border border-red-500/20 animate-pulse"
                                >
                                    <Trophy size={14} fill="currentColor" /> Score Live
                                </button>
                             )}
                        </div>

                        {/* Reset Button */}
                        {(match.tossWinner || match.status === 'active' || isAdmin) && (
                            <button
                                onClick={() => handleResetMatch(match.id)}
                                className="w-10 flex items-center justify-center rounded-lg bg-navy-900 text-red-500 hover:bg-red-500/10 border border-navy-700 hover:border-red-500/30 transition-all"
                                title="Reset Match"
                            >
                                <RotateCcw size={16} />
                            </button>
                        )}
                    </div>
                 )}

                 {/* Player Participation Controls */}
                 <div className="grid grid-cols-3 gap-2">
                     {/* Check In */}
                     {(isPlayerInRoster || isAdmin) ? (
                        <button
                            onClick={() => !isCheckedIn && handleCheckIn(match.id)}
                            disabled={isCheckedIn || checkingIn === match.id}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                                isCheckedIn 
                                ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-default'
                                : 'bg-cricket-gold text-navy-950 hover:bg-white shadow-[0_0_15px_rgba(255,215,0,0.1)]'
                            }`}
                        >
                            {checkingIn === match.id ? <Loader2 className="animate-spin" size={14} /> : 
                            isCheckedIn ? <CheckCircle size={14} /> : null
                            }
                            {isCheckedIn ? 'Checked In' : 'Check In'}
                        </button>
                     ) : (
                         <div className="bg-navy-950/30 border border-navy-800/30 rounded-lg" /> 
                         // Placeholder to keep grid structure if button missing
                     )}
                     
                     {/* On My Way - Only show if eligible and NOT checked in yet */}
                     {(!isCheckedIn && (isPlayerInRoster || isAdmin)) ? (
                        <button
                            onClick={() => handleOnMyWay(match.id)}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all border ${
                                match.onMyWayPlayers?.includes(user?.uid)
                                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                : 'bg-navy-800 text-navy-100/60 border-navy-700 hover:border-navy-500 hover:text-navy-100'
                            }`}
                        >
                            <Navigation size={14} className={match.onMyWayPlayers?.includes(user?.uid) ? "fill-indigo-400/20" : ""} />
                            {match.onMyWayPlayers?.includes(user?.uid) ? 'On way' : 'On way'}
                        </button>
                     ) : (
                        // If checked in, occupy space or hide? 
                        // If we hide, grid might shift. Let's render an "Info" or disabled state if checked in?
                        // Actually if checked in, OMW is irrelevant. Let's put a "Status" button here if we want to fill space? 
                        // Or just let grid handle it.
                        <div className={`hidden`} /> 
                     )}

                     {/* Status Button - Always visible */}
                     <button
                        onClick={() => setStatusModalMatch(match)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold bg-navy-800 text-navy-100/70 hover:bg-navy-700 transition-colors border border-navy-700/50 ${
                            // Span 2 cols if Checked In (since OMW is hidden)
                            isCheckedIn ? 'col-span-2' : ''
                        }`}
                     >
                        <Users size={14} /> Roster
                     </button>
                 </div>
             </div>


             {isAdmin && (
                <button 
                  onClick={() => handleDelete(match.id)}
                  className="absolute top-2 right-2 p-1.5 text-navy-100/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Match"
                >
                    <Trash2 size={14} />
                </button>
             )}
          </div>
        )})}
      </div>

      <PlayerStatusModal 
        isOpen={!!statusModalMatch}
        match={statusModalMatch}
        users={users}
        onClose={() => setStatusModalMatch(null)}
        isAdmin={isAdmin}
        onCheckIn={handleCheckIn}
      />

      <TossModal 
        isOpen={!!tossModalMatch}
        match={tossModalMatch}
        onClose={() => setTossModalMatch(null)}
        onSave={handleSaveToss}
      />

      <ScoringSetupModal 
        isOpen={!!scoringSetupMatch}
        match={scoringSetupMatch}
        users={users}
        onClose={() => setScoringSetupMatch(null)}
        onStartScoring={handleStartScoring}
      />

      <ScoringInterface 
          isOpen={!!activeScoringMatch}
          match={activeScoringMatch}
          users={users}
          onClose={() => setActiveScoringMatch(null)}
          onUpdateLocal={(updatedMatch) => {
              setActiveScoringMatch(updatedMatch); 
              setMatches(matches.map(m => m.id === updatedMatch.id ? updatedMatch : m));
          }}
      />
    </div>
  );
}

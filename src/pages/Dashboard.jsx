import { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Info,
  Users,
  LayoutGrid,
  Table,
  Shield,
  Swords,
  Play,
  Plus,
  Minus,
  Wand2,
  Trash2,
  Clock,
  Share2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import MatchShareCard from '../components/MatchShareCard';
import ConsolidatedRoster from '../components/ConsolidatedRoster';
import CreateMatchModal from '../components/CreateMatchModal';
import GuestNameModal from '../components/GuestNameModal';
import MatchesList from '../components/MatchesList';
import { formatDayLabel, groupByMonth, parseLocalDate } from '../utils/dateHelpers';

export default function Dashboard({
  user,
  users,
  year,
  setYear,
  weekendDates,
  holidays,
  selectedDate,
  setSelectedDate,
  availability,
  onSetStatus,
  onResetPool,
  onSignOut,
  loading,
  statusMessage,
  isAdmin,
  onOpenAdmin,
  onRefresh
}) {
  const [guestCount, setGuestCount] = useState(0);
  const [viewMode, setViewMode] = useState('calendar');
  const [match, setMatch] = useState(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [pendingGuestCount, setPendingGuestCount] = useState(0);
  const shareCardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const handleGuestClick = (count) => {
    if (count === 0) {
        setGuestCount(0);
        onSetStatus('in', 0); // Clear guests
    } else {
        setPendingGuestCount(count);
        setIsGuestModalOpen(true);
    }
  };

  const handleGuestSubmit = (names) => {
    setIsGuestModalOpen(false);
    setGuestCount(names.length);
    onSetStatus('in', names);
  };

  useEffect(() => {
     console.log("Dashboard Loaded. Current User:", user?.email, "Role:", user?.role, "IsAdmin Prop:", isAdmin);
  }, [user, isAdmin]);

  // Fetch Match for Selected Date
  useEffect(() => {
    async function fetchMatch() {
        if (!selectedDate) {
            setMatch(null);
            return;
        }
        try {
            const q = query(
                collection(db, 'matches'), 
                where('date', '==', selectedDate)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                setMatch({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            } else {
                setMatch(null);
            }
        } catch (e) {
            console.error("Error fetching match:", e);
        }
    }
    fetchMatch();
  }, [selectedDate]);

  const handleCreateMatch = async (matchData) => {
      setCreatingMatch(true);
      try {
          if (match && match.id) {
              const matchRef = doc(db, 'matches', match.id);
              await updateDoc(matchRef, {
                  ...matchData,
                  status: 'scheduled'
              });
              setMatch(prev => ({ ...prev, ...matchData, status: 'scheduled' }));
          } else {
              const docRef = await addDoc(collection(db, 'matches'), {
                  ...matchData,
                  status: 'scheduled',
                  created_by: user.uid,
                  created_at: Timestamp.now()
              });
              setMatch({ id: docRef.id, ...matchData, status: 'scheduled' });
          }
          setIsMatchModalOpen(false);
      } catch (e) {
          console.error("Error creating match:", e);
          alert("Failed to create match");
      } finally {
          setCreatingMatch(false);
      }
  };

  const handleStartMatch = async () => {
      if (!match) return;
      try {
          const matchRef = doc(db, 'matches', match.id);
          const newStatus = match.status === 'scheduled' ? 'active' : 'scheduled';
          await updateDoc(matchRef, {
              status: newStatus
          });
          setMatch({ ...match, status: newStatus });
      } catch (e) {
          console.error("Error updating match:", e);
      }
  };

  const handleSetCaptain = async (playerId, role) => {
    // role: '1' | '2' | null
    try {
        let matchId = match?.id;
        let matchRef;

        const currentTeam1 = match?.team1 || [];
        const currentTeam2 = match?.team2 || [];

        // 1. Remove from any existing teams (clean slate)
        let newTeam1 = currentTeam1.filter(id => id !== playerId);
        let newTeam2 = currentTeam2.filter(id => id !== playerId);

        if (!matchId) {
             matchRef = await addDoc(collection(db, 'matches'), {
                date: selectedDate,
                status: 'scheduled',
                venue: 'Rahway River Park',
                time: '13:00',
                format: '40 Overs',
                created_from_roster: true,
                created_at: Timestamp.now(),
                team1: [],
                team2: []
             });
             matchId = matchRef.id;
        } else {
             matchRef = doc(db, 'matches', matchId);
        }

        const updateData = {};
        if (role === '1') {
            // Preserve outgoing captain in roster
            if (match?.captain1Id && match.captain1Id !== playerId) {
                if (!newTeam1.includes(match.captain1Id)) newTeam1.push(match.captain1Id);
            }

            updateData.captain1Id = playerId;
            if (match?.captain2Id === playerId) updateData.captain2Id = null; // swap protection
            newTeam1.push(playerId); // Add to Team 1
        } else if (role === '2') {
             // Preserve outgoing captain in roster
            if (match?.captain2Id && match.captain2Id !== playerId) {
                if (!newTeam2.includes(match.captain2Id)) newTeam2.push(match.captain2Id);
            }

            updateData.captain2Id = playerId;
            if (match?.captain1Id === playerId) updateData.captain1Id = null; // swap protection
            newTeam2.push(playerId); // Add to Team 2
        } else {
            // Unset
            if (match?.captain1Id === playerId) updateData.captain1Id = null;
            if (match?.captain2Id === playerId) updateData.captain2Id = null;
        }

        // Attach teams to update
        updateData.team1 = newTeam1;
        updateData.team2 = newTeam2;

        await updateDoc(matchRef, updateData);
        
        setMatch(prev => {
            const base = prev || { 
                id: matchId, 
                date: selectedDate, 
                status: 'scheduled',
                team1: [],
                team2: [] 
            };
            return { ...base, ...updateData };
        });

    } catch (e) {
        console.error("Error setting captain:", e);
        alert("Failed to set captain");
    }
  };

  const handleAutoAssign = async () => {
    if (!availability.in || availability.in.length < 2) {
        alert("Not enough available players to assign captains.");
        return;
    }

    // Confirmation
    if (!window.confirm("Auto-assign captains based on round-robin availability? This will overwrite current captains.")) return;

    setCreatingMatch(true);
    try {
        // 1. Fetch ALL matches to determine usage history
        // Ideally we filter by current year/season but global history is better for fairness across seasons?
        // Let's stick to current "active" matches in DB.
        const matchesSnap = await getDocs(collection(db, 'matches'));
        const usageCount = {};

        matchesSnap.docs.forEach(d => {
            const m = d.data();
            if (m.captain1Id) usageCount[m.captain1Id] = (usageCount[m.captain1Id] || 0) + 1;
            if (m.captain2Id) usageCount[m.captain2Id] = (usageCount[m.captain2Id] || 0) + 1;
        });

        // 2. Filter Candidates (Available players)
        // We only consider those marked 'in'.
        // Sort by usage count ASC, then random shuffle for ties.
        const candidates = [...availability.in]
             .filter(u => u.id && u.role !== 'guest') // Exclude explicit guests if any (though logic uses user profiles)
             .map(u => ({ 
                 ...u, 
                 count: usageCount[u.id] || 0,
                 random: Math.random() 
             }))
             .sort((a, b) => {
                 if (a.count !== b.count) return a.count - b.count; // Prioritize least used
                 return a.random - b.random; // Randomize ties
             });

        if (candidates.length < 2) {
             alert("Not enough valid candidates (guests might be excluded).");
             return;
        }

        const c1 = candidates[0].id;
        const c2 = candidates[1].id;

        // 3. Update Match
        let matchId = match?.id;
        let matchRef;

        if (!matchId) {
             const newMatchRef = await addDoc(collection(db, 'matches'), {
                date: selectedDate,
                status: 'scheduled',
                venue: 'Rahway River Park',
                time: '13:00',
                format: '40 Overs',
                created_from_roster: true,
                created_at: Timestamp.now(),
                captain1Id: c1,
                captain2Id: c2,
                team1: [c1],
                team2: [c2]
             });
             matchId = newMatchRef.id;
             setMatch({ 
                 id: matchId, 
                 date: selectedDate, 
                 status: 'scheduled', 
                 venue: 'Rahway River Park',
                 time: '13:00',
                 format: '40 Overs',
                 captain1Id: c1, 
                 captain2Id: c2, 
                 team1: [c1], 
                 team2: [c2] 
            });
        } else {
             matchRef = doc(db, 'matches', matchId);
             await updateDoc(matchRef, {
                 captain1Id: c1,
                 captain2Id: c2,
                 team1: [c1],
                 team2: [c2]
             });
             setMatch(prev => ({ ...prev, captain1Id: c1, captain2Id: c2, team1: [c1], team2: [c2] }));
        }

    } catch (e) {
        console.error("Auto assign failed:", e);
        alert("Failed to auto-assign: " + e.message);
    } finally {
        setCreatingMatch(false);
    }
  };

  const handlePickPlayer = async (playerId, teamIdsArrayName) => {
    // teamIdsArrayName: 'team1' | 'team2'
    if (!match?.id) return;
    
    try {
        const matchRef = doc(db, 'matches', match.id);
        const currentData = match; // utilize local state for optimistic checking
        const currentTeam = currentData[teamIdsArrayName] || [];
        
        // Prevent duplicates
        if (currentTeam.includes(playerId)) return;
        
        // Remove from other team if switched
        const otherTeamName = teamIdsArrayName === 'team1' ? 'team2' : 'team1';
        let otherTeam = currentData[otherTeamName] || [];
        if (otherTeam.includes(playerId)) {
            otherTeam = otherTeam.filter(id => id !== playerId);
        }

        const newTeam = [...currentTeam, playerId];
        
        await updateDoc(matchRef, {
            [teamIdsArrayName]: newTeam,
            [otherTeamName]: otherTeam
        });
        
        setMatch(prev => ({
            ...prev,
            [teamIdsArrayName]: newTeam,
            [otherTeamName]: otherTeam
        }));
    } catch (e) {
        console.error("Error picking player:", e);
        alert("Failed to pick player");
    }
  };

  const handleRemovePlayer = async (playerId, teamIdsArrayName) => {
      if (!match?.id) return;
      try {
        const matchRef = doc(db, 'matches', match.id);
        const currentTeam = match[teamIdsArrayName] || [];
        const newTeam = currentTeam.filter(id => id !== playerId);
        
        await updateDoc(matchRef, {
            [teamIdsArrayName]: newTeam
        });
        
        setMatch(prev => ({
            ...prev,
            [teamIdsArrayName]: newTeam
        }));
      } catch (e) {
          console.error("Error removing player:", e);
      }
  }

  const handleShare = async () => {
    if (!shareCardRef.current || !match) return;
    setIsSharing(true);
    
    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = await html2canvas(shareCardRef.current, {
            backgroundColor: '#0f172a',
            scale: 2,
            useCORS: true,
            logging: false
        });
        
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            
            const fileName = `RCC-Match-${selectedDate}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });
            
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'RCC Match Roster',
                        text: `Match roster for ${selectedDate}` 
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') console.error("Share failed", err);
                }
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
            setIsSharing(false);
        }, 'image/png');
        
    } catch (e) {
        console.error("Error generating share image:", e);
        alert("Failed to generate share image");
        setIsSharing(false);
    }
  };

  // --- Derived State for Teams ---

  // Availability Split: First 24 PLAYERS (Members Only) are Pool, Rest are Waitlist
  // Guests are ALWAYS in Guest Pool (visually separate) but considered "Playable/Selectable"
  
  const allInPlayers = availability?.in || [];
  const MAX_MEMBERS = 24;
  
  let memberHeadcount = 0;
  
  const poolMembers = [];
  const waitListMembers = [];
  const allGuests = []; // All guests go here
  const allGuestObjects = {};

  for (const player of allInPlayers) {
     // 1. Member Processing (Strict FIFO)
     const isMemberWaitlisted = memberHeadcount >= MAX_MEMBERS;
     
     if (!isMemberWaitlisted) {
         poolMembers.push(player);
         memberHeadcount++;
     } else {
         waitListMembers.push(player);
     }

     // 2. Guest Processing - Always add to guest pool
     const pGuestCount = player.guests || 0;
     const pGuestNames = player.guestNames || [];

     for (let i = 0; i < pGuestCount; i++) {
         const gName = pGuestNames[i] || `Guest ${i+1}`;
         const gId = `guest_${player.id}_${i}`;
         const gObj = {
             id: gId,
             name: gName, 
             displayName: `${gName} (Guest of ${player.name.split(' ')[0]})`, 
             role: 'guest',
             hostId: player.id,
             isGuest: true,
             guests: 0
         };
         allGuestObjects[gId] = gObj;
         allGuests.push(gObj);
     }
  }

  // Playable Pool used for Common Player Logic & Selection Context
  // Includes Top 24 Members AND All Guests
  const playablePool = [...poolMembers, ...allGuests];

  // Common Player Logic: If Odd number of playable players, last one is common
  const commonPlayerId = useMemo(() => {
     if (playablePool.length > 0 && playablePool.length % 2 !== 0) {
        return playablePool[playablePool.length - 1].id;
     }
     return null;
  }, [playablePool]);

  // Ensure Captains are always in their respective teams and not in the other
  const team1Ids = useMemo(() => {
      const ids = new Set(match?.team1 || []);
      if (match?.captain1Id) ids.add(match.captain1Id);
      if (match?.captain2Id) ids.delete(match.captain2Id);
      if (commonPlayerId) ids.add(commonPlayerId); // Auto-add common player
      return Array.from(ids);
  }, [match?.team1, match?.captain1Id, match?.captain2Id, commonPlayerId]);

  const team2Ids = useMemo(() => {
      const ids = new Set(match?.team2 || []);
      if (match?.captain2Id) ids.add(match.captain2Id);
      if (match?.captain1Id) ids.delete(match.captain1Id);
      if (commonPlayerId) ids.add(commonPlayerId); // Auto-add common player
      return Array.from(ids);
  }, [match?.team2, match?.captain1Id, match?.captain2Id, commonPlayerId]);

  // Players in Roster (Pool) but NOT in a team yet
  // Common player is technically "picked" for both, so they shouldn't show in pool
  const unpickedMembers = poolMembers.filter(u => !team1Ids.includes(u.id) && !team2Ids.includes(u.id) && u.id !== commonPlayerId);
  const unpickedGuests = allGuests.filter(u => !team1Ids.includes(u.id) && !team2Ids.includes(u.id) && u.id !== commonPlayerId);

  // Waitlist Players (excluding those who managed to get picked e.g. as Captains - keeping logic robust)
  const waitListPlayers = waitListMembers.filter(u => !team1Ids.includes(u.id) && !team2Ids.includes(u.id));

  // Hydrated Team Lists (IDs -> User Objects)
  const getPlayerDetails = (id) => {
      // Look in all sources including Guest Objects and raw In list and raw Members list
      const foundInMembers = poolMembers.find(u => u.id === id) || waitListMembers.find(u => u.id === id);
      const foundInStore = (availability?.in || []).find(u => u.id === id);
      return foundInMembers || foundInStore || allGuestObjects[id] || { id, name: 'Guest/Unknown', role: 'guest' };
  };

  const team1Players = team1Ids.map(getPlayerDetails);
  const team2Players = team2Ids.map(getPlayerDetails);

  // Identity Checks
  const isCaptain1 = user?.uid === match?.captain1Id;
  const isCaptain2 = user?.uid === match?.captain2Id;
  const canPickTeam1 = isAdmin || isCaptain1;
  const canPickTeam2 = isAdmin || isCaptain2;
  
  // Is the current user marked as 'in' for this date?
  const isUserIn = (availability?.in || []).some(u => u.id === user?.uid);

  // Reset guest count when date changes or availability loads
  const myStatusObj = useMemo(() => availability.in.find(u => u.id === user.uid), [availability, user.uid]);
  
  // Set initial guest count from established status
  // We use useMemo/useEffect to sync local state with fetched data without infinite loops
  // A simple way is to default state, but ideally we want to show saved guest count
  useMemo(() => {
    if (myStatusObj) {
      setGuestCount(myStatusObj.guests || 0);
    } else {
      setGuestCount(0);
    }
  }, [myStatusObj?.guests, selectedDate]); // Reset when date changes or saved guests change

  const groupedByMonth = useMemo(() => groupByMonth(weekendDates), [weekendDates]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-navy-950 pb-20 font-display">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy-950/80 backdrop-blur-md border-b border-navy-800/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="/rcc-logo.svg" alt="Logo" className="w-10 h-10 drop-shadow-lg" />
             <div className="hidden md:block">
               <h1 className="text-navy-100 font-bold text-lg leading-tight tracking-tight">RCC Inside Edge</h1>
               <p className="text-navy-100/50 text-[10px] uppercase tracking-widest font-semibold">Season {year}</p>
             </div>
          </div>

          <div className="flex bg-navy-900 p-1 rounded-lg border border-navy-800 mx-2">
             <button onClick={() => { setViewMode('calendar'); onRefresh && onRefresh(); }} className={`p-1.5 md:px-3 md:py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'calendar' ? 'bg-navy-800 text-white shadow' : 'text-navy-100/50 hover:text-navy-100'}`}>
                <LayoutGrid size={14} /> <span className="hidden sm:inline">Calendar</span>
             </button>
             <button onClick={() => setViewMode('roster')} className={`p-1.5 md:px-3 md:py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'roster' ? 'bg-navy-800 text-white shadow' : 'text-navy-100/50 hover:text-navy-100'}`}>
                <Table size={14} /> <span className="hidden sm:inline">Roster</span>
             </button>
             <button onClick={() => { setViewMode('matches'); onRefresh && onRefresh(); }} className={`p-1.5 md:px-3 md:py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'matches' ? 'bg-navy-800 text-white shadow' : 'text-navy-100/50 hover:text-navy-100'}`}>
                <Swords size={14} /> <span className="hidden sm:inline">Matches</span>
             </button>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-2 px-3 py-1.5 bg-cricket-gold/10 text-cricket-gold rounded-full border border-cricket-gold/20 hover:bg-cricket-gold/20 transition-colors font-bold text-xs uppercase tracking-wider"
              >
                <Shield size={14} />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-navy-100">{user.name}</p>
                <p className="text-xs text-navy-100/50">{user.email}</p>
              </div>
              <button 
                onClick={onSignOut}
                className="p-2 text-navy-100/50 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {viewMode === 'roster' ? (
           <div className="lg:col-span-12">
             <ConsolidatedRoster year={year} dates={weekendDates} users={users} isAdmin={isAdmin} />
           </div>
        ) : viewMode === 'matches' ? (
           <div className="lg:col-span-12">
             <MatchesList isAdmin={isAdmin} user={user} users={users} />
           </div>
        ) : (
          <>
        {/* Calendar Grid (Left Column) */}
        <section className="lg:col-span-12 space-y-8 order-2">
           <div className="flex items-center justify-between">
             <div>
               <h2 className="text-2xl font-bold text-navy-100 tracking-tight">Season Calendar</h2>
               <p className="text-navy-100/60 text-sm mt-1">Select dates to manage availability</p>
             </div>
             
             {/* Legend */}
             <div className="flex items-center gap-4 text-xs text-navy-100/50 font-medium">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> Holiday
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-cricket-gold shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> Selected
               </div>
             </div>
           </div>

           <motion.div 
             variants={container}
             initial="hidden"
             animate="show"
             className="grid grid-cols-1 gap-6"
           >
             {Object.keys(groupedByMonth).length === 0 && (
               <div className="text-center py-20 bg-navy-900/30 rounded-2xl border border-dashed border-navy-800">
                 <CalendarIcon className="w-8 h-8 text-navy-100/20 mx-auto mb-2" />
                 <p className="text-navy-100/50">No dates loaded for {year}</p>
               </div>
             )}

             {Object.entries(groupedByMonth).map(([month, dates]) => (
               <motion.div 
                 key={month} 
                 variants={item}
                 className="bg-navy-900 border border-navy-800/50 rounded-2xl overflow-hidden backdrop-blur-sm shadow-sm"
               >
                 <div className="bg-navy-800/30 px-6 py-4 border-b border-navy-800/50 flex justify-between items-center backdrop-blur-lg">
                   <h3 className="font-bold text-navy-100 text-lg">{month}</h3>
                   <span className="text-[10px] uppercase font-bold tracking-wider bg-navy-950/50 border border-navy-800 px-2 py-1 rounded text-navy-100/50">{dates.length} days</span>
                 </div>
                 <div className="p-6">
                   <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                     {dates.map((dateStr) => {
                       const isSelected = selectedDate === dateStr;
                       const holidayName = holidays[dateStr];
                       
                       return (
                         <motion.button
                           whileHover={{ scale: 1.05 }}
                           whileTap={{ scale: 0.95 }}
                           key={dateStr}
                           onClick={() => setSelectedDate(dateStr)}
                           className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 h-20 ${
                             isSelected 
                               ? 'bg-gradient-to-br from-cricket-gold to-yellow-600 border-yellow-400 text-white shadow-lg shadow-cricket-gold/20 z-10' 
                               : holidayName
                                 ? 'bg-red-900/10 border-red-500/30 hover:border-red-500/50 hover:bg-red-900/20'
                                 : 'bg-navy-800/30 border-navy-700/30 hover:border-navy-500 hover:bg-navy-800/60 text-navy-100'
                           }`}
                         >
                           <span className={`text-[10px] font-bold uppercase mb-0.5 tracking-wider ${isSelected ? 'text-white/80' : 'text-navy-100/50'}`}>
                             {parseLocalDate(dateStr).toLocaleDateString(undefined, { weekday: 'short' })}
                           </span>
                           <span className={`text-xl font-bold ${isSelected ? 'text-white' : holidayName ? 'text-red-400' : 'text-navy-100'}`}>
                             {dateStr.split('-')[2]}
                           </span>
                           {holidayName && (
                             <div className="absolute top-1.5 right-1.5">
                               <span className="relative flex h-2 w-2">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                               </span>
                             </div>
                           )}
                         </motion.button>
                       );
                     })}
                   </div>
                 </div>
               </motion.div>
             ))}
           </motion.div>
        </section>

        {/* Details Sidebar (Right Column) */}
        <aside className="lg:col-span-12 space-y-6 order-1">
          <AnimatePresence mode="wait">
            {selectedDate ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="bg-navy-900 border border-navy-800 rounded-[2rem] p-6 shadow-xl"
              >
                <div className="mb-8 p-4 bg-navy-950/50 rounded-2xl border border-navy-800/50">
                  <p className="text-navy-100/50 text-[10px] uppercase font-bold tracking-widest mb-2">Selected Date</p>
                  <h2 className="text-3xl font-bold text-navy-100 mb-2">{formatDayLabel(selectedDate)}</h2>
                  {holidays[selectedDate] && (
                     <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                       <Info size={12} />
                       {holidays[selectedDate]}
                     </div>
                  )}
                </div>

                {/* Match Details / Admin Actions */}
                <div className="mb-6">
                  {match ? (
                    <div className="bg-navy-800/50 rounded-xl border border-navy-700/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-navy-100 flex items-center gap-2">
                           <Swords size={16} className="text-cricket-gold" />
                           {match?.opponent ? `vs ${match.opponent}` : 'Match Day'}
                        </h3>
                        {isAdmin && (
                            <button 
                                onClick={handleAutoAssign}
                                className="p-1.5 rounded-lg bg-navy-900 text-cricket-gold border border-navy-700 hover:border-cricket-gold hover:bg-cricket-gold/10 transition-colors"
                                title="Auto-Assign Captains (Round Robin)"
                                disabled={creatingMatch}
                            >
                                {creatingMatch ? <div className="w-4 h-4 rounded-full border-2 border-cricket-gold border-t-transparent animate-spin" /> : <Wand2 size={14} />}
                            </button>
                        )}
                        {match && (
                           <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${match.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-navy-900 text-navy-100/50'}`}>
                              {match.status}
                           </span>
                        )}
                      </div>
                      <div className="text-xs text-navy-100/60 space-y-1">
                         <p>📍 {match?.venue || 'Rahway River Park'}</p>
                         <p>⏰ {match?.time || '13:00'} • {match?.format || '40 Overs'}</p>
                      </div>


                      {(match?.captain1Id || match?.captain2Id) && (
                         <div className="flex gap-2 pt-2 border-t border-navy-700/50">
                            {match.captain1Id && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-cricket-gold/10 rounded border border-cricket-gold/20">
                                   <span className="w-4 h-4 rounded-full bg-cricket-gold text-navy-900 text-[9px] font-bold flex items-center justify-center">C1</span>
                                   <span className="text-[10px] text-cricket-gold font-bold">
                                       {users.find(u => u.id === match.captain1Id)?.name || 'C1'}
                                   </span>
                                </div>
                            )}
                            {match.captain2Id && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-cricket-gold/10 rounded border border-cricket-gold/20">
                                   <span className="w-4 h-4 rounded-full bg-cricket-gold text-navy-900 text-[9px] font-bold flex items-center justify-center">C2</span>
                                   <span className="text-[10px] text-cricket-gold font-bold">
                                       {users.find(u => u.id === match.captain2Id)?.name || 'C2'}
                                   </span>
                                </div>
                            )}
                         </div>
                      )}
                      
                      {isAdmin && match && (
                          <div className="grid grid-cols-2 gap-2">
                             <button
                                 onClick={handleShare}
                                 disabled={isSharing}
                                 className="w-full py-2 bg-navy-800 text-cricket-gold hover:bg-navy-700 rounded-lg text-xs font-bold border border-navy-700 transition-colors flex items-center justify-center gap-2"
                             >
                                 {isSharing ? <div className="w-3 h-3 rounded-full border-2 border-cricket-gold border-t-transparent animate-spin"/> : <Share2 size={12} />}
                                 Publish
                             </button>
                             <button 
                                  onClick={handleStartMatch}
                                  className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                                      match.status === 'active' 
                                      ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                                      : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                                  }`}
                              >
                                  {match.status === 'active' ? 'End Match' : <> <Play size={12} fill="currentColor" /> Start Match </>}
                              </button>
                          </div>
                      )}
                      
                      {isAdmin && !match && (
                          <button 
                                onClick={() => setIsMatchModalOpen(true)}
                                className="w-full py-2 bg-navy-800 text-navy-100 hover:bg-navy-700 rounded-lg text-xs font-bold border border-navy-700 transition-colors"                            
                            >
                                Configure Match
                          </button>
                      )}
                    </div>
                  ) : (
                    isAdmin && (
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setIsMatchModalOpen(true)}
                                className="w-full py-3 border border-dashed border-navy-700 rounded-xl flex items-center justify-center gap-2 text-navy-100/50 hover:bg-navy-800/50 hover:text-cricket-gold hover:border-cricket-gold/30 transition-all group"
                            >
                                <div className="p-1 rounded-full bg-navy-800 group-hover:bg-cricket-gold/20 transition-colors">
                                    <Plus size={16} />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Create Match</span>
                            </button>
                            {availability.in.length > 2 && (
                                <button 
                                    onClick={handleAutoAssign}
                                    className="w-full py-2 bg-navy-800 text-cricket-gold hover:bg-navy-700 rounded-lg text-xs font-bold border border-navy-700 transition-colors flex items-center justify-center gap-2"                            
                                    title="Auto-Assign Captains for Round Robin"
                                >
                                    {creatingMatch ? <div className="w-4 h-4 rounded-full border-2 border-cricket-gold border-t-transparent animate-spin" /> : <Wand2 size={14} />}
                                    {creatingMatch ? 'Assigning...' : 'Auto-Assign Captains'}
                                </button>
                            )}
                            
                            {(availability.in.length > 0 || availability.out.length > 0) && (
                                <button 
                                    onClick={onResetPool}
                                    className="w-full py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold border border-red-500/20 transition-colors flex items-center justify-center gap-2 mt-2"
                                    title="Clear all availability responses for this date"
                                >
                                    <Trash2 size={14} />
                                    Reset Pool
                                </button>
                            )}
                        </div>
                    )
                  )}
                </div>

                {/* Status Actions */}
                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-3">
                    {!isUserIn && (
                    <button
                      disabled={loading}
                      onClick={() => onSetStatus('in', guestCount)}
                      className="relative overflow-hidden flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-navy-800 hover:bg-green-100 border border-navy-700 hover:border-green-500 transition-all group active:scale-95"
                    >
                      <CheckCircle2 className="w-8 h-8 text-navy-200 group-hover:text-green-600 transition-colors" />
                      <span className="text-sm font-bold text-navy-100 group-hover:text-green-700">I'm In</span>
                      <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    )}
                    <button
                      disabled={loading}
                      onClick={() => onSetStatus('out')}
                      className={`relative overflow-hidden flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-navy-800 hover:bg-red-100 border border-navy-700 hover:border-red-500 transition-all group active:scale-95 ${isUserIn ? 'col-span-2' : ''}`}
                    >
                      <XCircle className="w-8 h-8 text-navy-200 group-hover:text-red-500 transition-colors" />
                      <span className="text-sm font-bold text-navy-100 group-hover:text-red-700">Can't Make It</span>
                      <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                  
                  {/* Guest Selection */}
                  <div className="bg-navy-800/50 p-4 rounded-xl border border-navy-700/50 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-navy-100/70">
                      <Users size={16} />
                      <span className="text-sm font-medium">Bringing Guests to game?</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 w-full">
                      {[0, 1, 2, 3, 4, 5].map(num => (
                        <button
                          key={num}
                          onClick={() => handleGuestClick(num)}
                          className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                            guestCount === num 
                              ? 'bg-navy-100 text-navy-900 shadow-lg' 
                              : 'bg-navy-900 text-navy-100/50 hover:bg-navy-800'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {statusMessage && (
                   <div className="mb-6 text-center text-xs font-medium text-cricket-gold bg-yellow-500/10 py-3 rounded-xl border border-yellow-500/10 animate-pulse">
                     {statusMessage}
                   </div>
                )}

                {/* Rosters */}
                <div className="space-y-6">
                  
                  {/* Team Selection UI (Only if match exists and at least one captain assigned) */}
                  {(match?.captain1Id || match?.captain2Id) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Team 1: Spartans */}
                          <div className={`space-y-3 p-4 rounded-xl border ${isCaptain1 ? 'bg-red-900/10 border-red-500/30' : 'bg-navy-900/50 border-navy-800'}`}>
                             <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                                  <Swords size={14} />
                                  RCC Spartans
                                </h4>
                                <span className="text-[10px] font-mono font-bold bg-navy-950 px-2 py-0.5 rounded text-red-200">{team1Players.length}</span>
                             </div>
                             <div className="flex flex-wrap gap-2 min-h-[50px]">
                                {team1Players.length === 0 && <p className="text-navy-100/20 text-xs italic w-full text-center py-2">No players picked.</p>}
                                {team1Players.map(u => {
                                    const isCommon = u.id === commonPlayerId;
                                    return (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={u.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isCommon ? 'bg-purple-500/10 border-purple-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                       <div 
                                            onClick={(e) => {
                                                if (!isAdmin) return;
                                                e.stopPropagation();
                                                if (match.captain1Id === u.id) {
                                                    handleSetCaptain(u.id, '2'); 
                                                } else {
                                                    handleSetCaptain(u.id, '1');
                                                }
                                            }}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCommon ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'} ${isAdmin ? 'cursor-pointer hover:scale-110 hover:bg-red-500 hover:text-white' : ''}`}
                                            title={isAdmin ? (match.captain1Id === u.id ? "Switch to Blue Captain" : "Promote to Red Captain") : ""}
                                       >
                                         {match.captain1Id === u.id ? 'C1' : u.name.charAt(0)}
                                       </div>
                                       <span className={`text-xs font-bold ${isCommon ? 'text-purple-400' : 'text-red-400'}`}>
                                           {u.displayName || u.name}
                                           {isCommon && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded uppercase">Common</span>}
                                       </span>
                                       {u.guests > 0 && <span className={`ml-1 text-[10px] px-1.5 rounded-full font-bold ${isCommon ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'}`}>+{u.guests}</span>}
                                       
                                       {canPickTeam1 && u.id !== match.captain1Id && !isCommon && (
                                           <button 
                                             onClick={() => handleRemovePlayer(u.id, 'team1')}
                                             className="ml-auto w-5 h-5 rounded flex items-center justify-center text-navy-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                           >
                                             <Minus size={12} />
                                           </button>
                                       )}
                                    </motion.div>
                                )})}
                             </div>
                          </div>

                          {/* Team 2: Warriors */}
                          <div className={`space-y-3 p-4 rounded-xl border ${isCaptain2 ? 'bg-blue-900/10 border-blue-500/30' : 'bg-navy-900/50 border-navy-800'}`}>
                             <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                  <Shield size={14} />
                                  RCC Warriors
                                </h4>
                                <span className="text-[10px] font-mono font-bold bg-navy-950 px-2 py-0.5 rounded text-blue-200">{team2Players.length}</span>
                             </div>
                             <div className="flex flex-wrap gap-2 min-h-[50px]">
                                {team2Players.length === 0 && <p className="text-navy-100/20 text-xs italic w-full text-center py-2">No players picked.</p>}
                                {team2Players.map(u => {
                                    const isCommon = u.id === commonPlayerId;
                                    return (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={u.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isCommon ? 'bg-purple-500/10 border-purple-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                                       <div 
                                            onClick={(e) => {
                                                if (!isAdmin) return;
                                                e.stopPropagation();
                                                if (match.captain2Id === u.id) {
                                                    handleSetCaptain(u.id, null); 
                                                } else {
                                                    handleSetCaptain(u.id, '2');
                                                }
                                            }}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCommon ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'} ${isAdmin ? 'cursor-pointer hover:scale-110 hover:bg-blue-500 hover:text-white' : ''}`}
                                            title={isAdmin ? (match.captain2Id === u.id ? "Unassign Captain" : "Promote to Blue Captain") : ""}
                                       >
                                         {match.captain2Id === u.id ? 'C2' : u.name.charAt(0)}
                                       </div>
                                       <span className={`text-xs font-bold ${isCommon ? 'text-purple-400' : 'text-blue-400'}`}>
                                           {u.displayName || u.name}
                                           {isCommon && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-400 px-1 rounded uppercase">Common</span>}
                                       </span>
                                       {u.guests > 0 && <span className={`ml-1 text-[10px] px-1.5 rounded-full font-bold ${isCommon ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>+{u.guests}</span>}
                                       
                                       {canPickTeam2 && u.id !== match.captain2Id && !isCommon && (
                                           <button 
                                             onClick={() => handleRemovePlayer(u.id, 'team2')}
                                             className="ml-auto w-5 h-5 rounded flex items-center justify-center text-navy-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                           >
                                             <Minus size={12} />
                                           </button>
                                       )}
                                    </motion.div>
                                )})}
                             </div>
                          </div>
                      </div>
                  )}

                  {/* Available / Pool (Members) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Available Pool
                      </h4>
                      <span className="text-[10px] font-mono font-bold bg-navy-800 px-2 py-0.5 rounded text-navy-100/50">{unpickedMembers.length}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {unpickedMembers.length === 0 && <p className="text-navy-100/20 text-xs italic px-2">No available members.</p>}
                      {unpickedMembers.map(u => {
                        const isC1 = match?.captain1Id === u.id;
                        const isC2 = match?.captain2Id === u.id;
                        
                        return (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={u.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isC1 ? 'bg-red-500/10 border-red-500/50 shadow-sm' : isC2 ? 'bg-blue-500/10 border-blue-500/50 shadow-sm' : 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'}`}>
                           {/* Avatar / Captain Cycle */}
                           <div 
                               onClick={(e) => {
                                   if (!isAdmin) return;
                                   e.stopPropagation();
                                   if (isC1) handleSetCaptain(u.id, '2'); // Red -> Blue
                                   else if (isC2) handleSetCaptain(u.id, null); // Blue -> None
                                   else handleSetCaptain(u.id, '1'); // None -> Red
                               }}
                               className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isAdmin ? 'cursor-pointer hover:scale-110' : ''} ${isC1 ? 'bg-red-500 text-white' : isC2 ? 'bg-blue-500 text-white' : 'bg-green-500/20 text-green-400'}`}
                               title={isAdmin ? "Click to cycle: Red Captain -> Blue Captain -> None" : ""}
                           >
                             {isC1 ? 'R' : isC2 ? 'B' : u.name.charAt(0)}
                           </div>
                           
                           <span className={`text-xs font-medium ${isC1 ? 'text-red-400' : isC2 ? 'text-blue-400' : 'text-navy-100'}`}>{u.name}</span>
                           {u.guests > 0 && (
                             <span className="ml-1 text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded-full font-bold">+{u.guests}</span>
                           )}

                           {/* Captain Picking Actions */}
                           {(canPickTeam1 || canPickTeam2) && !isC1 && !isC2 && (
                               <div className="flex ml-2 gap-1 pl-2 border-l border-navy-700/50">
                                   {canPickTeam1 && (
                                       <button 
                                         onClick={() => handlePickPlayer(u.id, 'team1')}
                                         className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                         title="Add to Spartans"
                                       >
                                         <Plus size={12} />
                                       </button>
                                   )}
                                   {canPickTeam2 && (
                                       <button 
                                         onClick={() => handlePickPlayer(u.id, 'team2')}
                                         className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                         title="Add to Warriors"
                                       >
                                         <Plus size={12} />
                                       </button>
                                   )}
                               </div>
                           )}
                        </motion.div>
                      )})}
                    </div>
                  </div>

                  <div className="h-px bg-navy-800/50" />

                  {/* Guest Pool */}
                  {unpickedGuests.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                             Guest Pool
                          </h4>
                          <span className="text-[10px] font-mono font-bold bg-navy-800 px-2 py-0.5 rounded text-navy-100/50">{unpickedGuests.length}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                           {unpickedGuests.map(u => (
                             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-teal-500/10 border-teal-500/20">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-teal-500/20 text-teal-400">G</div>
                                <span className="text-xs font-medium text-teal-400">{u.displayName || u.name}</span>
                                
                                {(canPickTeam1 || canPickTeam2) && (
                                   <div className="flex ml-2 gap-1 pl-2 border-l border-navy-700/50">
                                       {canPickTeam1 && (
                                           <button 
                                             onClick={() => handlePickPlayer(u.id, 'team1')}
                                             className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                             title="Add to Spartans"
                                           >
                                             <Plus size={12} />
                                           </button>
                                       )}
                                       {canPickTeam2 && (
                                           <button 
                                             onClick={() => handlePickPlayer(u.id, 'team2')}
                                             className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                             title="Add to Warriors"
                                           >
                                             <Plus size={12} />
                                           </button>
                                       )}
                                   </div>
                                )}
                             </motion.div>
                           ))}
                        </div>
                      </div>
                  )}

                  <div className="h-px bg-navy-800/50" />

                  {/* Waiting List */}
                  {waitListPlayers.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-2">
                            <Clock size={14} className="text-yellow-600" />
                            Waiting List
                          </h4>
                          <span className="text-[10px] font-mono font-bold bg-navy-800 px-2 py-0.5 rounded text-navy-100/50">{waitListPlayers.length}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {waitListPlayers.map((u, i) => (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-yellow-900/10 border-yellow-700/30">
                               <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-yellow-700/20 text-yellow-600">
                                 {i + 1}
                               </div>
                               <span className="text-xs font-medium text-yellow-600">{u.displayName || u.name}</span>

                               {(canPickTeam1 || canPickTeam2) && (
                                   <div className="flex ml-2 gap-1 pl-2 border-l border-yellow-700/30">
                                       {canPickTeam1 && (
                                           <button 
                                             onClick={() => handlePickPlayer(u.id, 'team1')}
                                             className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                             title="Add to Spartans"
                                           >
                                             <Plus size={12} />
                                           </button>
                                       )}
                                       {canPickTeam2 && (
                                           <button 
                                             onClick={() => handlePickPlayer(u.id, 'team2')}
                                             className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                             title="Add to Warriors"
                                           >
                                             <Plus size={12} />
                                           </button>
                                       )}
                                   </div>
                               )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                  )}

                  {waitListPlayers.length > 0 && <div className="h-px bg-navy-800/50" />}

                  {/* OUT */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        Unavailable
                      </h4>
                      <span className="text-[10px] font-mono font-bold bg-navy-800 px-2 py-0.5 rounded text-navy-100/50">{availability.out.length}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {availability.out.length === 0 && <p className="text-navy-100/20 text-xs italic px-2">List is empty.</p>}
                      {availability.out.map(u => (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/5 border border-red-500/10 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-default">
                           <span className="text-xs text-red-200 line-through decoration-red-500/50">{u.name}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-navy-900/30 rounded-[2rem] p-10 text-center border-2 border-navy-800 border-dashed"
              >
                <div className="w-16 h-16 bg-navy-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-navy-700/50">
                  <ChevronRight className="text-navy-100/20" />
                </div>
                <h3 className="text-white font-medium mb-1">Select a Weekend</h3>
                <p className="text-navy-100/50 text-sm">Pick a date from the calendar to view the roster and set your status.</p>
              </motion.div>
            )}
          </AnimatePresence>


        </aside>
        </>
        )}
      </main>

      <GuestNameModal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        onSubmit={handleGuestSubmit}
        count={pendingGuestCount}
        currentNames={myStatusObj?.guestNames || []}
      />

      <CreateMatchModal 
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        date={selectedDate}
        onCreate={handleCreateMatch}
        saving={creatingMatch}
      />

      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {match && (
            <MatchShareCard 
                ref={shareCardRef}
                team1={team1Players}
                team2={team2Players}
                matchDetails={{
                    date: selectedDate,
                    venue: match.venue,
                    time: match.time,
                    captain1Name: users.find(u => u.id === match.captain1Id)?.name,
                    captain2Name: users.find(u => u.id === match.captain2Id)?.name
                }}
            />
        )}
      </div>
    </div>
  );
}

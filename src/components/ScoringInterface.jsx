import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Undo2, RotateCcw, Trophy } from 'lucide-react';
import { doc, updateDoc, arrayUnion, increment, deleteField } from 'firebase/firestore'; 
import { db } from '../firebase';

export default function ScoringInterface({ isOpen, match, users, onClose, onUpdateLocal }) {
  // 1. Hooks (Always Call First)
  const [loading, setLoading] = useState(false);
  
  // Modals for Wicket/Over
  const [showWicketDetailsModal, setShowWicketDetailsModal] = useState(false);
  const [wicketDetails, setWicketDetails] = useState({ type: 'Bowled', fielder: '', who: '' }); // type, fielder, who
  const [showNewBatsmanModal, setShowNewBatsmanModal] = useState(false);
  const [showNewBowlerModal, setShowNewBowlerModal] = useState(false);
  const [selectedNewPlayer, setSelectedNewPlayer] = useState(''); // For both modals
  const [wicketData, setWicketData] = useState(null); // To store wicket context if needed
  const [activeExtraType, setActiveExtraType] = useState(null); // 'wd' or 'nb'

  // 2. Early Return only AFTER hooks
  if (!isOpen || !match || !match.scoring) return null;

  const { scoring } = match;

  // Derived Values
  const getPlayers = (ids) => {
      return (ids || []).map(id => {
          const u = users?.find(user => user.uid === id || user.id === id);
          return u ? { id, name: u.name } : { id, name: 'Unknown' };
      });
  };

  // Need to ensure we use correct teams. Scoring object has battingTeam: 'team1'
  const isTeam1Batting = scoring.battingTeam === 'team1';
  
  const currentBattingSquad = isTeam1Batting ? match.team1 : match.team2;
  const currentBowlingSquad = isTeam1Batting ? match.team2 : match.team1;

  const getName = (id) => users?.find(u => u.uid === id || u.id === id)?.name || 'Unknown';



  const handleScoreUpdate = async (runs, isExtra = false, extraType = null, isWicket = false, wicketInfo = null) => {
      if (loading) return;
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          let strikerId = scoring.strikerId;
          let nonStrikerId = scoring.nonStrikerId;
          
          // Override who is out if specified in wicketInfo (e.g. Run Out Non-Striker)
          // Default logic assumes Striker is out.
          let outBatsmanId = strikerId;
          if (isWicket && wicketInfo && wicketInfo.who) {
              outBatsmanId = wicketInfo.who;
          }
          
          const bowlerId = scoring.currentBowlerId;
          
          let totalRunsAdd = runs;
          let legalBall = true;
          let ballsFacedAdd = 1;

          if (isExtra) {
             if (extraType === 'wd' || extraType === 'nb') {
                 totalRunsAdd = 1 + runs;
                 if (extraType === 'wd') ballsFacedAdd = 0; // Wide not count as ball faced
                 // NB counts as ball faced but NOT as legal ball for over
                 legalBall = false;
             } else if (extraType === 'b' || extraType === 'lb') {
                 totalRunsAdd = runs;
                 ballsFacedAdd = 1;
                 legalBall = true;
             }
          }
          
          // Construct updates
          const updates = {};
          
          // 1. Total Score
          updates['scoring.totalRuns'] = increment(totalRunsAdd);
          
          const ballText = isWicket ? 'W' : 
                           (isExtra ? `${runs > 0 ? runs : ''}${extraType.toUpperCase()}` : 
                           (runs === 0 ? '0' : runs.toString()));

          updates['scoring.thisOver'] = arrayUnion(ballText);

          // 2. Strike Rotation (Odd runs)
          // Run based rotation
          if (runs % 2 !== 0) {
              // Swap logic: update keys in DB.
               updates['scoring.strikerId'] = nonStrikerId;
               updates['scoring.nonStrikerId'] = strikerId;
          }
          
          // 3. Batsman Stats (Attrib to Striker)
          
          if (extraType !== 'wd' && extraType !== 'b' && extraType !== 'lb') {
               // Runs logic: If NB, runs count to batsman. Byes/LegByes do NOT.
               updates[`scoring.batsmenStats.${strikerId}.runs`] = increment(runs);
               
               if (runs === 4) updates[`scoring.batsmenStats.${strikerId}.fours`] = increment(1);
               if (runs === 6) updates[`scoring.batsmenStats.${strikerId}.sixes`] = increment(1);
          }
          
          // Always increment balls faced for striker unless it's a Wide
          if (extraType !== 'wd') {
              updates[`scoring.batsmenStats.${strikerId}.balls`] = increment(ballsFacedAdd);
          }

          // 4. Bowler Stats
          // Standard rules: Byes and Leg Byes are NOT charged to the bowler
          const chargedToBowler = (extraType === 'b' || extraType === 'lb') ? 0 : totalRunsAdd;
          updates[`scoring.bowlerStats.${bowlerId}.runs`] = increment(chargedToBowler);
          if (legalBall) {
              updates[`scoring.bowlerStats.${bowlerId}.balls`] = increment(1);
          }
          if (isWicket) {
              updates['scoring.totalWickets'] = increment(1);
              updates[`scoring.bowlerStats.${bowlerId}.wickets`] = increment(1);
              
              // Store Wicket Details if provided
              if (wicketInfo) {
                  updates[`scoring.batsmenStats.${outBatsmanId}.wicketInfo`] = {
                      type: wicketInfo.type,
                      bowlerId: bowlerId,
                      fielderId: wicketInfo.fielder || null,
                      over: scoring.totalOvers || 0,
                      ball: currentOverBalls + 1
                  };
              }
          }

          await updateDoc(matchRef, updates);

          // --- Post Update Logic (Wicket / End of Over) ---
          
          // Prepare optimistic data for check
          // Updated: Uses local nextBall logic rather than stale 'scoring' state
          const currentBowlerStats = scoring.bowlerStats?.[bowlerId] || { balls: 0, runs: 0, wickets: 0 };
          const nextBallCount = currentBowlerStats.balls + (legalBall ? 1 : 0);
          const isOverEnd = legalBall && (nextBallCount % 6 === 0) && (nextBallCount > 0);

          if (isWicket) {
               // Wicket Logic: Open New Batsman Modal
               setWicketData({ 
                   outBatsman: outBatsmanId,
                   details: wicketInfo 
               }); 
               
               setShowNewBatsmanModal(true);
          } else if (isOverEnd) {
               // Over End Logic: 
               // 1. Swap Ends (Striker <-> NonStriker) - Just UI or DB?
               // Ideally DB.
               // Note: We already updated 'scoring.strikerId' above based on runs.
               // Now we swap AGAIN for end of over.
               // We need a separate update or include it in previous?
               // We can't easily chain updates in one go if logic depends on prev state being odd/even.
               // But we know 'runs'.
               
               // Logic:
               // Current Striker/NonStriker after run rotation:
               const currentS = runs % 2 !== 0 ? nonStrikerId : strikerId;
               const currentNS = runs % 2 !== 0 ? strikerId : nonStrikerId;
               
               // End of over swap:
               const nextS = currentNS;
               const nextNS = currentS;
               
               const overEndUpdates = {
                   'scoring.strikerId': nextS, 
                   'scoring.nonStrikerId': nextNS,
                   'scoring.thisOver': [] // Clear over for next
               };

               await updateDoc(matchRef, overEndUpdates);
               
               setShowNewBowlerModal(true);
          }

          // Continue to local update...

          // Force local refresh (Parent will likely re-fetch via snapshot listener if we had one, but we don't. )
          // We rely on simple local increment for speed, but for complex state (wicket/over), we really should re-fetch.
          // Since we don't have a listener in MatchesList (it's getDocs), we need to handle this.
          // Ideally: MatchesList should use onSnapshot. 
          // For now, we will assume user won't see updates unless refreshed? 
          // Wait, MatchesList updates local state on 'onUpdateLocal'.
          // We must construct 'newScoring' carefully.
          
          // Re-fetching full match is safer for "Full Cricket Implementation".
          // Let's rely on props update? No, parent passes static match.
          // HACK: We can't easily replicate full logic locally without bugs.
          // Recommendation: Move MatchesList to use onSnapshot for the active match.
          // OR: Just manually update critical fields locally.
          
          // UPDATED LOCAL LOGIC:
          const newLocalScoring = {
              ...scoring,
              totalRuns: (scoring.totalRuns || 0) + totalRunsAdd,
              totalWickets: isWicket ? (scoring.totalWickets || 0) + 1 : (scoring.totalWickets || 0),
              
              // Run-Based Rotation (Initial)
              strikerId: (runs % 2 !== 0) ? nonStrikerId : strikerId,
              nonStrikerId: (runs % 2 !== 0) ? strikerId : nonStrikerId,
              
              thisOver: [...(scoring.thisOver || []), isWicket ? 'W' : (runs > 0 ? runs : '') + (extraType ? extraType.toUpperCase() : runs === 0 ? '0' : '')],
              
              batsmenStats: {
                  ...scoring.batsmenStats,
                  [strikerId]: {
                      ...scoring.batsmenStats?.[strikerId],
                      runs: (scoring.batsmenStats?.[strikerId]?.runs || 0) + (extraType==='wd' ? 0 : runs),
                      balls: (scoring.batsmenStats?.[strikerId]?.balls || 0) + (extraType==='wd' ? 0 : ballsFacedAdd),
                      fours: (scoring.batsmenStats?.[strikerId]?.fours || 0) + (runs === 4 ? 1 : 0),
                      sixes: (scoring.batsmenStats?.[strikerId]?.sixes || 0) + (runs === 6 ? 1 : 0),
                  }
              },
              bowlerStats: {
                  ...scoring.bowlerStats,
                  [bowlerId]: {
                      ...currentBowlerStats,
                      runs: (currentBowlerStats.runs || 0) + totalRunsAdd,
                      balls: nextBallCount,
                      wickets: (currentBowlerStats.wickets || 0) + (isWicket ? 1 : 0),
                  }
              }
          };
          
          // Update Wicket Info locally
          if (isWicket && wicketInfo) {
              if (newLocalScoring.batsmenStats[outBatsmanId]) {
                 newLocalScoring.batsmenStats[outBatsmanId].wicketInfo = {
                      type: wicketInfo.type,
                      bowlerId: bowlerId,
                      fielderId: wicketInfo.fielder || null
                 };
              }
          }

          // End of Over Local Rotation
          if (isOverEnd) {
             // Logic:
             // Current Striker/NonStriker after run rotation:
             const currentS = runs % 2 !== 0 ? nonStrikerId : strikerId;
             const currentNS = runs % 2 !== 0 ? strikerId : nonStrikerId;
             
             // End of over swap:
             const nextS = currentNS;
             const nextNS = currentS;
             
             const overEndUpdates = {
                 'scoring.strikerId': nextS, 
                 'scoring.nonStrikerId': nextNS,
                 // DO NOT clear 'scoring.thisOver' here. Let user see full over
             };

             await updateDoc(matchRef, overEndUpdates);
             
             setShowNewBowlerModal(true);
          } else {
             // Normal update
             onUpdateLocal({ ...match, scoring: newLocalScoring });
          }

      } catch (e) {
          console.error(e);
          alert("Error updating score");
      } finally {
          setLoading(false);
      }
  };

  const handleResetOver = async () => {
    if (loading || !scoring.thisOver || scoring.thisOver.length === 0) return;
    if (!confirm("Are you sure you want to reset the current over? This will remove all runs, wickets, and stats for this over.")) return;

    setLoading(true);
    try {
        const matchRef = doc(db, 'matches', match.id);
        const currentOverIndex = scoring.totalOvers || 0;
        
        // Reverse simulation to initial state of the over
        const overEvents = [...scoring.thisOver].reverse(); // e.g. ["1", "W"] -> ["W", "1"]
        
        let netRuns = 0;
        let netWickets = 0;
        let legalBallsCount = 0;

        const updates = {};
        
        let simStriker = scoring.strikerId;
        let simNonStriker = scoring.nonStrikerId;

        // Find wickets that happened this over to restore
        const outBatsmen = Object.entries(scoring.batsmenStats || {})
            .filter(([_, s]) => s.wicketInfo && s.wicketInfo.over === currentOverIndex)
            .map(([pid, s]) => ({ pid, ...s.wicketInfo })); // { pid, type, over, ... }

        for (const event of overEvents) {
            const isWicket = event.includes('W');
            const isWide = event.toLowerCase().includes('wd');
            const isNb = event.toLowerCase().includes('nb');
            
            let runs = parseInt(event.replace(/\D/g, '') || '0');
            
            // 1. Recover Wicket (If any)
            if (isWicket) {
                 // The current simStriker is the New Batsman.
                 // We must swap him out for the victim.
                 // We assume New Batsman replaced the Out Batsman (simStriker position).
                 
                 const victim = outBatsmen.pop(); // Take one victim
                 if (victim) {
                     // Restore victim
                     updates[`scoring.batsmenStats.${victim.pid}.wicketInfo`] = deleteField();
                     
                     // Swap active players: simStriker (New) <-> victim (Old)
                     simStriker = victim.pid;
                 }
                 netWickets++;
            }
            
            // 2. Undo Rotation (Odd Runs)
            // A run means they swapped. So undo swap.
            // Note: Wides usually involve 1 run (the wide itself) plus extras.
            // My logic stores '1wd' as ball event. 
            // My handleScoreUpdate passes `runs` as the runs RAN.
            // So if '1wd', runs=1. They ran 1. Total = 1(wide)+1(run) = 2.
            // Swap if running 1.
            
            if (runs % 2 !== 0) {
                 const t = simStriker;
                 simStriker = simNonStriker;
                 simNonStriker = t;
            }
            
            // 3. Deduct Batsman Stats (Runs/Balls)
            if (!isWide) {
                // NB counts as ball faced? Yes.
                const ballDed = 1;
                updates[`scoring.batsmenStats.${simStriker}.runs`] = increment(-runs);
                updates[`scoring.batsmenStats.${simStriker}.balls`] = increment(-ballDed);
                
                if (runs === 4) updates[`scoring.batsmenStats.${simStriker}.fours`] = increment(-1);
                if (runs === 6) updates[`scoring.batsmenStats.${simStriker}.sixes`] = increment(-1);
            }
            
            // 4. Aggregate Totals
            let totalDed = runs;
            if (isWide || isNb) totalDed += 1;
            
            netRuns += totalDed;
            
            if (!isWide && !isNb) legalBallsCount++;
        }
        
        // Apply Totals
        updates['scoring.totalRuns'] = increment(-netRuns);
        updates['scoring.totalWickets'] = increment(-netWickets);
        
        updates['scoring.thisOver'] = [];
        updates['scoring.strikerId'] = simStriker;
        updates['scoring.nonStrikerId'] = simNonStriker;
        
        // Bowler
        updates[`scoring.bowlerStats.${scoring.currentBowlerId}.runs`] = increment(-netRuns);
        updates[`scoring.bowlerStats.${scoring.currentBowlerId}.balls`] = increment(-legalBallsCount);
        updates[`scoring.bowlerStats.${scoring.currentBowlerId}.wickets`] = increment(-netWickets);

        await updateDoc(matchRef, updates);
        
        // Refresh local
        onUpdateLocal({
            ...match,
            scoring: {
                ...scoring,
                thisOver: [],
                strikerId: simStriker,
                nonStrikerId: simNonStriker,
                totalRuns: (scoring.totalRuns || 0) - netRuns,
                totalWickets: (scoring.totalWickets || 0) - netWickets
                // Note: deeply nested stats won't update locally here perfectly, but DB is correct.
            }
        });

    } catch (e) {
        console.error("Reset Error", e);
        alert("Error resetting over: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleNewBatsman = async () => {
      if (!selectedNewPlayer) return;
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          // Current striker is out. New player becomes striker.
          await updateDoc(matchRef, {
              'scoring.strikerId': selectedNewPlayer,
              // Init stats for new player
              [`scoring.batsmenStats.${selectedNewPlayer}`]: { runs: 0, balls: 0, fours: 0, sixes: 0 }
          });
          setShowNewBatsmanModal(false);
          setSelectedNewPlayer('');
          
          // Local update
          const newScoring = { ...scoring, strikerId: selectedNewPlayer };
          onUpdateLocal({ ...match, scoring: newScoring });

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  };

  const handleUndo = async () => {
      if (loading || !scoring.thisOver || scoring.thisOver.length === 0) return;
      
      const lastEvent = scoring.thisOver[scoring.thisOver.length - 1]; // e.g. "1", "4wd"
      if (lastEvent.includes('W')) {
          alert('Cannot undo wickets. Please reset match or edit manually.');
          return;
      }

      setLoading(true);
      try {
          let runs = 0;
          let extraType = null;
          
          if (lastEvent.toUpperCase().includes('WD')) extraType = 'wd';
          else if (lastEvent.toUpperCase().includes('NB')) extraType = 'nb';
          else if (lastEvent.toUpperCase().includes('LB')) extraType = 'lb';
          else if (lastEvent.toUpperCase().includes('B')) extraType = 'b';
          
          const numPart = lastEvent.replace(/\D/g, '');
          runs = numPart === '' ? 0 : parseInt(numPart);
          
          let totalDed = runs;
          if (extraType === 'wd' || extraType === 'nb') totalDed += 1; 

          // Identify Striker/NonStriker to revert
          let currentStriker = scoring.strikerId;
          let currentNonStriker = scoring.nonStrikerId;
          const updates = {};

          // Revert Rotation (if odd runs)
          if (runs % 2 !== 0) {
              const temp = currentStriker;
              currentStriker = currentNonStriker;
              currentNonStriker = temp;
              updates['scoring.strikerId'] = currentStriker;
              updates['scoring.nonStrikerId'] = currentNonStriker;
          }
          
          updates['scoring.totalRuns'] = increment(-totalDed);
          updates['scoring.thisOver'] = scoring.thisOver.slice(0, -1);
          
          // Revert Batsman stats
          const batRunsDed = (extraType === 'wd') ? 0 : runs; // Wide runs don't belong to bat
          const batBallsDed = (extraType === 'wd') ? 0 : 1;   // Wide doesn't count as ball faced (NB does)
          
          updates[`scoring.batsmenStats.${currentStriker}.runs`] = increment(-batRunsDed);
          updates[`scoring.batsmenStats.${currentStriker}.balls`] = increment(-batBallsDed);
          if (runs === 4) updates[`scoring.batsmenStats.${currentStriker}.fours`] = increment(-1);
          if (runs === 6) updates[`scoring.batsmenStats.${currentStriker}.sixes`] = increment(-1);

          // Revert Bowler stats
          const bowlBallsDed = (extraType === 'wd' || extraType === 'nb') ? 0 : 1;
          const bowlerRunsDed = (extraType === 'b' || extraType === 'lb') ? 0 : totalDed;
          updates[`scoring.bowlerStats.${scoring.currentBowlerId}.runs`] = increment(-bowlerRunsDed);
          updates[`scoring.bowlerStats.${scoring.currentBowlerId}.balls`] = increment(-bowlBallsDed);
          
          const matchRef = doc(db, 'matches', match.id);
          await updateDoc(matchRef, updates);
          
          // Local update estimate
          const newScoring = {
              ...scoring,
              totalRuns: (scoring.totalRuns || 0) - totalDed,
              thisOver: scoring.thisOver.slice(0, -1),
              strikerId: currentStriker,
              nonStrikerId: currentNonStriker,
              batsmenStats: {
                  ...scoring.batsmenStats,
                  [currentStriker]: {
                      ...scoring.batsmenStats?.[currentStriker],
                      runs: (scoring.batsmenStats?.[currentStriker]?.runs || 0) - batRunsDed,
                      balls: (scoring.batsmenStats?.[currentStriker]?.balls || 0) - batBallsDed,
                      fours: (scoring.batsmenStats?.[currentStriker]?.fours || 0) - (runs === 4 ? 1 : 0),
                      sixes: (scoring.batsmenStats?.[currentStriker]?.sixes || 0) - (runs === 6 ? 1 : 0),
                  }
              },
              bowlerStats: {
                  ...scoring.bowlerStats,
                  [scoring.currentBowlerId]: {
                      ...scoring.bowlerStats?.[scoring.currentBowlerId],
                      runs: (scoring.bowlerStats?.[scoring.currentBowlerId]?.runs || 0) - totalDed,
                      balls: (scoring.bowlerStats?.[scoring.currentBowlerId]?.balls || 0) - bowlBallsDed
                  }
              }
          };
          onUpdateLocal({ ...match, scoring: newScoring });

      } catch (e) {
          console.error(e);
          alert('Error undoing: ' + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleNewBowler = async () => {
      if (!selectedNewPlayer) return;
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          // Only change bowler and increment overs. 
          // Do NOT swap ends here or clear 'thisOver' (cleared after selection for visual continuity)
          await updateDoc(matchRef, {
              'scoring.currentBowlerId': selectedNewPlayer,
              'scoring.thisOver': [], // Now we clear the over
              'scoring.totalOvers': increment(1) 
          });
          
          setShowNewBowlerModal(false);
          setSelectedNewPlayer('');
          
          const newScoring = { 
              ...scoring, 
              currentBowlerId: selectedNewPlayer,
              thisOver: [],
              totalOvers: (scoring.totalOvers || 0) + 1
          };
          onUpdateLocal({ ...match, scoring: newScoring });

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  };

  // UI Helpers
  const getUnbattedPlayers = () => {
      // Logic: If they are in stats, they batted. If they are in stats AND not current striker/nonStriker, they are OUT.
      // So Valid New = Squad.filter(id => !batsmenStats[id]).
      const battedIds = Object.keys(scoring.batsmenStats || {});
      const ids = (currentBattingSquad || []).filter(id => !battedIds.includes(id) && id !== scoring.strikerId && id !== scoring.nonStrikerId);
      return getPlayers(ids);
  };

  const getAvailableBowlers = () => {
      // Anyone from bowling squad EXCEPT current bowler (can't bowl 2 in row)
      const ids = (currentBowlingSquad || []).filter(id => id !== scoring.currentBowlerId);
      return getPlayers(ids);
  };

  // Innings Progress Helpers
  const currentOverBalls = (scoring.thisOver || []).filter(b => !b.includes('WD') && !b.includes('NB')).length;
  const inningsOverDisplay = `${scoring.totalOvers || 0}.${currentOverBalls}`;
  const totalLegalBalls = (scoring.totalOvers || 0) * 6 + currentOverBalls;


  return (
    <div className="min-h-screen flex flex-col bg-bg-primary font-sans text-text-primary">
      
      {/* 1. Header Strip */}
      <div className="h-18 shrink-0 bg-bg-secondary flex items-center justify-between px-4 py-2 border-b border-border shadow-sm z-10">
         <div className="flex items-center gap-4">
             {/* Logo */}
             <div className="w-12 h-12 flex items-center justify-center bg-bg-primary rounded-lg border border-border p-1">
                 <img src="/rcc-logo.svg" alt="RCC" className="w-full h-full object-contain" />
             </div>
             
             {/* Match Details */}
             <div className="flex flex-col">
                 <h2 className="text-xs font-bold text-accent uppercase tracking-widest mb-0.5">
                     {match.venue || 'Rahway River Park'} • {match.time || '1:00 PM'} • {match.format || '40 Overs'}
                 </h2>
                 <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                     <span className={isTeam1Batting ? 'text-text-primary font-bold' : ''}>Spartans</span>
                     <span className="text-text-tertiary">vs</span>
                     <span className={!isTeam1Batting ? 'text-text-primary font-bold' : ''}>Warriors</span>
                     <span className="mx-1 text-text-tertiary">|</span>
                     <span className="text-xs bg-bg-primary text-text-tertiary px-2 py-0.5 rounded-full font-bold border border-border">{isTeam1Batting ? '1st Innings' : '2nd Innings'}</span>
                 </div>
             </div>
         </div>
         <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-primary transition-colors border border-transparent hover:border-border">
              <X size={20} className="text-text-secondary" />
         </button>
      </div>

      {/* 2. Main Dashboard Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-4">
              
              {/* Score Strip */}
              <div className="bg-bg-secondary rounded-xl p-6 border border-border flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                   
                   {/* Big Score */}
                   <div className="text-center md:text-left">
                       <div className="text-5xl font-bold tracking-tight text-text-primary tabular-nums">
                           {scoring.totalRuns}/{scoring.totalWickets}
                       </div>
                       <div className="text-text-secondary text-sm mt-1 font-medium">
                           {inningsOverDisplay} Overs
                           <span className="mx-2 text-text-tertiary">|</span>
                           CRR {(scoring.totalRuns / Math.max(0.1, totalLegalBalls / 6)).toFixed(2)}
                       </div>
                   </div>

                   {/* Last 6 Balls */}
                   <div className="flex flex-col items-center md:items-end gap-2">
                       <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">This Over</span>
                       <div className="flex gap-2">
                           {(scoring.thisOver || []).map((ball, i) => {
                               const isWD = ball.includes('WD');
                               const isNB = ball.includes('NB');
                               return (
                               <div key={i} className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-xs border shadow-sm ${
                                   ball === 'W' ? 'bg-error text-white border-error' :
                                   isWD ? 'bg-waiting text-white border-waiting' :
                                   isNB ? 'bg-orange-500 text-white border-orange-500' :
                                   ball.includes('4') ? 'bg-accent/10 border-accent/20 text-accent' :
                                   ball.includes('6') ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                                   'bg-bg-primary border-border text-text-secondary'
                               }`}>
                                   {ball}
                               </div>
                           )})}
                           {(!scoring.thisOver || scoring.thisOver.length === 0) && (
                               <span className="text-text-tertiary text-xs italic py-2">Over starting...</span>
                           )}
                       </div>
                   </div>
              </div>

              {/* Batting & Bowling Split View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Batting Card */}
                  <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-bg-primary/50 border-b border-border flex justify-between items-center">
                          <span className="text-xs font-bold text-text-tertiary uppercase tracking-widest">Batting</span>
                          <div className="flex gap-4 text-xs font-bold text-text-tertiary text-right pr-2">
                              <span className="w-8">R</span>
                              <span className="w-8">B</span>
                              <span className="w-6">4s</span>
                              <span className="w-6">6s</span>
                          </div>
                      </div>
                      <div className="p-2 space-y-1">
                          {(currentBattingSquad || []).map(playerId => {
                             const stats = scoring.batsmenStats?.[playerId];
                             const isStriker = playerId === scoring.strikerId;
                             const isNonStriker = playerId === scoring.nonStrikerId;
                             if (!stats && !isStriker && !isNonStriker) return null;

                             const active = isStriker || isNonStriker;
                             
                             return (
                               <div key={playerId} className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                                   active ? 'bg-accent/10 border-accent/20' : 'border-transparent opacity-60'
                               }`}>
                                   <div className="flex items-center gap-2">
                                       {isStriker && <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse shadow-sm shadow-success/20" />}
                                       <span className={`font-medium ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                                           {getName(playerId)}
                                       </span>
                                   </div>
                                    <div className="flex gap-4 text-right font-mono text-sm">
                                        <span className={`w-8 ${active ? 'text-text-primary font-bold' : 'text-text-secondary'}`}>{stats?.runs || 0}</span>
                                        <span className="w-8 text-text-secondary">{stats?.balls || 0}</span>
                                        <span className="w-6 text-text-tertiary">{stats?.fours || 0}</span>
                                        <span className="w-6 text-text-tertiary">{stats?.sixes || 0}</span>
                                    </div>
                               </div>
                             );
                          })}
                      </div>
                  </div>

                  {/* Bowling Card */}
                  <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden shadow-sm h-fit">
                      <div className="px-4 py-3 bg-bg-primary/50 border-b border-border flex justify-between items-center">
                          <span className="text-xs font-bold text-text-tertiary uppercase tracking-widest">Bowling</span>
                          <div className="flex gap-4 text-xs font-bold text-text-tertiary text-right pr-2">
                              <span className="w-8">O</span>
                              <span className="w-8">R</span>
                              <span className="w-8">W</span>
                          </div>
                      </div>
                      <div className="p-2">
                           <div className="flex items-center justify-between p-3 rounded-md bg-accent/10 border border-accent/20">
                               <div className="font-medium text-text-primary">{getName(scoring.currentBowlerId)}</div>
                               <div className="flex gap-4 text-right font-mono text-sm font-bold">
                                   <span className="w-8 text-text-primary">{Math.floor((scoring.bowlerStats?.[scoring.currentBowlerId]?.balls || 0) / 6)}.{ (scoring.bowlerStats?.[scoring.currentBowlerId]?.balls || 0) % 6 }</span>
                                   <span className="w-8 text-text-primary">{scoring.bowlerStats?.[scoring.currentBowlerId]?.runs || 0}</span>
                                   <span className="w-8 text-accent">{scoring.bowlerStats?.[scoring.currentBowlerId]?.wickets || 0}</span>
                               </div>
                           </div>
                      </div>
                  </div>

              </div>

          </div>
      </div>

      {/* 3. Control Pad */}
      <div className="bg-bg-secondary p-4 border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-8 z-20">
          <div className="max-w-md mx-auto space-y-2">
              {activeExtraType && (
                  <div className="bg-bg-primary p-3 rounded-xl border-2 border-accent shadow-xl mb-4 animate-fade-in text-left">
                      <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-md ${
                                  activeExtraType === 'wd' ? 'bg-waiting' : 
                                  activeExtraType === 'nb' ? 'bg-orange-500' : 
                                  'bg-blue-500'
                              }`}>
                                  {activeExtraType.toUpperCase()}
                              </div>
                              <div>
                                  <h4 className="text-sm font-black text-text-primary uppercase tracking-tight">
                                      {activeExtraType === 'wd' ? 'Wide Ball' : 
                                       activeExtraType === 'nb' ? 'No Ball' : 
                                       activeExtraType === 'lb' ? 'Leg Bye' : 'Bye'} Recorded
                                  </h4>
                                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Select additional runs</p>
                              </div>
                          </div>
                          <button 
                              onClick={() => setActiveExtraType(null)}
                              className="p-2 px-4 text-xs font-black bg-bg-tertiary text-text-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-all uppercase"
                          >
                              Cancel
                          </button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2">
                           <button onClick={() => { handleScoreUpdate(0, true, activeExtraType); setActiveExtraType(null); }} className="h-10 bg-bg-secondary border border-border text-text-primary font-bold rounded-lg hover:bg-bg-tertiary transition-colors">
                               {activeExtraType === 'lb' || activeExtraType === 'b' ? '0' : '+0'}
                           </button>
                           {[1, 2, 3].map(run => (
                               <button 
                                  key={run}
                                  onClick={() => { handleScoreUpdate(run, true, activeExtraType); setActiveExtraType(null); }} 
                                  className="h-10 bg-bg-secondary border border-border text-text-primary font-bold rounded-lg hover:bg-bg-tertiary transition-colors"
                               >
                                  +{run}
                               </button>
                           ))}
                           
                           <button 
                                onClick={() => { handleScoreUpdate(4, true, activeExtraType); setActiveExtraType(null); }} 
                                className={`h-12 col-span-2 flex items-center justify-center gap-2 font-black text-white rounded-lg shadow-lg transition-all active:scale-95 ${
                                    activeExtraType === 'wd' ? 'bg-waiting' : 
                                    activeExtraType === 'nb' ? 'bg-orange-500' : 
                                    'bg-blue-600'
                                }`}
                            >
                                <Trophy size={14} /> +4 Boundary
                            </button>
                            
                            {(activeExtraType === 'nb' || activeExtraType === 'b' || activeExtraType === 'lb') && (
                                <button 
                                    onClick={() => { handleScoreUpdate(6, true, activeExtraType); setActiveExtraType(null); }} 
                                    className="h-12 col-span-2 flex items-center justify-center gap-2 bg-purple-600 font-black text-white rounded-lg shadow-lg transition-all active:scale-95"
                                >
                                    <Trophy size={14} /> +6 Boundary
                                </button>
                            )}
                            
                            {activeExtraType === 'wd' && (
                                <div className="col-span-2" /> 
                            )}
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map(run => (
                      <button
                        key={run}
                        onClick={() => {
                            if (activeExtraType) {
                                handleScoreUpdate(run, true, activeExtraType);
                                setActiveExtraType(null);
                            } else {
                                handleScoreUpdate(run);
                            }
                        }}
                        disabled={loading}
                        className={`h-12 font-bold text-lg rounded-lg active:scale-95 transition-all border shadow-sm ${
                            activeExtraType 
                            ? 'bg-bg-secondary border-accent text-accent' 
                            : 'bg-bg-primary text-text-primary border-border hover:bg-bg-tertiary'
                        }`}
                      >
                          {activeExtraType ? `+${run}` : run}
                      </button>
                  ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                   <button 
                        onClick={() => {
                            if (activeExtraType) {
                                handleScoreUpdate(4, true, activeExtraType);
                                setActiveExtraType(null);
                            } else {
                                handleScoreUpdate(4);
                            }
                        }} 
                        className={`h-12 font-black text-lg rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-lg ${
                            activeExtraType 
                            ? (activeExtraType === 'wd' ? 'bg-waiting shadow-waiting/20' : 
                               activeExtraType === 'nb' ? 'bg-orange-500 shadow-orange-500/20' : 
                               'bg-blue-600 shadow-blue-600/20')
                            : 'bg-accent shadow-accent/20'
                        } text-white`}
                    >
                        {activeExtraType ? `+4` : '4'}
                    </button>
                   <button 
                        onClick={() => {
                            if (activeExtraType) {
                                handleScoreUpdate(6, true, activeExtraType);
                                setActiveExtraType(null);
                            } else {
                                handleScoreUpdate(6);
                            }
                        }} 
                        disabled={activeExtraType === 'wd'}
                        className={`h-12 font-black text-lg rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-lg ${
                            activeExtraType 
                            ? (activeExtraType === 'nb' ? 'bg-orange-500 shadow-orange-500/20' : 
                               activeExtraType === 'wd' ? 'bg-bg-tertiary opacity-50 cursor-not-allowed' :
                               'bg-purple-600 shadow-purple-600/20')
                            : 'bg-purple-600 shadow-purple-600/20'
                        } text-white`}
                    >
                        {activeExtraType === 'nb' ? '+6' : '6'}
                    </button>
                   <button 
                        onClick={() => {
                           setWicketDetails({ type: 'Bowled', fielder: '', who: scoring.strikerId });
                           setShowWicketDetailsModal(true);
                       }}
                       className="h-12 bg-error text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:opacity-90 shadow-lg shadow-error/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                    >
                        Wicket
                   </button>
                   <button onClick={() => setShowNewBowlerModal(true)} className="h-12 bg-bg-primary border border-border text-text-primary font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-bg-tertiary active:scale-95 transition-all">Swap</button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                   <button 
                        onClick={() => setActiveExtraType(activeExtraType === 'wd' ? null : 'wd')} 
                        className={`h-10 font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all border-2 ${
                            activeExtraType === 'wd' 
                            ? 'bg-waiting border-white shadow-waiting/20' 
                            : 'bg-waiting border-transparent shadow-waiting/10 opacity-80'
                        } text-white`}
                    >
                        WD
                    </button>
                   <button 
                        onClick={() => setActiveExtraType(activeExtraType === 'nb' ? null : 'nb')} 
                        className={`h-10 font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all border-2 ${
                            activeExtraType === 'nb' 
                            ? 'bg-orange-500 border-white shadow-orange-500/20' 
                            : 'bg-orange-500 border-transparent shadow-orange-500/10 opacity-80'
                        } text-white`}
                    >
                        NB
                    </button>
                    <button 
                        onClick={() => setActiveExtraType(activeExtraType === 'lb' ? null : 'lb')} 
                        className={`h-10 font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all border-2 ${
                            activeExtraType === 'lb' 
                            ? 'bg-blue-600 border-white shadow-blue-600/20' 
                            : 'bg-blue-600 border-transparent shadow-blue-600/10 opacity-80'
                        } text-white`}
                    >
                        LB
                    </button>
                    <button 
                        onClick={() => setActiveExtraType(activeExtraType === 'b' ? null : 'b')} 
                        className={`h-10 font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all border-2 ${
                            activeExtraType === 'b' 
                            ? 'bg-blue-500 border-white shadow-blue-500/20' 
                            : 'bg-blue-500 border-transparent shadow-blue-500/10 opacity-80'
                        } text-white`}
                    >
                        B
                    </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2">
                   <button onClick={handleUndo} disabled={loading} className="col-span-1 h-12 bg-bg-primary border border-border text-text-secondary rounded-lg flex items-center justify-center hover:bg-bg-tertiary active:scale-95 transition-all"><Undo2 size={20}/></button>
                   <button onClick={handleResetOver} disabled={loading} className="col-span-3 h-12 bg-bg-primary border border-border text-accent font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 hover:bg-bg-tertiary active:scale-95 transition-all">
                        <RotateCcw size={14} />
                        Reset Over Statistics
                   </button>
              </div>
          </div>
      </div>

       {/* --- NEW BATSMAN MODAL --- */}
       <AnimatePresence>
            {showNewBatsmanModal && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-sm bg-bg-secondary rounded-xl shadow-2xl overflow-hidden relative border border-border">
                        <button 
                            onClick={() => setShowNewBatsmanModal(false)}
                            className="absolute top-3 right-3 p-1 rounded-full bg-bg-primary text-text-tertiary hover:text-text-primary transition-colors"
                        >
                            <X size={16} />
                        </button>

                        <div className="p-5 border-b border-border bg-error/10">
                            <h3 className="text-error font-black uppercase tracking-widest text-center text-lg">Wicket Fall!</h3>
                            <p className="text-center text-text-secondary text-xs mt-1">
                                {getName(wicketData?.outBatsman)} is out.
                            </p>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-bold text-text-tertiary mb-2 uppercase">Select New Batsman</label>
                            <select 
                                className="w-full p-3 bg-bg-primary rounded-lg border border-border text-text-primary mb-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                                value={selectedNewPlayer}
                                onChange={(e) => setSelectedNewPlayer(e.target.value)}
                            >
                                <option value="">Select Player</option>
                                {getUnbattedPlayers().map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <button
                                disabled={!selectedNewPlayer || loading}
                                onClick={handleNewBatsman}
                                className="w-full py-3 bg-text-primary text-bg-primary font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-black/10"
                            >
                                Confirm Batsman
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
       </AnimatePresence>
       
       {/* --- WICKET DETAILS MODAL --- */}
       <AnimatePresence>
            {showWicketDetailsModal && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-sm bg-bg-secondary rounded-xl shadow-2xl overflow-hidden border border-border">
                        <div className="p-4 border-b border-border bg-error/10 flex justify-between items-center">
                            <h3 className="text-error font-black uppercase tracking-widest text-lg">Wicket Details</h3>
                            <button 
                                onClick={() => setShowWicketDetailsModal(false)}
                                className="p-1 rounded-full bg-bg-primary border border-border text-text-tertiary hover:text-text-primary"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            
                            {/* Who out? */}
                            <div>
                                <label className="block text-xs font-bold text-text-tertiary mb-2 uppercase">Who is Out?</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setWicketDetails({...wicketDetails, who: scoring.strikerId})}
                                        className={`p-3 rounded-lg border text-sm font-bold transition-all shadow-sm ${
                                            wicketDetails.who === scoring.strikerId 
                                            ? 'bg-error border-error text-white shadow-error/20' 
                                            : 'bg-bg-primary border-border text-text-secondary hover:border-text-tertiary'
                                        }`}
                                    >
                                        {getName(scoring.strikerId)} (Striker)
                                    </button>
                                    <button 
                                        onClick={() => setWicketDetails({...wicketDetails, who: scoring.nonStrikerId})}
                                        className={`p-3 rounded-lg border text-sm font-bold transition-all shadow-sm ${
                                            wicketDetails.who === scoring.nonStrikerId 
                                            ? 'bg-error border-error text-white shadow-error/20' 
                                            : 'bg-bg-primary border-border text-text-secondary hover:border-text-tertiary'
                                        }`}
                                    >
                                        {getName(scoring.nonStrikerId)} (Non-Str)
                                    </button>
                                </div>
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-xs font-bold text-text-tertiary mb-2 uppercase">Dismissal Type</label>
                                <select 
                                    className="w-full p-3 bg-bg-primary rounded-lg border border-border text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                                    value={wicketDetails.type}
                                    onChange={(e) => setWicketDetails({...wicketDetails, type: e.target.value})}
                                >
                                    <option value="Bowled">Bowled</option>
                                    <option value="Caught">Caught</option>
                                    <option value="Run Out">Run Out</option>
                                    <option value="LBW">LBW</option>
                                    <option value="Stumped">Stumped</option>
                                    <option value="Hit Wicket">Hit Wicket</option>
                                    <option value="Retired">Retired</option>
                                </select>
                            </div>

                            {/* Fielder (Conditional) */}
                            {['Caught', 'Run Out', 'Stumped'].includes(wicketDetails.type) && (
                                <div>
                                    <label className="block text-xs font-bold text-text-tertiary mb-2 uppercase">Fielder involved</label>
                                    <select 
                                        className="w-full p-3 bg-bg-primary rounded-lg border border-border text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                                        value={wicketDetails.fielder}
                                        onChange={(e) => setWicketDetails({...wicketDetails, fielder: e.target.value})}
                                    >
                                        <option value="">Select Fielder</option>
                                        {getPlayers(currentBowlingSquad).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button
                                disabled={loading}
                                onClick={() => handleScoreUpdate(0, false, null, true, wicketDetails).then(() => setShowWicketDetailsModal(false))}
                                className="w-full py-3 bg-error text-white font-bold rounded-lg hover:opacity-90 transition-opacity mt-2 shadow-lg shadow-error/20"
                            >
                                Confirm Wicket
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
       </AnimatePresence>

       {/* --- NEW BOWLER MODAL --- */}
       <AnimatePresence>
            {showNewBowlerModal && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-sm bg-bg-secondary rounded-xl shadow-2xl overflow-hidden border border-border">
                        <div className="p-4 border-b border-border bg-accent/10">
                            <h3 className="text-accent font-black uppercase tracking-widest text-center text-lg">Over Complete</h3>
                            <p className="text-center text-text-secondary text-xs mt-1">Select next bowler</p>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-bold text-text-tertiary mb-2 uppercase">Select Bowler</label>
                            <select 
                                className="w-full p-3 bg-bg-primary rounded-lg border border-border text-text-primary mb-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                                value={selectedNewPlayer}
                                onChange={(e) => setSelectedNewPlayer(e.target.value)}
                            >
                                <option value="">Select Bowler</option>
                                {getAvailableBowlers().map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <button
                                disabled={!selectedNewPlayer || loading}
                                onClick={handleNewBowler}
                                className="w-full py-3 bg-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-accent/20"
                            >
                                Start New Over
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
       </AnimatePresence>

    </div>
  );
}

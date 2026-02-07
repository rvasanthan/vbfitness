import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Undo2, RotateCcw, Trophy, Zap, Settings, Disc } from 'lucide-react';
import { doc, updateDoc, arrayUnion, increment, deleteField, getDoc } from 'firebase/firestore'; 
import { db } from '../firebase';
import ScoreboardModal from './ScoreboardModal';
import TossModal from './TossModal';

export default function ScoringInterface({ isOpen, match, users, user, onClose, onUpdateLocal }) {
  // 1. Hooks (Always Call First)
  const [loading, setLoading] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showTossModal, setShowTossModal] = useState(false);
  
  // Modals for Wicket/Over
  const [showWicketDetailsModal, setShowWicketDetailsModal] = useState(false);
  const [wicketDetails, setWicketDetails] = useState({ type: 'Bowled', fielder: '', fielder2: '', who: '' }); // type, fielder, fielder2, who
  const [showNewBatsmanModal, setShowNewBatsmanModal] = useState(false);
  const [showNewBowlerModal, setShowNewBowlerModal] = useState(false);
  const [selectedNewPlayer, setSelectedNewPlayer] = useState(''); // For both modals
  const [wicketData, setWicketData] = useState(null); // To store wicket context if needed
  const [activeExtraType, setActiveExtraType] = useState(null); // 'wd' or 'nb'
  const [showInningsEndModal, setShowInningsEndModal] = useState(false);

  // 2. Early Return only AFTER hooks
  if (!isOpen || !match || !match.scoring) return null;

  const { scoring } = match;

  const maxOvers = useMemo(() => {
    if (!match.format) return 40;
    const format = match.format.toLowerCase();
    if (format.includes('t20')) return 20;
    const num = parseInt(format);
    return isNaN(num) ? 40 : num;
  }, [match.format]);

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

  const canEditToss = user?.role === 'admin' || user?.uid === match.captain1Id || user?.uid === match.captain2Id;

  const handleSaveToss = async (matchId, tossData) => {
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', matchId);
          const updates = { ...tossData };

          // If match has NO balls recorded, we can safely swap the batting/bowling team based on new toss
          const ballsRecorded = (scoring?.thisOver || []).length > 0 || (scoring?.totalOvers || 0) > 0;
          if (!ballsRecorded) {
              const newIsTeam1Batting = (tossData.tossWinner === 'team1' && tossData.tossChoice === 'bat') || 
                                     (tossData.tossWinner === 'team2' && tossData.tossChoice === 'bowl');
              
              updates['scoring.battingTeam'] = newIsTeam1Batting ? 'team1' : 'team2';
              updates['scoring.bowlingTeam'] = newIsTeam1Batting ? 'team2' : 'team1';
          }

          await updateDoc(matchRef, updates);
          
          // Local update
          // Deeply merge updates into match
          const updatedScoring = { ...scoring };
          if (updates['scoring.battingTeam']) updatedScoring.battingTeam = updates['scoring.battingTeam'];
          if (updates['scoring.bowlingTeam']) updatedScoring.bowlingTeam = updates['scoring.bowlingTeam'];

          onUpdateLocal({ 
              ...match, 
              ...tossData,
              scoring: updatedScoring
          });
          setShowTossModal(false);
      } catch (e) {
          console.error(e);
          alert("Failed to update toss");
      } finally {
          setLoading(false);
      }
  };

  const handleScoreUpdate = async (runs, isExtra = false, extraType = null, isWicket = false, wicketInfo = null) => {
      if (loading) return;
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          let strikerId = scoring.strikerId;
          let nonStrikerId = scoring.nonStrikerId;
          
          // Helper: Current balls in the over to mark wicket timing
          const currentOverBalls = (scoring.thisOver || []).filter(b => !b.toLowerCase().includes('wd') && !b.toLowerCase().includes('nb')).length;

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

          // --- AUTO RETIRE LOGIC (11 Balls) ---
          let effectiveIsWicket = isWicket;
          let effectiveWicketInfo = wicketInfo;
          let effectiveOutBatsmanId = outBatsmanId;

          if (!isWicket && extraType !== 'wd') {
              const currentStrikerBalls = (scoring.batsmenStats?.[strikerId]?.balls || 0);
              if (currentStrikerBalls + ballsFacedAdd >= 11) {
                  alert(`🔔 UMPIRE NOTIFICATION: ${getName(strikerId)} has faced 11 balls and is now Retired.`);
                  effectiveIsWicket = true;
                  effectiveOutBatsmanId = strikerId;
                  effectiveWicketInfo = { type: 'Retired', fielder: null, fielder2: null };
              }
          }
          
          // Construct updates
          const updates = {};
          
          // 1. Total Score
          updates['scoring.totalRuns'] = increment(totalRunsAdd);
          
          const isRetired = effectiveIsWicket && effectiveWicketInfo?.type === 'Retired';
          const ballText = isRetired ? 'RT' : 
                           (effectiveIsWicket ? 'W' : 
                           (isExtra ? `${runs > 0 ? runs : ''}${extraType.toUpperCase()}` : 
                           (runs === 0 ? '0' : runs.toString())));

          // Use full array replacement for safety
          const newOver = [...(scoring.thisOver || []), ballText];
          updates['scoring.thisOver'] = newOver;

          // 2. Strike Rotation (Odd runs)
          let finalStrikerId = (runs % 2 !== 0) ? nonStrikerId : strikerId;
          let finalNonStrikerId = (runs % 2 !== 0) ? strikerId : nonStrikerId;
          
          if (runs % 2 !== 0) {
               updates['scoring.strikerId'] = finalStrikerId;
               updates['scoring.nonStrikerId'] = finalNonStrikerId;
          }

          // 3. Batsman Stats (Attrib to Striker)
          if (extraType !== 'wd' && extraType !== 'b' && extraType !== 'lb') {
               updates[`scoring.batsmenStats.${strikerId}.runs`] = increment(runs);
               if (runs === 4) updates[`scoring.batsmenStats.${strikerId}.fours`] = increment(1);
               if (runs === 6) updates[`scoring.batsmenStats.${strikerId}.sixes`] = increment(1);
          }
          if (extraType !== 'wd') {
              updates[`scoring.batsmenStats.${strikerId}.balls`] = increment(ballsFacedAdd);
          }

          // 4. Bowler Stats
          const chargedToBowler = (extraType === 'b' || extraType === 'lb') ? 0 : totalRunsAdd;
          updates[`scoring.bowlerStats.${bowlerId}.runs`] = increment(chargedToBowler);
          if (legalBall) {
              updates[`scoring.bowlerStats.${bowlerId}.balls`] = increment(1);
          }
          
          if (effectiveIsWicket) {
              if (!isRetired) updates['scoring.totalWickets'] = increment(1);
              if (effectiveWicketInfo && effectiveWicketInfo.type !== 'Retired') {
                  updates[`scoring.bowlerStats.${bowlerId}.wickets`] = increment(1);
              }
              if (effectiveWicketInfo) {
                  updates[`scoring.batsmenStats.${effectiveOutBatsmanId}.wicketInfo`] = {
                      type: effectiveWicketInfo.type,
                      bowlerId: bowlerId,
                      fielderId: effectiveWicketInfo.fielder || null,
                      fielderId2: effectiveWicketInfo.fielder2 || null,
                      over: scoring.totalOvers || 0,
                      ball: currentOverBalls + 1,
                      wasStriker: effectiveOutBatsmanId === strikerId
                  };
              }
          }

          // Over End Detection (Rotation for next over)
          const isOverEnd = legalBall && (currentOverBalls + 1 === 6);
          if (isOverEnd) {
             // Rotate ends for the NEXT over
             const nextS = finalNonStrikerId;
             const nextNS = finalStrikerId;
             updates['scoring.strikerId'] = nextS;
             updates['scoring.nonStrikerId'] = nextNS;
             finalStrikerId = nextS;
             finalNonStrikerId = nextNS;
          }

          // DB UPDATE (Single Atomic Call)
          await updateDoc(matchRef, updates);

          // LOCAL OPTIMISTIC UPDATE
          const newLocalScoring = {
              ...scoring,
              totalRuns: (scoring.totalRuns || 0) + totalRunsAdd,
              totalWickets: (effectiveIsWicket && !isRetired) ? (scoring.totalWickets || 0) + 1 : (scoring.totalWickets || 0),
              strikerId: finalStrikerId,
              nonStrikerId: finalNonStrikerId,
              thisOver: newOver,
              batsmenStats: {
                  ...scoring.batsmenStats,
                  [strikerId]: {
                      ...scoring.batsmenStats?.[strikerId],
                      runs: (scoring.batsmenStats?.[strikerId]?.runs || 0) + (extraType==='wd' || extraType==='b' || extraType==='lb' ? 0 : runs),
                      balls: (scoring.batsmenStats?.[strikerId]?.balls || 0) + (extraType==='wd' ? 0 : ballsFacedAdd),
                      fours: (scoring.batsmenStats?.[strikerId]?.fours || 0) + (runs === 4 ? 1 : 0),
                      sixes: (scoring.batsmenStats?.[strikerId]?.sixes || 0) + (runs === 6 ? 1 : 0),
                  }
              },
              bowlerStats: {
                  ...scoring.bowlerStats,
                  [bowlerId]: {
                      ...(scoring.bowlerStats?.[bowlerId] || { balls: 0, runs: 0, wickets: 0 }),
                      runs: (scoring.bowlerStats?.[bowlerId]?.runs || 0) + chargedToBowler,
                      balls: (scoring.bowlerStats?.[bowlerId]?.balls || 0) + (legalBall ? 1 : 0),
                      wickets: (scoring.bowlerStats?.[bowlerId]?.wickets || 0) + (effectiveIsWicket && effectiveWicketInfo?.type !== 'Retired' ? 1 : 0),
                  }
              }
          };

          if (effectiveIsWicket && effectiveWicketInfo && newLocalScoring.batsmenStats[effectiveOutBatsmanId]) {
              newLocalScoring.batsmenStats[effectiveOutBatsmanId].wicketInfo = updates[`scoring.batsmenStats.${effectiveOutBatsmanId}.wicketInfo`];
          }

          onUpdateLocal({ ...match, scoring: newLocalScoring });

          // INNINGS END DETECTION
          const isAllOut = newLocalScoring.totalWickets >= (currentBattingSquad?.length || 11) - 1;
          const isInningsOver = (isOverEnd && (scoring.totalOvers + 1) >= maxOvers) || isAllOut;

          // MODAL TRIGGERS
          if (isInningsOver) {
               setShowInningsEndModal(true);
          } else if (effectiveIsWicket) {
               setWicketData({ outBatsman: effectiveOutBatsmanId, details: effectiveWicketInfo }); 
               setShowNewBatsmanModal(true);
          } else if (isOverEnd) {
               setShowNewBowlerModal(true);
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
            .filter(([, s]) => s.wicketInfo && s.wicketInfo.over === currentOverIndex)
            .map(([pid, s]) => ({ pid, ...s.wicketInfo })); // { pid, type, over, ... }

        for (const event of overEvents) {
            const isWicket = event.includes('W');
            const isRetired = event === 'RT';
            const isDismissal = isWicket || isRetired;
            const isWide = event.toLowerCase().includes('wd');
            const isNb = event.toLowerCase().includes('nb');
            
            let runs = parseInt(event.replace(/\D/g, '') || '0');
            
            // 1. Recover Dismissal (If any)
            if (isDismissal) {
                 // The current simStriker is the New Batsman.
                 // We must swap him out for the victim.
                 // We assume New Batsman replaced the Out Batsman (simStriker position).
                 
                 const victim = outBatsmen.pop(); // Take one victim
                 if (victim) {
                     // Restore victim
                     updates[`scoring.batsmenStats.${victim.pid}.wicketInfo`] = deleteField();
                     
                     // Swap active players: simStriker (New) <-> victim (Old)
                     simStriker = victim.pid;

                     if (victim.type !== 'Retired') {
                        netWickets++;
                     }
                 }
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

  const handleNewBowler = async () => {
      if (!selectedNewPlayer) return;
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          
          await updateDoc(matchRef, {
              'scoring.currentBowlerId': selectedNewPlayer,
              'scoring.thisOver': [], 
              'scoring.totalOvers': increment(1),
              [`scoring.bowlerStats.${selectedNewPlayer}`]: scoring.bowlerStats?.[selectedNewPlayer] || { overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 }
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

      } catch (e) {
          console.error(e);
          alert("Error changing bowler: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleEndInnings = async () => {
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          const currentInnings = scoring.currentInnings || 1;
          
          if (currentInnings === 1) {
              const innings1 = {
                  ...scoring,
                  totalOvers: (scoring.totalOvers || 0) + 1, // Final completed overs
              };

              // End 1st innings: Save results to 'innings' array and reset 'scoring' for 2nd innings
              const updates = {
                  'scoring.currentInnings': 2,
                  'innings': arrayUnion(innings1),
                  
                  // Reset for 2nd innings
                  'scoring.totalRuns': 0,
                  'scoring.totalWickets': 0,
                  'scoring.totalOvers': 0,
                  'scoring.thisOver': [],
                  'scoring.battingTeam': scoring.bowlingTeam,
                  'scoring.bowlingTeam': scoring.battingTeam,
                  'scoring.strikerId': deleteField(),
                  'scoring.nonStrikerId': deleteField(),
                  'scoring.currentBowlerId': deleteField(),
                  'scoring.batsmenStats': {},
                  'scoring.bowlerStats': {}
              };

              await updateDoc(matchRef, updates);
              
              // Local update
              const newScoring = {
                  ...scoring,
                  currentInnings: 2,
                  totalRuns: 0,
                  totalWickets: 0,
                  totalOvers: 0,
                  thisOver: [],
                  battingTeam: scoring.bowlingTeam,
                  bowlingTeam: scoring.battingTeam,
                  strikerId: undefined,
                  nonStrikerId: undefined,
                  currentBowlerId: undefined,
                  batsmenStats: {},
                  bowlerStats: {}
              };
              onUpdateLocal({ 
                  ...match, 
                  innings: [...(match.innings || []), innings1],
                  scoring: newScoring 
              });
              
              setShowInningsEndModal(false);
              setWicketData(null); 
              setShowNewBatsmanModal(true); // Prompt for 2nd innings openers
          } else {
              // End of Match (2nd innings)
              await updateDoc(matchRef, { status: 'completed' });
              alert("Match Over!");
              onClose();
          }
      } catch (e) {
          console.error(e);
          alert("Error ending innings");
      } finally {
          setLoading(false);
      }
  };

  const handleNewBatsman = async () => {
      if (!selectedNewPlayer || !wicketData) return;
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          
          // ALWAYS fetch fresh data to avoid state desync if a wicket falls on the last ball
          const freshDoc = await getDoc(matchRef);
          if (!freshDoc.exists()) return;
          const freshData = freshDoc.data();
          const currentScoring = freshData.scoring;

          // Determine which slot the out batsman was in
          const isStrikerOut = wicketData.outBatsman === currentScoring.strikerId;
          const targetSlot = isStrikerOut ? 'strikerId' : 'nonStrikerId';

          const updates = {
              [`scoring.${targetSlot}`]: selectedNewPlayer,
              // Init stats for new player if not exists
              [`scoring.batsmenStats.${selectedNewPlayer}`]: currentScoring.batsmenStats?.[selectedNewPlayer] || { runs: 0, balls: 0, fours: 0, sixes: 0 }
          };

          await updateDoc(matchRef, updates);
          setShowNewBatsmanModal(false);
          setSelectedNewPlayer('');
          
          // Local update
          const newScoring = { 
              ...currentScoring, 
              [targetSlot]: selectedNewPlayer,
              batsmenStats: {
                  ...currentScoring.batsmenStats,
                  [selectedNewPlayer]: currentScoring.batsmenStats?.[selectedNewPlayer] || { runs: 0, balls: 0, fours: 0, sixes: 0 }
              }
          };

          // IF this wicket happened on the last ball of the over, trigger over end swap locally
          const legalBalls = (newScoring.thisOver || []).filter(b => !b.toLowerCase().includes('wd') && !b.toLowerCase().includes('nb')).length;
          const isOverEnd = legalBalls >= 6;
          
          if (isOverEnd) {
              // Rotation for next over happens AFTER new batsman is set
              const nextS = newScoring.nonStrikerId;
              const nextNS = newScoring.strikerId;
              
              newScoring.strikerId = nextS;
              newScoring.nonStrikerId = nextNS;

              // We also need to update this in the DB since handleScoreUpdate skipped it for the wicket
              await updateDoc(matchRef, {
                  'scoring.strikerId': newScoring.strikerId,
                  'scoring.nonStrikerId': newScoring.nonStrikerId
              });

              setShowNewBowlerModal(true);
          }

          onUpdateLocal({ ...match, ...freshData, scoring: newScoring });

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  };

  const handleUndo = async () => {
      if (loading || !scoring.thisOver || scoring.thisOver.length === 0) return;
      
      const lastEvent = scoring.thisOver[scoring.thisOver.length - 1]; 
      const isWicket = lastEvent.includes('W');
      const isRetired = lastEvent === 'RT';
      const isDismissal = isWicket || isRetired;
      
      setLoading(true);
      try {
          const matchRef = doc(db, 'matches', match.id);
          let extraType = null;
          if (lastEvent.toUpperCase().includes('WD')) extraType = 'wd';
          else if (lastEvent.toUpperCase().includes('NB')) extraType = 'nb';
          else if (lastEvent.toUpperCase().includes('LB')) extraType = 'lb';
          else if (lastEvent.toUpperCase().includes('B')) extraType = 'b';
          
          const numPart = lastEvent.replace(/\D/g, '');
          const runs = numPart === '' ? 0 : parseInt(numPart);
          let totalDed = runs;
          if (extraType === 'wd' || extraType === 'nb') totalDed += 1; 

          const updates = {};
          let newStriker = scoring.strikerId;
          let newNonStriker = scoring.nonStrikerId;
          let victimEntry = null;

          // 1. REVERSE DISMISSAL (If applicable)
          if (isDismissal) {
              const currentOverIndex = scoring.totalOvers || 0;
              const currentBallsCount = (scoring.thisOver || []).filter(b => !b.toLowerCase().includes('wd') && !b.toLowerCase().includes('nb')).length;
              
              victimEntry = Object.entries(scoring.batsmenStats || {})
                  .find(([, s]) => s.wicketInfo && s.wicketInfo.over === currentOverIndex && s.wicketInfo.ball === currentBallsCount);
              
              if (victimEntry) {
                  const [victimId, victimStats] = victimEntry;
                  updates[`scoring.batsmenStats.${victimId}.wicketInfo`] = deleteField();
                  
                  if (!isRetired) {
                      updates['scoring.totalWickets'] = increment(-1);
                  }
                  
                  // Restore player to their the correct slot
                  if (victimStats.wicketInfo.wasStriker) {
                      newStriker = victimId;
                  } else {
                      newNonStriker = victimId;
                  }
              }
          }

          // 2. REVERSE ROTATION
          // Note: We reverse rotation based on the runs of the ball we are undoing.
          if (runs % 2 !== 0) {
              const temp = newStriker;
              newStriker = newNonStriker;
              newNonStriker = temp;
          }

          updates['scoring.strikerId'] = newStriker;
          updates['scoring.nonStrikerId'] = newNonStriker;
          updates['scoring.totalRuns'] = increment(-totalDed);
          updates['scoring.thisOver'] = scoring.thisOver.slice(0, -1);

          // 3. STATS REVERSAL
          // We always deduct stats from the person who was STRIKING before rotation reversal
          // But wait, the rotation reversal above gives us the state BEFORE the ball.
          // So newStriker is the person who faced the ball.
          const batRunsDed = (extraType === 'wd') ? 0 : runs;
          const batBallsDed = (extraType === 'wd') ? 0 : 1;
          updates[`scoring.batsmenStats.${newStriker}.runs`] = increment(-batRunsDed);
          updates[`scoring.batsmenStats.${newStriker}.balls`] = increment(-batBallsDed);
          if (runs === 4) updates[`scoring.batsmenStats.${newStriker}.fours`] = increment(-1);
          if (runs === 6) updates[`scoring.batsmenStats.${newStriker}.sixes`] = increment(-1);

          const bowlBallsDed = (extraType === 'wd' || extraType === 'nb') ? 0 : 1;
          const bowlerRunsDed = (extraType === 'b' || extraType === 'lb') ? 0 : totalDed;
          updates[`scoring.bowlerStats.${scoring.currentBowlerId}.runs`] = increment(-bowlerRunsDed);
          updates[`scoring.bowlerStats.${scoring.currentBowlerId}.balls`] = increment(-bowlBallsDed);
          
          // Only decrement bowler wickets if it wasn't a retirement
          const victimIsRetired = victimEntry && victimEntry[1].wicketInfo.type === 'Retired';
          updates[`scoring.bowlerStats.${scoring.currentBowlerId}.wickets`] = increment(isWicket && !victimIsRetired ? -1 : 0);

          await updateDoc(matchRef, updates);
          
          // Re-fetch to be 100% sure for UI
          const fresh = await getDoc(matchRef);
          onUpdateLocal({ id: fresh.id, ...fresh.data() });

      } catch (e) {
          console.error(e);
          alert("Undo failed: " + e.message);
      } finally {
          setLoading(false);
      }
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
  const currentOverBalls = (scoring.thisOver || []).filter(b => !b.toLowerCase().includes('wd') && !b.toLowerCase().includes('nb')).length;
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
         <div className="flex items-center gap-2">
            {canEditToss && (
                <button 
                    onClick={() => setShowTossModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-bg-primary hover:bg-bg-tertiary text-text-secondary rounded-lg transition-colors border border-border font-bold text-xs"
                    title="Correct Toss Mistake"
                >
                    <Disc size={14} /> Toss
                </button>
            )}
            <button 
                onClick={() => setShowScoreboard(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors border border-accent/20 font-bold text-xs"
            >
                <Zap size={14} /> Scoreboard
            </button>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-primary transition-colors border border-transparent hover:border-border">
                <X size={20} className="text-text-secondary" />
            </button>
         </div>
      </div>

      {/* 2. Main Dashboard Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-4">
              
              {/* Score Strip */}
              <div className="bg-bg-secondary rounded-xl p-6 border border-border flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                   
                   {/* Big Score */}
                   <div className="text-center md:text-left">
                       <div className="flex items-center gap-4 justify-center md:justify-start">
                           <div className="text-5xl font-bold tracking-tight text-text-primary tabular-nums">
                               {scoring.totalRuns}/{scoring.totalWickets}
                           </div>
                           {scoring.currentInnings === 2 && match.innings?.[0] && (
                               <div className="flex flex-col border-l border-border pl-4">
                                   <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Target</span>
                                   <span className="text-xl font-bold text-accent tabular-nums">{match.innings[0].totalRuns + 1}</span>
                               </div>
                           )}
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
                            
                            {(activeExtraType === 'nb') && (
                                <button 
                                    onClick={() => { handleScoreUpdate(6, true, activeExtraType); setActiveExtraType(null); }} 
                                    className="h-12 col-span-2 flex items-center justify-center gap-2 bg-purple-600 font-black text-white rounded-lg shadow-lg transition-all active:scale-95"
                                >
                                    <Trophy size={14} /> +6 Boundary
                                </button>
                            )}
                            
                            {(activeExtraType === 'wd' || activeExtraType === 'b' || activeExtraType === 'lb') && (
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
                        disabled={activeExtraType === 'wd' || activeExtraType === 'b' || activeExtraType === 'lb'}
                        className={`h-12 font-black text-lg rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-lg ${
                            activeExtraType 
                            ? (activeExtraType === 'nb' ? 'bg-orange-500 shadow-orange-500/20' : 
                               (activeExtraType === 'wd' || activeExtraType === 'lb' || activeExtraType === 'b') ? 'bg-bg-tertiary opacity-50 cursor-not-allowed' :
                               'bg-purple-600 shadow-purple-600/20')
                            : 'bg-purple-600 shadow-purple-600/20'
                        } text-white`}
                    >
                        {activeExtraType === 'nb' ? '+6' : '6'}
                    </button>
                   <button 
                        onClick={() => {
                           setWicketDetails({ type: 'Bowled', fielder: '', fielder2: '', who: scoring.strikerId });
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

       {/* --- TOSS MODAL (CORRECTION) --- */}
       <TossModal 
            isOpen={showTossModal}
            onClose={() => setShowTossModal(false)}
            match={match}
            onSave={handleSaveToss}
       />

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
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-text-tertiary mb-1 uppercase tracking-wider">
                                            {wicketDetails.type === 'Run Out' ? 'Throw by' : 'Fielder'}
                                        </label>
                                        <select 
                                            className="w-full p-3 bg-bg-primary rounded-lg border border-border text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 sm:text-sm"
                                            value={wicketDetails.fielder}
                                            onChange={(e) => setWicketDetails({...wicketDetails, fielder: e.target.value})}
                                        >
                                            <option value="">Select Fielder</option>
                                            {getPlayers(currentBowlingSquad).map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {wicketDetails.type === 'Run Out' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-text-tertiary mb-1 uppercase tracking-wider">Stumped by / Assisted</label>
                                            <select 
                                                className="w-full p-3 bg-bg-primary rounded-lg border border-border text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 sm:text-sm"
                                                value={wicketDetails.fielder2}
                                                onChange={(e) => setWicketDetails({...wicketDetails, fielder2: e.target.value})}
                                            >
                                                <option value="">Select Fielder</option>
                                                {getPlayers(currentBowlingSquad).map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
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

       {/* --- INNINGS END MODAL --- */}
       <AnimatePresence>
            {showInningsEndModal && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-sm bg-bg-secondary rounded-2xl shadow-2xl overflow-hidden border border-border text-center">
                        <div className="p-8">
                            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trophy size={40} className="text-accent" />
                            </div>
                            <h2 className="text-2xl font-black text-text-primary uppercase tracking-tighter mb-2">Innings Complete!</h2>
                            <p className="text-text-secondary text-sm mb-8">
                                {scoring.currentInnings === 1 
                                    ? `First innings finished with ${scoring.totalRuns}/${scoring.totalWickets}. Ready to start the second innings?`
                                    : "Match has concluded. View the final result in the scoreboard."
                                }
                            </p>
                            
                            <div className="space-y-3">
                                <button
                                    onClick={handleEndInnings}
                                    className="w-full py-4 bg-accent text-white font-black rounded-xl hover:opacity-90 shadow-lg shadow-accent/20 transition-all uppercase tracking-widest"
                                >
                                    {scoring.currentInnings === 1 ? 'Start 2nd Innings' : 'Complete Match'}
                                </button>
                                <button
                                    onClick={() => setShowInningsEndModal(false)}
                                    className="w-full py-3 bg-bg-primary text-text-tertiary font-bold rounded-lg hover:text-text-primary transition-colors"
                                >
                                    Back to Scoring (Undo/Fix)
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
       </AnimatePresence>

       <ScoreboardModal 
            isOpen={showScoreboard}
            onClose={() => setShowScoreboard(false)}
            match={match}
            users={users}
       />

    </div>
  );
}

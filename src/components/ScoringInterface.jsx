import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, AlertTriangle, Play, Save, Circle, Undo2, UserPlus, ArrowLeftRight } from 'lucide-react';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore'; 
import { db } from '../firebase';

export default function ScoringInterface({ isOpen, match, users, onClose, onUpdateLocal }) {
  if (!isOpen || !match) return null;

  const { scoring } = match;
  const [loading, setLoading] = useState(false);
  
  // Modals for Wicket/Over
  const [showWicketDetailsModal, setShowWicketDetailsModal] = useState(false);
  const [wicketDetails, setWicketDetails] = useState({ type: 'Bowled', fielder: '', who: '' }); // type, fielder, who
  const [showNewBatsmanModal, setShowNewBatsmanModal] = useState(false);
  const [showNewBowlerModal, setShowNewBowlerModal] = useState(false);
  const [selectedNewPlayer, setSelectedNewPlayer] = useState(''); // For both modals
  const [wicketData, setWicketData] = useState(null); // To store wicket context if needed

  // Derived Values
  const getPlayers = (ids) => {
      return (ids || []).map(id => {
          const u = users?.find(user => user.uid === id || user.id === id);
          return u ? { id, name: u.name } : { id, name: 'Unknown' };
      });
  };

  const battingTeamIds = scoring.battingTeam === 'team1' ? match.team1 : match.team2;
  const bowlingTeamIds = scoring.bowlingTeam === 'team1' ? match.team1 : match.team2; // Corrected logic? Setup modal uses team1/team2 keys correctly.
  
  // Need to ensure we use correct teams. Scoring object has battingTeam: 'team1'
  const isTeam1Batting = scoring.battingTeam === 'team1';
  // If team1 is batting, team2 is bowling.
  
  const currentBattingSquad = isTeam1Batting ? match.team1 : match.team2;
  const currentBowlingSquad = isTeam1Batting ? match.team2 : match.team1;

  if (!scoring) return null;

  const getName = (id) => users?.find(u => u.uid === id || u.id === id)?.name || 'Unknown';

  // --- LOGIC ---

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
             }
          }
          
          // Construct updates
          const updates = {};
          
          // 1. Total Score
          updates['scoring.totalRuns'] = increment(totalRunsAdd);
          updates['scoring.thisOver'] = arrayUnion(
              isWicket ? 'W' : 
              ((runs > 0 ? runs : '') + (extraType ? extraType.toUpperCase() : runs === 0 ? '0' : ''))
          );

          // 2. Strike Rotation (Odd runs)
          // Run based rotation
          if (runs % 2 !== 0) {
              // Swap logic: update keys in DB.
              // Note: We need to swap the localized striker/non-striker for subsequent logic? 
              // Actually, simply updating DB is enough, the UI will reflect.
              // BUT for local optimistic update, we need to know.
               updates['scoring.strikerId'] = nonStrikerId;
               updates['scoring.nonStrikerId'] = strikerId;
          }
          
          // 3. Batsman Stats (Attrib to Striker)
          // Wides: runs go to extras, not batsman. 
          // NB: Bat runs go to batsman. 
          // Byes/Legbyes: Runs to extras (not implemented yet, assuming all runs are bat runs for now unless 'wd'/'nb')
          
          if (extraType !== 'wd') {
               // Runs logic: If NB, runs count to batsman.
               updates[`scoring.batsmenStats.${strikerId}.runs`] = increment(runs);
               updates[`scoring.batsmenStats.${strikerId}.balls`] = increment(ballsFacedAdd);
               
               if (runs === 4) updates[`scoring.batsmenStats.${strikerId}.fours`] = increment(1);
               if (runs === 6) updates[`scoring.batsmenStats.${strikerId}.sixes`] = increment(1);
          }

          // 4. Bowler Stats
          updates[`scoring.bowlerStats.${bowlerId}.runs`] = increment(totalRunsAdd);
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
                      over: Math.floor((scoring.bowlerStats?.[bowlerId]?.balls || 0) / 6),
                      ball: ((scoring.bowlerStats?.[bowlerId]?.balls || 0) % 6) + 1
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
               // Determine who is out for the UI context
               // Default was strikerId, but now might be outBatsmanId
               setWicketData({ 
                   outBatsman: outBatsmanId,
                   details: wicketInfo 
               }); 
               
               setShowNewBatsmanModal(true);
          } else if (isOverEnd) {
               // Over End Logic: 
               // 1. Swap Ends (Striker <-> NonStriker)
               // 2. Clear thisOver array? (Or keep history - setup modal initialized it as array. Maybe we create 'lastOver'?)
               // 3. Open New Bowler Modal
               
               // We need to apply the swap update to DB immediately for the over end?
               // Wait, we just did updates. We should do another update for swap?
               // Strike rotation at OVER END:
               const newStriker = runs % 2 !== 0 ? strikerId : nonStrikerId; // If runs odd, they already swapped. So current striker is the one who RAN to striker end.
               // At end of over, they swap ends.
               // So if runs odd (1): A runs, B runs. A is now at non-striker end physically? No.
               // Standard: Odd run -> Swap. End of over -> Swap ends? No, end of over means bowling changes end. The batsmen stay put physically, but the striker Changes.
               // So effectively: New Striker = Current Non-Striker.
               
               // Logic:
               // If runs even: No swap during run. End of over: Striker becomes Non-Striker.
               // If runs odd: Swap during run. Striker is now B. End of over: Striker becomes A (who is at Non-Striker end).
               // Result: Always swap at end of over relative to who faced last ball? Yes.
               
               const swapRef = doc(db, 'matches', match.id);
               await updateDoc(swapRef, {
                   'scoring.strikerId': runs % 2 !== 0 ? strikerId : nonStrikerId, // Inverse of what it is now
                   'scoring.nonStrikerId': runs % 2 !== 0 ? nonStrikerId : strikerId,
                   'scoring.thisOver': [] // Clear over for next
               });
               
               setShowNewBowlerModal(true);
          }

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
              const rotatedStriker = newLocalScoring.strikerId;
              const rotatedNonStriker = newLocalScoring.nonStrikerId;
              
              newLocalScoring.strikerId = rotatedNonStriker; // Swap
              newLocalScoring.nonStrikerId = rotatedStriker;
              newLocalScoring.thisOver = []; // Clear for local view too
          }
          
          onUpdateLocal({ ...match, scoring: newLocalScoring });

      } catch (e) {
          console.error(e);
          alert("Error updating score");
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
          updates[`scoring.bowlerStats.${scoring.currentBowlerId}.runs`] = increment(-totalDed);
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
          await updateDoc(matchRef, {
              'scoring.currentBowlerId': selectedNewPlayer,
              'scoring.thisOver': [], // Start fresh over
              'scoring.totalOvers': increment(1) // Completed an over
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


  return (
    <div className="fixed inset-0 z-[60] bg-navy-950 flex flex-col overflow-hidden font-sans">
      
      {/* --- HEADER --- */}
      <div className="px-5 py-4 bg-navy-900 border-b border-navy-800 flex justify-between items-center shrink-0 shadow-md">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                  {/* LOGO PLACEHOLDER - Replace with actual img if available */}
                  <Trophy className="text-cricket-gold" size={20} />
              </div>
              <div className="leading-tight">
                   <div className="text-[10px] text-navy-100/40 font-bold uppercase tracking-widest">
                       {scoring.battingTeam === 'team1' ? '1st Innings' : '2nd Innings'}
                   </div>
                   <h3 className="text-white font-bold text-lg">
                      {isTeam1Batting ? 'Spartans' : 'Warriors'} v {isTeam1Batting ? 'Warriors' : 'Spartans'}
                   </h3>
              </div>
          </div>
          <button onClick={onClose} className="p-2 bg-navy-800 rounded-full text-navy-100 hover:text-white transition-colors">
              <X size={20} />
          </button>
      </div>

      {/* --- SCORE CARD --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Main Score Display */}
          <div className="bg-gradient-to-br from-navy-800 to-navy-900 rounded-2xl p-6 border border-navy-700 shadow-xl relative overflow-hidden">
               {/* Background Pattern */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-cricket-gold/5 rounded-full blur-3xl -mr-10 -mt-10" />
               
               <div className="flex items-baseline justify-between relative z-10">
                   <div>
                       <div className="flex items-baseline gap-2">
                           <span className="text-7xl font-black text-white tracking-tighter shadow-black drop-shadow-lg">
                               {scoring.totalRuns}/{scoring.totalWickets}
                           </span>
                           <span className="text-xl font-bold text-navy-100/50">
                               in {Math.floor((scoring.bowlerStats?.[scoring.currentBowlerId]?.balls || 0) + (scoring.totalOvers*6 || 0) / 6)}.{ (scoring.bowlerStats?.[scoring.currentBowlerId]?.balls || 0) % 6 } Ov
                               {/* Note: totalOvers logic is tricky if we don't track completed overs accurately. 
                                   Currently just tracking bowler balls. Need global ball count? 
                                   Simplification: Just show bowler balls for now + maybe total overs from DB if saved. 
                                   Actually we save totalOvers only? 
                                   Let's rely on calculating total legal balls from ALL bowlers stats?
                                   Hard. Let's just assume User interaction is source of truth.
                               */}
                           </span>
                       </div>
                       <div className="mt-2 flex items-center gap-2">
                           <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">Live</span>
                           <span className="text-xs text-navy-100/40 font-bold uppercase tracking-wider">
                               CRR {((scoring.totalRuns/(Math.max(1, ((scoring.totalOvers || 0)*6 + (scoring.thisOver?.length||0))/6))).toFixed(2))}
                           </span>
                       </div>
                   </div>
                   
                   <div className="text-right">
                        <div className="text-[10px] text-navy-100/40 font-bold uppercase tracking-widest mb-1">Last Balls</div>
                        <div className="flex gap-1 justify-end">
                            {(scoring.thisOver || []).map((ball, i) => (
                                <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold border ${
                                    ball === 'W' ? 'bg-red-500 text-white border-red-400' :
                                    ball === '4' ? 'bg-indigo-500 text-white border-indigo-400' :
                                    ball === '6' ? 'bg-purple-500 text-white border-purple-400' :
                                    'bg-navy-950 text-white border-navy-700'
                                }`}>
                                    {ball}
                                </div>
                            ))}
                            {(!scoring.thisOver || scoring.thisOver.length === 0) && (
                                <span className="text-navy-100/20 text-xs">New Over</span>
                            )}
                        </div>
                   </div>
               </div>
          </div>

          {/* Batsmen Table */}
          <div className="bg-navy-900 rounded-xl border border-navy-800 overflow-hidden">
               <div className="bg-navy-950/50 px-4 py-2 flex justify-between items-center border-b border-navy-800/50">
                   <span className="text-[10px] font-bold text-navy-100/40 uppercase tracking-widest">Batting Scorecard</span>
                   <div className="text-[10px] font-bold text-navy-100/40 uppercase tracking-widest flex gap-4 pr-1">
                       <span className="w-8 text-right">R</span>
                       <span className="w-8 text-right">B</span>
                       <span className="w-8 text-right">4s</span>
                       <span className="w-8 text-right">6s</span>
                   </div>
               </div>
               
               <div className="max-h-60 overflow-y-auto">
                 {(currentBattingSquad || []).map(playerId => {
                     const stats = scoring.batsmenStats?.[playerId];
                     // Show if they have stats OR are current striker/non-striker
                     const isStriker = playerId === scoring.strikerId;
                     const isNonStriker = playerId === scoring.nonStrikerId;
                     // Show everyone who has batted or is batting.
                     // Filter out those who haven't batted (no stats) unless user wants FULL squad?
                     // User said: "show all the batsman and not the ones who is just on the field"
                     // Implies full list or at least full scorecard. Let's show full squad but dim ones who haven't batted.
                     
                     const hasBatted = !!stats || isStriker || isNonStriker;
                     
                     if (!hasBatted) return null; // Only show players who have stats or are in middle

                     return (
                       <div key={playerId} className={`px-4 py-2 flex justify-between items-center border-b border-navy-800/30 ${
                           isStriker ? 'bg-green-500/10 border-l-2 border-l-green-500' : 
                           isNonStriker ? 'bg-white/5' : ''
                       }`}>
                            <div className={`flex items-center gap-2 font-bold ${
                                isStriker ? 'text-yellow-400' : 
                                isNonStriker ? 'text-white/80' : 'text-navy-100/40'
                            }`}>
                                 {isStriker && <Play size={10} className="fill-green-500 text-green-500" />}
                                 {getName(playerId)}
                                 {isStriker && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded ml-1">*</span>}
                            </div>
                            <div className={`flex gap-4 font-mono text-sm pr-1 ${
                                isStriker ? 'text-yellow-400' : 'text-navy-100'
                            }`}>
                                <span className="w-8 text-right font-bold">{stats?.runs || 0}</span>
                                <span className="w-8 text-right opacity-60">{stats?.balls || 0}</span>
                                <span className="w-8 text-right opacity-40">{stats?.fours || 0}</span>
                                <span className="w-8 text-right opacity-40">{stats?.sixes || 0}</span>
                            </div>
                       </div>
                     );
                 })}
                 {/* Show specific message if roster empty or something */}
               </div>
               
               {/* Show 'Yet to Bat' summary maybe? */}
               <div className="px-4 py-2 bg-navy-950/30 text-[10px] text-navy-100/20 font-bold uppercase tracking-widest">
                   Yet to Bat: { (currentBattingSquad || []).filter(id => !scoring.batsmenStats?.[id] && id !== scoring.strikerId && id !== scoring.nonStrikerId).length } players
               </div>
          </div>

          {/* Bowler Card */}
          <div className="bg-navy-900 rounded-xl border border-navy-800 p-4 flex justify-between items-center">
               <div>
                   <div className="text-[10px] font-bold text-navy-100/40 uppercase tracking-widest mb-1">Bowling</div>
                   <div className="font-bold text-white text-lg">{getName(scoring.currentBowlerId)}</div>
               </div>
               <div className="flex gap-6">
                   <div className="text-center">
                       <div className="text-[10px] font-bold text-navy-100/40 uppercase">Overs</div>
                       <div className="font-mono font-bold text-white text-xl">
                           {Math.floor((scoring.bowlerStats?.[scoring.currentBowlerId]?.balls || 0) / 6)}.{ (scoring.bowlerStats?.[scoring.currentBowlerId]?.balls || 0) % 6 }
                       </div>
                   </div>
                   <div className="text-center">
                       <div className="text-[10px] font-bold text-navy-100/40 uppercase">Runs</div>
                       <div className="font-mono font-bold text-white text-xl">{scoring.bowlerStats?.[scoring.currentBowlerId]?.runs || 0}</div>
                   </div>
                   <div className="text-center">
                       <div className="text-[10px] font-bold text-navy-100/40 uppercase">Wkts</div>
                       <div className="font-mono font-bold text-white text-xl">{scoring.bowlerStats?.[scoring.currentBowlerId]?.wickets || 0}</div>
                   </div>
               </div>
          </div>
      </div>

      {/* --- CONTROL PAD --- */}
      <div className="bg-navy-900 border-t border-navy-800 p-4 pb-8 shrink-0">
          <div className="max-w-md mx-auto space-y-3">
              {/* Runs Row */}
              <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map(run => (
                      <button
                        key={run}
                        onClick={() => handleScoreUpdate(run)}
                        disabled={loading}
                        className="h-14 rounded-xl bg-navy-800 text-white font-bold text-xl hover:bg-navy-700 active:scale-95 transition-all shadow-md"
                      >
                          {run}
                      </button>
                  ))}
              </div>
              
              {/* Boundaries & Extras Row */}
              <div className="grid grid-cols-5 gap-2">
                   <button
                        onClick={() => handleScoreUpdate(4)}
                        disabled={loading}
                        className="h-14 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-600/50 font-black text-xl hover:bg-indigo-600/30 active:scale-95 transition-all shadow-md"
                   >
                       4
                   </button>
                   <button
                        onClick={() => handleScoreUpdate(6)}
                        disabled={loading}
                        className="h-14 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-600/50 font-black text-xl hover:bg-purple-600/30 active:scale-95 transition-all shadow-md"
                   >
                       6
                   </button>
                   <button
                       onClick={handleUndo}
                       disabled={loading || !scoring.thisOver || scoring.thisOver.length === 0}
                       className="h-14 rounded-xl bg-navy-800 text-navy-200 border border-navy-600 font-bold active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                   >
                       <Undo2 size={24} />
                   </button>
                   <button
                       onClick={() => handleScoreUpdate(0, true, 'wd')}
                       disabled={loading}
                       className="h-14 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold active:scale-95 transition-all"
                   >
                       WD
                   </button>
                   <button
                       onClick={() => handleScoreUpdate(0, true, 'nb')}
                       disabled={loading}
                       className="h-14 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 font-bold active:scale-95 transition-all"
                   >
                       NB
                   </button>
              </div>

               {/* BIG ACTIONS */}
              <div className="grid grid-cols-2 gap-2">
                   <button
                       onClick={() => {
                           setWicketDetails({ type: 'Bowled', fielder: '', who: scoring.strikerId });
                           setShowWicketDetailsModal(true);
                       }}
                       disabled={loading}
                       className="h-12 rounded-xl bg-red-500 text-white font-bold tracking-widest uppercase shadow-lg shadow-red-900/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                   >
                       <X size={18} strokeWidth={4} /> WICKET
                   </button>
                   
                   <button
                       onClick={() => setShowNewBowlerModal(true)} // Manual over end trigger option?
                       className="h-12 rounded-xl bg-navy-800 text-navy-100 font-bold tracking-widest uppercase border border-navy-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                   >
                        <UserPlus size={18} /> Swap Ends
                   </button>
              </div>
          </div>
      </div>

       {/* --- NEW BATSMAN MODAL --- */}
       <AnimatePresence>
            {showNewBatsmanModal && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-sm bg-navy-900 rounded-2xl border border-navy-800 overflow-hidden shadow-2xl relative">
                        {/* Close button for Wicket modal per user request */}
                        <button 
                            onClick={() => setShowNewBatsmanModal(false)}
                            className="absolute top-2 right-2 p-2 rounded-full bg-navy-950/50 text-white hover:bg-navy-800 transition-colors z-10"
                        >
                            <X size={16} />
                        </button>

                        <div className="p-4 border-b border-navy-800 bg-red-500/10">
                            <h3 className="text-red-500 font-black uppercase tracking-widest text-center text-lg">Wicket Fall!</h3>
                            <p className="text-center text-navy-100/60 text-xs mt-1">
                                {getName(wicketData?.outBatsman)} is out.
                                {wicketData?.details && (
                                    <span className="block mt-1 font-mono text-white/50">
                                        {wicketData.details.type}
                                        {wicketData.details.fielder ? ` c ${getName(wicketData.details.fielder)}` : ''} b {getName(scoring.currentBowlerId)}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-bold text-navy-100/40 mb-2 uppercase">Select New Batsman</label>
                            <select 
                                className="w-full p-4 bg-navy-950 rounded-xl border border-navy-700 text-white mb-4"
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
                                className="w-full py-4 bg-white text-navy-950 font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
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
                    className="fixed inset-0 z-[70] bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-sm bg-navy-900 rounded-2xl border border-navy-800 overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-navy-800 bg-red-500/10 flex justify-between items-center">
                            <h3 className="text-red-500 font-black uppercase tracking-widest text-lg">Wicket Details</h3>
                            <button 
                                onClick={() => setShowWicketDetailsModal(false)}
                                className="p-1 rounded-full bg-navy-950/50 text-white hover:bg-navy-800"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            
                            {/* Who out? */}
                            <div>
                                <label className="block text-xs font-bold text-navy-100/40 mb-2 uppercase">Who is Out?</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setWicketDetails({...wicketDetails, who: scoring.strikerId})}
                                        className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                                            wicketDetails.who === scoring.strikerId 
                                            ? 'bg-red-500 border-red-500 text-white' 
                                            : 'bg-navy-950 border-navy-700 text-navy-100'
                                        }`}
                                    >
                                        {getName(scoring.strikerId)} (Striker)
                                    </button>
                                    <button 
                                        onClick={() => setWicketDetails({...wicketDetails, who: scoring.nonStrikerId})}
                                        className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                                            wicketDetails.who === scoring.nonStrikerId 
                                            ? 'bg-red-500 border-red-500 text-white' 
                                            : 'bg-navy-950 border-navy-700 text-navy-100'
                                        }`}
                                    >
                                        {getName(scoring.nonStrikerId)} (Non-Str)
                                    </button>
                                </div>
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-xs font-bold text-navy-100/40 mb-2 uppercase">Dismissal Type</label>
                                <select 
                                    className="w-full p-3 bg-navy-950 rounded-lg border border-navy-700 text-white"
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
                                    <label className="block text-xs font-bold text-navy-100/40 mb-2 uppercase">Fielder involved</label>
                                    <select 
                                        className="w-full p-3 bg-navy-950 rounded-lg border border-navy-700 text-white"
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
                                className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 transition-colors shadow-lg shadow-red-900/40 mt-2"
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
                    className="fixed inset-0 z-[70] bg-navy-950/70 backdrop-blur-sm flex items-center justify-center p-6"
                >
                    <div className="w-full max-w-sm bg-navy-900 rounded-2xl border border-navy-800 overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-navy-800 bg-indigo-500/10">
                            <h3 className="text-indigo-400 font-black uppercase tracking-widest text-center text-lg">Over Complete</h3>
                            <p className="text-center text-navy-100/60 text-xs mt-1">Select next bowler</p>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-bold text-navy-100/40 mb-2 uppercase">Select Bowler</label>
                            <select 
                                className="w-full p-4 bg-navy-950 rounded-xl border border-navy-700 text-white mb-4"
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
                                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50"
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

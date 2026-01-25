import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Shield, Play } from 'lucide-react';

export default function ScoringSetupModal({ isOpen, onClose, match, users, onStartScoring }) {
  const [striker, setStriker] = useState('');
  const [nonStriker, setNonStriker] = useState('');
  const [bowler, setBowler] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !match) return null;

  // Determine Batting and Bowling Teams
  // tossWinner: 'team1' or 'team2'
  // tossChoice: 'bat' or 'bowl'
  const isTeam1Batting = (match.tossWinner === 'team1' && match.tossChoice === 'bat') || 
                         (match.tossWinner === 'team2' && match.tossChoice === 'bowl');
  
  const battingTeamIds = isTeam1Batting ? match.team1 : match.team2;
  const bowlingTeamIds = isTeam1Batting ? match.team2 : match.team1;

  const battingTeamName = isTeam1Batting ? 'Spartans' : 'Warriors'; // Simplified naming based on app context
  const bowlingTeamName = isTeam1Batting ? 'Warriors' : 'Spartans';

// Helper to get user objects
  const getPlayers = (ids) => {
      return (ids || []).map(id => {
          const u = users.find(user => user.uid === id || user.id === id);
          return u ? { id, name: u.name } : { id, name: 'Unknown' };
      });
  };

  const battingPlayers = getPlayers(battingTeamIds);
  const bowlingPlayers = getPlayers(bowlingTeamIds);

  const handleSubmit = async () => {
      if (!striker || !nonStriker || !bowler) return;
      if (striker === nonStriker) {
          alert("Striker and Non-Striker cannot be the same person!");
          return;
      }

      setIsSubmitting(true);
      try {
          await onStartScoring(match.id, {
               status: 'active',
               scoring: {
                   currentInnings: 1,
                   battingTeam: isTeam1Batting ? 'team1' : 'team2', // ID of team usually, but using key for now
                   bowlingTeam: isTeam1Batting ? 'team2' : 'team1',
                   totalRuns: 0,
                   totalWickets: 0,
                   totalOvers: 0,
                   thisOver: [], // Ball by ball for current over
                   strikerId: striker,
                   nonStrikerId: nonStriker,
                   currentBowlerId: bowler,
                   batsmenStats: {
                       [striker]: { runs: 0, balls: 0, fours: 0, sixes: 0 },
                       [nonStriker]: { runs: 0, balls: 0, fours: 0, sixes: 0 }
                   },
                   bowlerStats: {
                       [bowler]: { overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 }
                   }
               }
          });
          onClose();
      } catch (error) {
          console.error(error);
          alert("Failed to start scoring");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg-secondary w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border bg-bg-primary/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Play className="text-success" size={20} />
            Start Innings
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-full text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
            
            {/* Batting Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-text-tertiary uppercase tracking-wider">
                    <Shield size={14} className="text-accent" />
                    Batting: <span className="text-text-primary">{battingTeamName}</span>
                </div>
                
                <div className="grid gap-4">
                    <div>
                        <label className="block text-xs font-bold text-text-tertiary mb-1.5 uppercase tracking-wider">Striker</label>
                        <select 
                            value={striker}
                            onChange={(e) => setStriker(e.target.value)}
                            className="w-full p-3 bg-bg-primary rounded-xl border border-border text-text-primary focus:border-accent focus:outline-none transition-colors appearance-none"
                        >
                            <option value="">Select Striker</option>
                            {battingPlayers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-tertiary mb-1.5 uppercase tracking-wider">Non-Striker</label>
                        <select 
                            value={nonStriker}
                            onChange={(e) => setNonStriker(e.target.value)}
                            className="w-full p-3 bg-bg-primary rounded-xl border border-border text-text-primary focus:border-accent focus:outline-none transition-colors appearance-none"
                        >
                            <option value="">Select Non-Striker</option>
                            {battingPlayers.map(p => (
                                <option key={p.id} value={p.id} disabled={p.id === striker}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="h-px bg-border" />

            {/* Bowling Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-text-tertiary uppercase tracking-wider">
                    <User size={14} className="text-accent" />
                    Opening Bowler: <span className="text-text-primary">{bowlingTeamName}</span>
                </div>
                
                <div>
                     <select 
                        value={bowler}
                        onChange={(e) => setBowler(e.target.value)}
                        className="w-full p-3 bg-bg-primary rounded-xl border border-border text-text-primary focus:border-accent focus:outline-none transition-colors appearance-none"
                    >
                        <option value="">Select Bowler</option>
                        {bowlingPlayers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <button
                disabled={!striker || !nonStriker || !bowler || isSubmitting}
                onClick={handleSubmit}
                className="w-full py-4 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
            >
                {isSubmitting ? 'Starting...' : 'Start Scoring'}
            </button>
        </div>
      </motion.div>
    </div>
  );
}

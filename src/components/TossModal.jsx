import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Disc } from 'lucide-react';

export default function TossModal({ isOpen, onClose, match, onSave }) {
  const [winner, setWinner] = useState(null); // 'team1' or 'team2'
  const [choice, setChoice] = useState(null); // 'bat' or 'bowl'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with match data when opening for correction
  useEffect(() => {
    if (isOpen && match) {
      setWinner(match.tossWinner || null);
      setChoice(match.tossChoice || null);
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const handleSave = async () => {
      if (!winner || !choice) return;
      setIsSubmitting(true);
      try {
          // Determine team name for display/storage consistency
          const winnerTeamName = winner === 'team1' ? 'Spartans' : 'Warriors'; // Hardcoded for now based on app convention
          await onSave(match.id, {
              tossWinner: winner, // 'team1' or 'team2'
              tossWinnerName: winnerTeamName, 
              tossChoice: choice
          });
          onClose();
      } catch (e) {
          console.error(e);
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
        className="bg-bg-secondary w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border bg-bg-primary/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Disc className="text-accent" size={20} />
            Coin Toss
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-full text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
            {/* Who Won? */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Who won the toss?</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setWinner('team1')}
                        className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                            winner === 'team1' 
                            ? 'border-team1 bg-team1/10 text-team1' 
                            : 'border-border bg-bg-primary text-text-tertiary hover:border-team1/50 hover:text-team1'
                        }`}
                    >
                        Spartans
                    </button>
                    <button
                        onClick={() => setWinner('team2')}
                        className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                            winner === 'team2' 
                            ? 'border-team2 bg-team2/10 text-team2' 
                            : 'border-border bg-bg-primary text-text-tertiary hover:border-team2/50 hover:text-team2'
                        }`}
                    >
                        Warriors
                    </button>
                </div>
            </div>

            {/* Elected To? */}
            <AnimatePresence>
                {winner && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3 overflow-hidden"
                    >
                        <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider">
                            {winner === 'team1' ? 'Spartans' : 'Warriors'} elected to?
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setChoice('bat')}
                                className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                    choice === 'bat' 
                                    ? 'border-accent bg-accent/10 text-accent' 
                                    : 'border-border bg-bg-primary text-text-tertiary hover:border-accent/50 hover:text-accent'
                                }`}
                            >
                                Bat 🏏
                            </button>
                            <button
                                onClick={() => setChoice('bowl')}
                                className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                    choice === 'bowl' 
                                    ? 'border-accent bg-accent/10 text-accent' 
                                    : 'border-border bg-bg-primary text-text-tertiary hover:border-accent/50 hover:text-accent'
                                }`}
                            >
                                Bowl 🥎
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Save Action */}
            <button
                disabled={!winner || !choice || isSubmitting}
                onClick={handleSave}
                className="w-full py-4 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
            >
                {isSubmitting ? 'Recording...' : 'Record Toss Result'}
            </button>
        </div>
      </motion.div>
    </div>
  );
}

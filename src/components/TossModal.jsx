import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Disc } from 'lucide-react';

export default function TossModal({ isOpen, onClose, match, onSave }) {
  const [winner, setWinner] = useState(null); // 'team1' or 'team2'
  const [choice, setChoice] = useState(null); // 'bat' or 'bowl'
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-navy-900 w-full max-w-sm rounded-2xl shadow-2xl border border-navy-800 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-navy-800 bg-navy-950/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-navy-100 flex items-center gap-2">
            <Disc className="text-cricket-gold" size={20} />
            Coin Toss
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-full text-navy-100/50 hover:text-navy-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
            {/* Who Won? */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-navy-100/60 uppercase tracking-wider">Who won the toss?</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setWinner('team1')}
                        className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                            winner === 'team1' 
                            ? 'border-red-500 bg-red-500/10 text-red-500' 
                            : 'border-navy-800 bg-navy-950 text-navy-100/40 hover:border-red-500/50 hover:text-red-400'
                        }`}
                    >
                        Spartans
                    </button>
                    <button
                        onClick={() => setWinner('team2')}
                        className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                            winner === 'team2' 
                            ? 'border-blue-500 bg-blue-500/10 text-blue-500' 
                            : 'border-navy-800 bg-navy-950 text-navy-100/40 hover:border-blue-500/50 hover:text-blue-400'
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
                        <label className="text-xs font-bold text-navy-100/60 uppercase tracking-wider">
                            {winner === 'team1' ? 'Spartans' : 'Warriors'} elected to?
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setChoice('bat')}
                                className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                    choice === 'bat' 
                                    ? 'border-cricket-gold bg-cricket-gold/10 text-cricket-gold' 
                                    : 'border-navy-800 bg-navy-950 text-navy-100/40 hover:border-cricket-gold/50 hover:text-cricket-gold'
                                }`}
                            >
                                Bat 🏏
                            </button>
                            <button
                                onClick={() => setChoice('bowl')}
                                className={`p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                                    choice === 'bowl' 
                                    ? 'border-cricket-gold bg-cricket-gold/10 text-cricket-gold' 
                                    : 'border-navy-800 bg-navy-950 text-navy-100/40 hover:border-cricket-gold/50 hover:text-cricket-gold'
                                }`}
                            >
                                Bowl 🥎
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                disabled={!winner || !choice || isSubmitting}
                onClick={handleSave}
                className="w-full py-3 bg-cricket-gold text-navy-950 rounded-xl font-bold text-sm hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting ? 'Recording...' : 'Record Toss Result'}
            </button>
        </div>
      </motion.div>
    </div>
  );
}

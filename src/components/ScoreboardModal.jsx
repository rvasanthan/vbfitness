import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, User, Target, Zap } from 'lucide-react';

export default function ScoreboardModal({ isOpen, onClose, match, users }) {
  const [activeTab, setActiveTab] = useState('innings1'); // innings1, innings2

  if (!isOpen || !match) return null;

  const { scoring } = match;
  const getName = (id) => users?.find(u => u.uid === id || u.id === id)?.name || 'Unknown';

  // Determine who batted first based on Toss
  const isTeam1BattingFirst = (match.tossWinner === 'team1' && match.tossChoice === 'bat') || 
                               (match.tossWinner === 'team2' && match.tossChoice === 'bowl');
  
  const innings1TeamId = isTeam1BattingFirst ? 'team1' : 'team2';
  const innings2TeamId = isTeam1BattingFirst ? 'team2' : 'team1';

  const teamNames = {
      team1: 'Spartans',
      team2: 'Warriors'
  };

  // Determine current innings and previous innings
  // Since the current schema seems to only have match.scoring, 
  // we'll assume match.scoring is the 'current' innings being played.
  // If there's an 'innings' array, we use that.
  const inningsList = match.innings || (scoring ? [scoring] : []);
  
  const getInningsData = (battingTeamId) => {
      // Find innings where this team batted
      let data = inningsList.find(i => i.battingTeam === battingTeamId);
      
      // If none found but they ARE the current batting team in match.scoring
      if (!data && scoring?.battingTeam === battingTeamId) {
          data = scoring;
      }
      return data;
  };

  const innings1Data = getInningsData(innings1TeamId);
  const innings2Data = getInningsData(innings2TeamId);

  const renderInnings = (battingTeamKey) => {
    const isTeam1 = battingTeamKey === 'team1';
    const battingInnings = isTeam1 ? (isTeam1BattingFirst ? innings1Data : innings2Data) : (!isTeam1BattingFirst ? innings1Data : innings2Data);
    
    // Correction: the helper should just take the team ID directly
    const data = getInningsData(battingTeamKey);
    const squad = isTeam1 ? match.team1 : match.team2;
    const bowlingSquad = isTeam1 ? match.team2 : match.team1;
    
    if (!data) {
        return (
            <div className="py-20 text-center text-text-tertiary">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Innings hasn't started yet</p>
                <p className="text-xs mt-1">Full roster will appear here when play begins</p>
            </div>
        );
    }

    const { batsmenStats = {}, bowlerStats = {}, totalRuns = 0, totalWickets = 0, totalOvers = 0, strikerId, nonStrikerId, currentBowlerId } = data;

    // All players in squad, showing those who batted first
    const sortedBatsmen = [...(squad || [])].sort((a, b) => {
        const hasAStats = !!batsmenStats[a];
        const hasBStats = !!batsmenStats[b];
        if (hasAStats && !hasBStats) return -1;
        if (!hasAStats && hasBStats) return 1;
        return 0;
    });

    const currentOverBalls = (data.thisOver || []).filter(b => !b.includes('WD') && !b.includes('NB')).length;
    const oversDisplay = `${totalOvers}.${currentOverBalls}`;

    return (
        <div className="space-y-8">
            {/* Summary Strip */}
            <div className="flex items-center justify-between p-4 bg-bg-primary/50 rounded-xl border border-border">
                <div>
                   <div className="text-2xl font-black text-text-primary">{totalRuns} / {totalWickets}</div>
                   <div className="text-xs font-bold text-text-tertiary uppercase tracking-widest">{oversDisplay} Overs</div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-1">Run Rate</div>
                    <div className="text-lg font-black text-accent">
                        {(totalRuns / Math.max(0.1, (totalOvers * 6 + currentOverBalls) / 6)).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Batting Section */}
            <section>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <Zap size={16} className="text-accent" />
                    <h4 className="text-sm font-black uppercase tracking-widest text-text-secondary">Batting</h4>
                </div>
                <div className="bg-bg-primary/30 border border-border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-bg-primary/50 text-[10px] uppercase tracking-wider font-bold text-text-tertiary border-b border-border">
                                <th className="px-4 py-3">Batsman</th>
                                <th className="px-2 py-3 text-right">R</th>
                                <th className="px-2 py-3 text-right">B</th>
                                <th className="px-2 py-3 text-right">4s</th>
                                <th className="px-2 py-3 text-right">6s</th>
                                <th className="px-4 py-3 text-right">SR</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {sortedBatsmen.map(id => {
                                const stats = batsmenStats[id];
                                const isStriker = id === strikerId;
                                const isNonStriker = id === nonStrikerId;
                                const isActive = isStriker || isNonStriker;
                                
                                const sr = stats?.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0';

                                return (
                                    <tr key={id} className={`text-sm ${isActive ? 'bg-accent/5' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className={`font-bold flex items-center gap-1.5 ${isActive ? 'text-accent' : (stats ? 'text-text-primary' : 'text-text-tertiary')}`}>
                                                    {getName(id)}
                                                    {isStriker && <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />}
                                                </span>
                                                {stats?.wicketInfo ? (
                                                    <span className="text-[10px] text-text-tertiary italic">
                                                        {stats.wicketInfo.type === 'Run Out' ? (
                                                            <>
                                                                Run Out ({getName(stats.wicketInfo.fielderId)}
                                                                {stats.wicketInfo.fielderId2 ? ` / ${getName(stats.wicketInfo.fielderId2)}` : ''})
                                                            </>
                                                        ) : (
                                                            <>
                                                                {stats.wicketInfo.type} {stats.wicketInfo.fielderId ? `(${getName(stats.wicketInfo.fielderId)})` : ''} b {getName(stats.wicketInfo.bowlerId)}
                                                            </>
                                                        )}
                                                    </span>
                                                ) : stats ? (
                                                    <span className="text-[10px] text-success font-bold uppercase tracking-tighter">Not Out</span>
                                                ) : (
                                                    <span className="text-[10px] text-text-tertiary/50 uppercase tracking-tighter">Did Not Bat</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-right font-mono font-bold text-text-primary">{stats?.runs || 0}</td>
                                        <td className="px-2 py-3 text-right font-mono text-text-secondary">{stats?.balls || 0}</td>
                                        <td className="px-2 py-3 text-right font-mono text-text-tertiary">{stats?.fours || 0}</td>
                                        <td className="px-2 py-3 text-right font-mono text-text-tertiary">{stats?.sixes || 0}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-text-tertiary">{sr}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Bowling Section */}
            <section>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <Target size={16} className="text-error" />
                    <h4 className="text-sm font-black uppercase tracking-widest text-text-secondary">Bowling</h4>
                </div>
                <div className="bg-bg-primary/30 border border-border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-bg-primary/50 text-[10px] uppercase tracking-wider font-bold text-text-tertiary border-b border-border">
                                <th className="px-4 py-3">Bowler</th>
                                <th className="px-2 py-3 text-right">O</th>
                                <th className="px-2 py-3 text-right">R</th>
                                <th className="px-2 py-3 text-right">W</th>
                                <th className="px-4 py-3 text-right">ECON</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {[...(bowlingSquad || [])].map(id => {
                                const stats = bowlerStats[id];
                                const isCurrent = id === currentBowlerId;

                                const overs = stats ? `${Math.floor(stats.balls / 6)}.${stats.balls % 6}` : '0.0';
                                const econ = stats?.balls > 0 ? (stats.runs / (stats.balls / 6)).toFixed(2) : '0.00';

                                return (
                                    <tr key={id} className={`text-sm ${isCurrent ? 'bg-error/5' : ''}`}>
                                        <td className="px-4 py-3">
                                            <span className={`font-bold ${isCurrent ? 'text-error' : (stats ? 'text-text-primary' : 'text-text-tertiary/40')}`}>
                                                {getName(id)}
                                            </span>
                                        </td>
                                        <td className={`px-2 py-3 text-right font-mono text-text-primary ${stats || isCurrent ? 'opacity-100' : 'opacity-20'}`}>{overs}</td>
                                        <td className={`px-2 py-3 text-right font-mono text-text-primary ${stats || isCurrent ? 'opacity-100' : 'opacity-20'}`}>{stats?.runs || 0}</td>
                                        <td className={`px-2 py-3 text-right font-mono font-bold text-error ${stats || isCurrent ? 'opacity-100' : 'opacity-20'}`}>{stats?.wickets || 0}</td>
                                        <td className={`px-4 py-3 text-right font-mono text-xs text-text-tertiary ${stats || isCurrent ? 'opacity-100' : 'opacity-20'}`}>{econ}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-primary/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-bg-secondary w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-bg-primary/50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Trophy className="text-accent" size={20} />
                Match Scoreboard
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Full performance statistics for all players
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-full text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-bg-primary/30 p-1 m-4 rounded-xl border border-border shrink-0">
            <button 
                onClick={() => setActiveTab('innings1')}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === 'innings1' 
                    ? `bg-bg-secondary ${innings1TeamId === 'team1' ? 'text-team1' : 'text-team2'} shadow-sm border border-border` 
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
            >
                {teamNames[innings1TeamId]}
            </button>
            <button 
                onClick={() => setActiveTab('innings2')}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === 'innings2' 
                    ? `bg-bg-secondary ${innings2TeamId === 'team1' ? 'text-team1' : 'text-team2'} shadow-sm border border-border` 
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
            >
                {teamNames[innings2TeamId]}
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-0">
            {renderInnings(activeTab === 'innings1' ? innings1TeamId : innings2TeamId)}
        </div>
        
        <div className="p-4 bg-bg-primary/50 border-t border-border shrink-0 text-center">
            <button 
                onClick={onClose}
                className="w-full py-3 bg-bg-tertiary hover:bg-border text-text-primary font-bold rounded-xl transition-colors uppercase tracking-widest text-xs"
            >
                Close Scoreboard
            </button>
        </div>
      </motion.div>
    </div>
  );
}

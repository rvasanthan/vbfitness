 import { useState, useMemo } from 'react';
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
  Table
} from 'lucide-react';
import ConsolidatedRoster from '../components/ConsolidatedRoster';
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
  onSignOut,
  loading,
  statusMessage
}) {
  const [guestCount, setGuestCount] = useState(0);
  const [viewMode, setViewMode] = useState('calendar');

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
               <h1 className="text-navy-100 font-bold text-lg leading-tight tracking-tight">RCC Planner</h1>
               <p className="text-navy-100/50 text-[10px] uppercase tracking-widest font-semibold">Season {year}</p>
             </div>
          </div>

          <div className="flex bg-navy-900 p-1 rounded-lg border border-navy-800 mx-2">
             <button onClick={() => setViewMode('calendar')} className={`p-1.5 md:px-3 md:py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'calendar' ? 'bg-navy-800 text-white shadow' : 'text-navy-100/50 hover:text-navy-100'}`}>
                <LayoutGrid size={14} /> <span className="hidden sm:inline">Calendar</span>
             </button>
             <button onClick={() => setViewMode('roster')} className={`p-1.5 md:px-3 md:py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'roster' ? 'bg-navy-800 text-white shadow' : 'text-navy-100/50 hover:text-navy-100'}`}>
                <Table size={14} /> <span className="hidden sm:inline">Roster</span>
             </button>
          </div>
          
          <div className="flex items-center gap-4">
            
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
             <ConsolidatedRoster year={year} dates={weekendDates} users={users} />
           </div>
        ) : (
          <>
        {/* Calendar Grid (Left Column) */}
        <section className="lg:col-span-8 space-y-8">
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
                             <div className="absolute -top-1.5 -right-1.5">
                               <span className="relative flex h-3 w-3">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
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
        <aside className="lg:col-span-4 space-y-6">
          <AnimatePresence mode="wait">
            {selectedDate ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="bg-navy-900 border border-navy-800 rounded-[2rem] p-6 shadow-xl sticky top-24"
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

                {/* Status Actions */}
                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={loading}
                      onClick={() => onSetStatus('in', guestCount)}
                      className="relative overflow-hidden flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-navy-800 hover:bg-green-100 border border-navy-700 hover:border-green-500 transition-all group active:scale-95"
                    >
                      <CheckCircle2 className="w-8 h-8 text-navy-200 group-hover:text-green-600 transition-colors" />
                      <span className="text-sm font-bold text-navy-100 group-hover:text-green-700">I'm In</span>
                      <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => onSetStatus('out')}
                      className="relative overflow-hidden flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-navy-800 hover:bg-red-100 border border-navy-700 hover:border-red-500 transition-all group active:scale-95"
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
                          onClick={() => setGuestCount(num)}
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
                  {/* IN */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Available
                      </h4>
                      <span className="text-[10px] font-mono font-bold bg-navy-800 px-2 py-0.5 rounded text-navy-100/50">{availability.in.length}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {availability.in.length === 0 && <p className="text-navy-100/20 text-xs italic px-2">No players confirmed yet.</p>}
                      {availability.in.map(u => (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors cursor-default">
                           <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-bold">
                             {u.name.charAt(0)}
                           </div>
                           <span className="text-xs font-medium text-green-100">{u.name}</span>
                           {u.guests > 0 && (
                             <span className="ml-1 text-[10px] bg-green-500/20 text-green-400 px-1.5 rounded-full font-bold">+{u.guests}</span>
                           )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-navy-800/50" />

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

          <div className="mt-8 pt-6 border-t border-navy-800/50">
             <h4 className="text-[10px] text-navy-100/20 uppercase tracking-widest font-bold mb-4">All Players</h4>
             <div className="flex flex-wrap gap-1.5">
               {users.map(u => (
                 <span key={u.id} className="text-[10px] px-2 py-1 bg-navy-900/50 rounded border border-navy-800/50 text-navy-100/30 hover:text-navy-100/60 hover:border-navy-700 transition-colors">
                   {u.name}
                 </span>
               ))}
               {users.length === 0 && <span className="text-navy-100/20 text-xs">Loading roster...</span>}
             </div>
          </div>
        </aside>
        </>
        )}
      </main>
    </div>
  );
}

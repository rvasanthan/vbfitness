import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { format } from 'date-fns';
import { Check, X, Users, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function DateCard({ date, isHoliday, holidayName, currentUser, availability = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const dateStr = format(date, 'yyyy-MM-dd');
  const userStatus = availability.find(a => a.uid === currentUser.uid)?.status; // 'in' or 'out' or undefined
  
  const playersIn = availability.filter(a => a.status === 'in');
  const playersOut = availability.filter(a => a.status === 'out');

  const toggleStatus = async (status) => {
    if (userStatus === status) {
       // Toggle off (remove)
       await deleteDoc(doc(db, "availability", `${dateStr}_${currentUser.uid}`));
    } else {
       // Set status
       await setDoc(doc(db, "availability", `${dateStr}_${currentUser.uid}`), {
         uid: currentUser.uid,
         name: currentUser.displayName,
         email: currentUser.email,
         photoURL: currentUser.photoURL,
         date: dateStr,
         status: status
       });
    }
  };

  return (
    <motion.div 
      layout
      className={clsx(
        "relative overflow-hidden rounded-xl border transition-all duration-300",
        isHoliday ? "bg-accent/10 border-accent/30" : "bg-bg-secondary border-border",
        userStatus === 'in' ? "ring-2 ring-success border-transparent shadow-[0_0_15px_rgba(34,197,94,0.1)]" : "",
        userStatus === 'out' ? "opacity-75 grayscale-[0.5]" : ""
      )}
    >
      {/* Header / Summary View */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center w-12 h-12 bg-bg-primary rounded-lg text-text-secondary font-bold border border-border">
            <span className="text-xs uppercase tracking-wide opacity-70">{format(date, 'MMM')}</span>
            <span className="text-xl leading-none text-text-primary">{format(date, 'd')}</span>
          </div>
          <div>
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              {format(date, 'EEEE')}
              {isHoliday && <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{holidayName}</span>}
            </h3>
            <div className="text-sm text-text-tertiary flex items-center gap-2">
               <Users size={14} />
               <span>{playersIn.length} Playing</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
             {/* Quick Actions (Visible when collapsed) */}
             <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => toggleStatus('in')}
                  className={clsx(
                    "p-2 rounded-full transition-all active:scale-95",
                    userStatus === 'in' ? "bg-success text-white shadow-lg shadow-success/20" : "bg-bg-primary text-text-tertiary hover:bg-bg-tertiary border border-border"
                  )}
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => toggleStatus('out')}
                  className={clsx(
                    "p-2 rounded-full transition-all active:scale-95",
                    userStatus === 'out' ? "bg-error text-white shadow-lg shadow-error/20" : "bg-bg-primary text-text-tertiary hover:bg-bg-tertiary border border-border"
                  )}
                >
                  <X size={18} />
                </button>
             </div>
             
             <motion.div 
               animate={{ rotate: isOpen ? 180 : 0 }}
               className="text-text-tertiary"
             >
               <ChevronDown size={20} />
             </motion.div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-bg-primary/30"
          >
             <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                   <h4 className="text-[10px] font-bold text-success uppercase tracking-wider mb-2 flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 bg-success rounded-full" />
                     In ({playersIn.length})
                   </h4>
                   <div className="space-y-2">
                      {playersIn.length === 0 && <p className="text-sm text-text-tertiary italic px-1">No one yet.</p>}
                      {playersIn.map(p => (
                        <div key={p.uid} className="flex items-center gap-2 group">
                           {p.photoURL ? (
                             <img src={p.photoURL} className="w-6 h-6 rounded-full border border-border group-hover:border-success transition-colors" />
                           ) : (
                             <div className="w-6 h-6 bg-success/10 rounded-full flex items-center justify-center text-[10px] text-success font-bold border border-success/20">
                               {p.name?.[0]}
                             </div>
                           )}
                           <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">{p.name || p.email}</span>
                        </div>
                      ))}
                   </div>
                </div>
                <div>
                   <h4 className="text-[10px] font-bold text-error uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-error rounded-full" />
                    Out ({playersOut.length})
                   </h4>
                   <div className="space-y-2">
                      {playersOut.length === 0 && <p className="text-sm text-text-tertiary italic px-1">None yet.</p>}
                      {playersOut.map(p => (
                        <div key={p.uid} className="flex items-center gap-2 opacity-50 group">
                           <div className="w-6 h-6 bg-bg-tertiary rounded-full flex items-center justify-center text-[10px] text-text-tertiary font-bold border border-border group-hover:border-error transition-colors">
                             {p.name?.[0]}
                           </div>
                           <span className="text-sm text-text-tertiary line-through group-hover:text-text-secondary transition-colors">{p.name || p.email}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

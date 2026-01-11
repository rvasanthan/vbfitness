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
        isHoliday ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200",
        userStatus === 'in' ? "ring-2 ring-cricket-green border-transparent" : "",
        userStatus === 'out' ? "opacity-75 grayscale-[0.5]" : ""
      )}
    >
      {/* Header / Summary View */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-100 rounded-lg text-slate-600 font-bold">
            <span className="text-xs uppercase tracking-wide">{format(date, 'MMM')}</span>
            <span className="text-xl leading-none">{format(date, 'd')}</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              {format(date, 'EEEE')}
              {isHoliday && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{holidayName}</span>}
            </h3>
            <div className="text-sm text-slate-500 flex items-center gap-2">
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
                    "p-2 rounded-full transition-colors",
                    userStatus === 'in' ? "bg-cricket-green text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                  )}
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => toggleStatus('out')}
                  className={clsx(
                    "p-2 rounded-full transition-colors",
                    userStatus === 'out' ? "bg-red-500 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                  )}
                >
                  <X size={18} />
                </button>
             </div>
             
             <motion.div 
               animate={{ rotate: isOpen ? 180 : 0 }}
               className="text-slate-400"
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
            className="border-t border-slate-100 bg-slate-50/50"
          >
             <div className="p-4 grid grid-cols-2 gap-4">
                <div>
                   <h4 className="text-xs font-bold text-cricket-green uppercase tracking-wider mb-2">In ({playersIn.length})</h4>
                   <div className="space-y-2">
                      {playersIn.length === 0 && <p className="text-sm text-slate-400 italic">No one yet.</p>}
                      {playersIn.map(p => (
                        <div key={p.uid} className="flex items-center gap-2">
                           {p.photoURL ? <img src={p.photoURL} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs text-green-800">{p.name?.[0]}</div>}
                           <span className="text-sm font-medium text-slate-700">{p.name || p.email}</span>
                        </div>
                      ))}
                   </div>
                </div>
                <div>
                   <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Out ({playersOut.length})</h4>
                   <div className="space-y-2">
                      {playersOut.map(p => (
                        <div key={p.uid} className="flex items-center gap-2 opacity-60">
                           <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs text-slate-600">{p.name?.[0]}</div>
                           <span className="text-sm text-slate-600 line-through">{p.name || p.email}</span>
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

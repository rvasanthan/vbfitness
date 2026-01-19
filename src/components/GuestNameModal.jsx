import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, UserPlus } from 'lucide-react';

export default function GuestNameModal({ isOpen, onClose, onSubmit, count, currentNames = [] }) {
  const [names, setNames] = useState([]);

  useEffect(() => {
    if (isOpen) {
      // Initialize with existing names or empty strings
      const arr = new Array(count).fill('');
      currentNames.forEach((n, i) => {
        if (arr[i] !== undefined) arr[i] = n;
      });
      setNames(arr);
    }
  }, [isOpen, count, currentNames]);

  const handleChange = (index, value) => {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Use default if empty
    const finalNames = names.map((n, i) => n.trim() || `Guest ${i+1}`);
    onSubmit(finalNames);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-navy-900 w-full max-w-md rounded-2xl border border-navy-800 shadow-xl overflow-hidden"
      >
        <div className="p-4 border-b border-navy-800 flex items-center justify-between bg-navy-950/50">
           <h3 className="font-bold text-navy-100 flex items-center gap-2">
             <UserPlus className="text-cricket-gold" size={20} />
             Guest Details
           </h3>
           <button onClick={onClose} className="text-navy-100/50 hover:text-red-400 transition-colors">
             <X size={20} />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
           <div className="space-y-3">
             <p className="text-sm text-navy-100/60 mb-2">Please enter the names of your {count} guest{count > 1 ? 's' : ''}:</p>
             {names.map((name, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-navy-100/50 uppercase tracking-wider">Guest {i+1}</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => handleChange(i, e.target.value)}
                    placeholder={`Enter name for guest ${i+1}`}
                    autoFocus={i === 0}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-4 py-3 text-navy-100 placeholder:text-navy-800 focus:outline-none focus:border-cricket-gold/50 focus:ring-1 focus:ring-cricket-gold/50 transition-all font-medium"
                  />
                </div>
             ))}
           </div>

           <div className="pt-2">
             <button 
               type="submit"
               className="w-full py-3 bg-cricket-gold text-navy-900 font-bold rounded-xl hover:bg-yellow-500 transition-colors tracking-wide"
             >
               Confirm & Join
             </button>
           </div>
        </form>
      </motion.div>
    </div>
  );
}

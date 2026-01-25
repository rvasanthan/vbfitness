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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg-secondary w-full max-w-md rounded-2xl border border-border shadow-xl overflow-hidden"
      >
        <div className="p-4 border-b border-border flex items-center justify-between bg-bg-primary/50">
           <h3 className="font-bold text-text-primary flex items-center gap-2">
             <UserPlus className="text-accent" size={20} />
             Guest Details
           </h3>
           <button onClick={onClose} className="text-text-tertiary hover:text-error transition-colors">
             <X size={20} />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
           <div className="space-y-3">
             <p className="text-sm text-text-secondary mb-2">Please enter the names of your {count} guest{count > 1 ? 's' : ''}:</p>
             {names.map((name, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Guest {i+1}</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => handleChange(i, e.target.value)}
                    placeholder={`Enter name for guest ${i+1}`}
                    autoFocus={i === 0}
                    className="w-full bg-bg-primary border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-medium"
                  />
                </div>
             ))}
           </div>

           <div className="pt-2">
             <button 
               type="submit"
               className="w-full py-3 bg-accent text-white font-bold rounded-xl hover:opacity-90 transition-opacity tracking-wide"
             >
               Confirm & Join
             </button>
           </div>
        </form>
      </motion.div>
    </div>
  );
}

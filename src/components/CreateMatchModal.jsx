import { useState } from 'react';
import { X, Calendar, MapPin, Clock, Trophy, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CreateMatchModal({ isOpen, onClose, date, onCreate, saving }) {
  const [formData, setFormData] = useState({
    venue: 'Rahway River Park',
    time: '13:00',
    format: '40 Overs'
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({ ...formData, date });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-navy-900 w-full max-w-md rounded-2xl shadow-2xl border border-navy-800 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-navy-800 bg-navy-950/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-navy-100">Create Match</h3>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-full text-navy-100/50 hover:text-navy-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-navy-100/50 uppercase tracking-wider mb-1.5">Date</label>
            <div className="flex items-center gap-2 p-3 bg-navy-950/50 rounded-lg border border-navy-800 text-navy-100 opacity-60">
              <Calendar size={16} />
              <span className="text-sm font-medium">{date}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-navy-100/50 uppercase tracking-wider mb-1.5">Venue</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3.5 text-navy-100/30" />
              <input 
                type="text" 
                required
                value={formData.venue}
                onChange={(e) => setFormData({...formData, venue: e.target.value})}
                className="w-full pl-10 p-3 bg-navy-950 rounded-lg border border-navy-800 text-navy-100 focus:outline-none focus:border-cricket-gold/50 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-navy-100/50 uppercase tracking-wider mb-1.5">Time</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-3.5 text-navy-100/30" />
                <input 
                  type="time" 
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full pl-10 p-3 bg-navy-950 rounded-lg border border-navy-800 text-navy-100 focus:outline-none focus:border-cricket-gold/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy-100/50 uppercase tracking-wider mb-1.5">Format</label>
              <div className="relative">
                <Trophy size={16} className="absolute left-3 top-3.5 text-navy-100/30" />
                <select 
                  value={formData.format}
                  onChange={(e) => setFormData({...formData, format: e.target.value})}
                  className="w-full pl-10 p-3 bg-navy-950 rounded-lg border border-navy-800 text-navy-100 focus:outline-none focus:border-cricket-gold/50 transition-colors appearance-none"
                >
                  <option>40 Overs</option>
                  <option>T20</option>
                  <option>35 Overs</option>
                  <option>Friendly</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-navy-800 text-navy-100 font-bold hover:bg-navy-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-cricket-gold text-navy-900 font-bold hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : 'Create Match'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

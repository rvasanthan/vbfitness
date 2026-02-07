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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg-secondary w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border bg-bg-primary/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-text-primary">Create Match</h3>
          <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-full text-text-tertiary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-1.5">Date</label>
            <div className="flex items-center gap-2 p-3 bg-bg-primary/50 rounded-lg border border-border text-text-primary opacity-60">
              <Calendar size={16} />
              <span className="text-sm font-medium">{date}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-1.5">Venue</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3.5 text-text-tertiary" />
              <input 
                type="text" 
                required
                value={formData.venue}
                onChange={(e) => setFormData({...formData, venue: e.target.value})}
                className="w-full pl-10 p-3 bg-bg-primary rounded-lg border border-border text-text-primary focus:outline-none focus:border-accent transition-colors"
                style={{ colorScheme: 'dark' }} // To handle autofill and color variations
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-1.5">Time</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-3.5 text-text-tertiary" />
                <input 
                  type="time" 
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full pl-10 p-3 bg-bg-primary rounded-lg border border-border text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-1.5">Format / Overs</label>
              <div className="relative">
                <Trophy size={16} className="absolute left-3 top-3.5 text-text-tertiary" />
                <select 
                  value={formData.format}
                  onChange={(e) => setFormData({...formData, format: e.target.value})}
                  className="w-full pl-10 p-3 bg-bg-primary rounded-lg border border-border text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none"
                >
                  <option value="T20">T20 (20 Overs)</option>
                  {[...Array(27)].map((_, i) => {
                    const overs = 4 + i;
                    return (
                      <option key={overs} value={`${overs} Overs`}>
                        {overs} Overs
                      </option>
                    );
                  })}
                  <option value="35 Overs">35 Overs</option>
                  <option value="40 Overs">40 Overs</option>
                  <option value="Friendly">Friendly</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-bg-tertiary text-text-primary font-bold hover:opacity-80 transition-opacity"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-accent text-white font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : 'Create Match'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

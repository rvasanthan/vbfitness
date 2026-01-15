import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Shield, 
  ShieldAlert, 
  User, 
  Loader2,
  MoreVertical,
  AlertTriangle
} from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPanel({ users, onClose, onRefresh }) {
  const [processing, setProcessing] = useState(null); // userId being processed
  const [confirmDelete, setConfirmDelete] = useState(null); // userId to confirm delete

  const updateUserStatus = async (userId, newStatus) => {
    setProcessing(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: newStatus
      });
      await onRefresh();
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user status");
    } finally {
      setProcessing(null);
    }
  };

  const deleteUser = async (userId) => {
    setProcessing(userId);
    try {
      // Use Cloud Function to delete from Auth + DB
      const deleteUserFn = httpsCallable(functions, 'deleteUser');
      await deleteUserFn({ uid: userId });
      
      setConfirmDelete(null);
      await onRefresh();
    } catch (error) {
      console.error("Error deleting user:", error);
      
      // Fallback: If cloud function fails (e.g. Spark plan), try local delete
      if (error.code === 'functions/internal' || error.message.includes('permission-denied') === false) {
         try {
             // Fallback to DB-only delete
             await deleteDoc(doc(db, 'users', userId));
             setConfirmDelete(null);
             await onRefresh();
             alert("Deleted from Database only. (Cloud function failed or unavailable)");
             return;
         } catch (e) {
             alert("Failed to delete user: " + error.message);
         }
      } else {
         alert("Failed to delete user: " + error.message);
      }
    } finally {
      setProcessing(null);
    }
  };

  const updateRole = async (userId, newRole) => {
    setProcessing(userId);
    try {
        await updateDoc(doc(db, 'users', userId), {
            role: newRole
        });
        await onRefresh();
    } catch (error) {
        console.error("Error updating role:", error);
    } finally {
        setProcessing(null);
    }
  }

  // Sort users: Pending first, then by name
  const sortedUsers = [...users].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-navy-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-navy-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-navy-800 bg-navy-950/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="text-cricket-gold" />
            <h2 className="text-xl font-bold text-navy-100">Admin Console</h2>
            <span className="bg-navy-800 text-navy-100/50 text-xs px-2 py-0.5 rounded-full border border-navy-700">
              {users.length} Users
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-navy-800 rounded-full text-navy-100/50 hover:text-navy-100 transition-colors"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {sortedUsers.map(user => (
              <div 
                key={user.id} 
                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                  user.status === 'pending' 
                    ? 'bg-yellow-500/5 border-yellow-500/20' 
                    : user.status === 'suspended'
                    ? 'bg-red-500/5 border-red-500/20 opacity-75'
                    : 'bg-navy-800/30 border-navy-800'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    user.role === 'admin' 
                      ? 'bg-cricket-gold text-navy-950 shadow-lg shadow-cricket-gold/20' 
                      : 'bg-navy-800 text-navy-100/50'
                  }`}>
                    {user.role === 'admin' ? <Shield size={16} /> : (user.name?.[0] || <User size={16} />)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-navy-100">{user.name}</h3>
                      {user.status === 'pending' && (
                        <span className="text-[10px] uppercase font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">Pending</span>
                      )}
                      {user.status === 'suspended' && (
                        <span className="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Suspended</span>
                      )}
                      {user.role === 'admin' && (
                        <span className="text-[10px] uppercase font-bold text-cricket-gold bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">Admin</span>
                      )}
                    </div>
                    <p className="text-sm text-navy-100/50">{user.email}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                    {/* Approve/Suspend Actions */}
                    {user.status === 'pending' && (
                        <>
                            <button
                                disabled={processing === user.id}
                                onClick={() => updateUserStatus(user.id, 'approved')}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-xs font-bold"
                            > 
                                {processing === user.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                Approve
                            </button>
                            <button
                                disabled={processing === user.id}
                                onClick={() => deleteUser(user.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs font-bold"
                            >
                                <XCircle size={14} />
                                Reject
                            </button>
                        </>
                    )}

                    {user.status === 'approved' && (
                        <button
                            disabled={processing === user.id}
                            onClick={() => updateUserStatus(user.id, 'suspended')}
                            className="p-2 rounded-lg text-navy-100/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Suspend User"
                        >
                            <ShieldAlert size={18} />
                        </button>
                    )}

                    {user.status === 'suspended' && (
                         <button
                            disabled={processing === user.id}
                            onClick={() => updateUserStatus(user.id, 'approved')}
                            className="p-2 rounded-lg text-navy-100/30 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                            title="Reactivate User"
                         >
                             <CheckCircle size={18} />
                         </button>
                    )}

                    {/* Delete Action with Confirmation */}
                    {confirmDelete === user.id ? (
                        <div className="flex items-center gap-2 ml-2 bg-red-950/50 p-1 rounded-lg border border-red-500/30">
                            <span className="text-[10px] text-red-200 pl-2">Sure?</span>
                            <button 
                                onClick={() => deleteUser(user.id)}
                                className="p-1 hovered:bg-red-500 rounded text-red-500 hover:text-white"
                            >
                                <CheckCircle size={14} />
                            </button>
                            <button 
                                onClick={() => setConfirmDelete(null)}
                                className="p-1 rounded text-navy-100/50 hover:text-white"
                            >
                                <XCircle size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(user.id)}
                            className="p-2 rounded-lg text-navy-100/30 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Remove Membership"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}

                    {/* Role Selector */}
                    <div className="ml-2 pl-2 border-l border-navy-800">
                      <select 
                        value={user.role || 'user'} 
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        className={`bg-navy-950 border rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-cricket-gold/50 ${
                          user.role === 'admin' 
                            ? 'text-cricket-gold border-cricket-gold/30' 
                            : 'text-navy-100/50 border-navy-700'
                        }`}
                        disabled={processing === user.id}
                      >
                        <option value="user">Player</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

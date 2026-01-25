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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg-secondary w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-bg-primary/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="text-accent" />
            <h2 className="text-xl font-bold text-text-primary">Admin Console</h2>
            <span className="bg-bg-tertiary text-text-tertiary text-xs px-2 py-0.5 rounded-full border border-border">
              {users.length} Users
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-full text-text-tertiary hover:text-text-primary transition-colors"
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
                    ? 'bg-warning/5 border-warning/20' 
                    : user.status === 'suspended'
                    ? 'bg-error/5 border-error/20 opacity-75'
                    : 'bg-bg-primary/30 border-border'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    user.role === 'admin' 
                      ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                      : 'bg-bg-tertiary text-text-tertiary'
                  }`}>
                    {user.role === 'admin' ? <Shield size={16} /> : (user.name?.[0] || <User size={16} />)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-text-primary">{user.name}</h3>
                      {user.status === 'pending' && (
                        <span className="text-[10px] uppercase font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">Pending</span>
                      )}
                      {user.status === 'suspended' && (
                        <span className="text-[10px] uppercase font-bold text-error bg-error/10 px-2 py-0.5 rounded">Suspended</span>
                      )}
                      {user.role === 'admin' && (
                        <span className="text-[10px] uppercase font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">Admin</span>
                      )}
                    </div>
                    <p className="text-sm text-text-tertiary">{user.email}</p>
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
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors text-xs font-bold"
                            > 
                                {processing === user.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                Approve
                            </button>
                            <button
                                disabled={processing === user.id}
                                onClick={() => deleteUser(user.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors text-xs font-bold"
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
                            className="p-2 rounded-lg text-text-tertiary hover:text-error hover:bg-error/10 transition-colors"
                            title="Suspend User"
                        >
                            <ShieldAlert size={18} />
                        </button>
                    )}

                    {user.status === 'suspended' && (
                         <button
                            disabled={processing === user.id}
                            onClick={() => updateUserStatus(user.id, 'approved')}
                            className="p-2 rounded-lg text-text-tertiary hover:text-success hover:bg-success/10 transition-colors"
                            title="Reactivate User"
                         >
                             <CheckCircle size={18} />
                         </button>
                    )}

                    {/* Delete Action with Confirmation */}
                    {confirmDelete === user.id ? (
                        <div className="flex items-center gap-2 ml-2 bg-error/10 p-1 rounded-lg border border-error/30">
                            <span className="text-[10px] text-error pl-2">Sure?</span>
                            <button 
                                onClick={() => deleteUser(user.id)}
                                className="p-1 hover:bg-error rounded text-error hover:text-white transition-colors"
                            >
                                <CheckCircle size={14} />
                            </button>
                            <button 
                                onClick={() => setConfirmDelete(null)}
                                className="p-1 rounded text-text-tertiary hover:text-text-primary"
                            >
                                <XCircle size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(user.id)}
                            className="p-2 rounded-lg text-text-tertiary hover:text-error hover:bg-error/10 transition-colors"
                            title="Remove Membership"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}

                    {/* Role Selector */}
                    <div className="ml-2 pl-2 border-l border-border">
                      <select 
                        value={user.role || 'user'} 
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        className={`bg-bg-primary border rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-accent/50 ${
                          user.role === 'admin' 
                            ? 'text-accent border-accent/30' 
                            : 'text-text-tertiary border-border'
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

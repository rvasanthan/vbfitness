import React from 'react';
import { Swords } from 'lucide-react';

const MatchShareCard = React.forwardRef(({ team1, team2, matchDetails }, ref) => {
  if (!matchDetails) return null;

  // Manual Color Palette 
  const colors = {
    bg: '#0f172a',
    cardBg: '#1e293b',
    borderTeam1: '#ef4444',
    borderTeam2: '#3b82f6',
    gold: '#f59e0b',
    textMain: '#f1f5f9',
    textMuted: '#94a3b8',
    team1HeaderBg: 'rgba(239, 68, 68, 0.1)',
    team1Border: 'rgba(239, 68, 68, 0.2)',
    team1Text: '#f87171',
    team2HeaderBg: 'rgba(59, 130, 246, 0.1)',
    team2Border: 'rgba(59, 130, 246, 0.2)',
    team2Text: '#60a5fa',
    divider: '#334155'
  };

  // Pure inline styles - bypassing ALL Tailwind classes to avoid OKLCH variables
  return (
    <div 
        ref={ref} 
        style={{ 
            backgroundColor: colors.bg, 
            fontFamily: 'sans-serif',
            color: '#ffffff',
            padding: '2rem',
            width: '800px',
            position: 'relative',
            overflow: 'hidden'
        }}
    >
        {/* Background Stripe */}
        <div style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '8px',
            background: 'linear-gradient(to right, #ef4444, transparent, #3b82f6)' 
        }}></div>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <h1 style={{ color: colors.gold, fontSize: '1.875rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    GAME ON
                </h1>
            </div>
            <div style={{ color: colors.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <span>{matchDetails.date}</span>
                <span>•</span>
                <span>{matchDetails.venue || 'Rahway River Park'}</span>
                <span>•</span>
                <span>{matchDetails.time || '1:00 PM'}</span>
                <span>•</span>
                <span>{matchDetails.format || '40 Overs'}</span>
            </div>
        </div>

        {/* Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', minHeight: '400px', position: 'relative', zIndex: 10 }}>
            
            {/* Team 1 (Red) */}
            <div style={{ 
                backgroundColor: colors.cardBg, 
                borderTop: `4px solid ${colors.borderTeam1}`, 
                borderRadius: '0.75rem', 
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                display: 'flex', flexDirection: 'column'
            }}>
                 <div style={{ backgroundColor: colors.team1HeaderBg, borderBottom: `1px solid ${colors.team1Border}`, padding: '1rem', textAlign: 'center' }}>
                    <h2 style={{ color: colors.team1Text, fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>RCC Spartans</h2>
                    {matchDetails.captain1Name && (
                        <div style={{ color: 'rgba(252, 165, 165, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', fontWeight: 'bold' }}>
                            Captain: {matchDetails.captain1Name}
                        </div>
                    )}
                 </div>
                 <div style={{ padding: '1rem', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <tbody>
                            {team1.map((p, i) => (
                                <tr key={p.id || i} style={{ 
                                    borderBottom: `1px solid ${colors.team1Border}`,
                                    backgroundColor: p.isCaptain ? 'rgba(239,68,68,0.05)' : 'transparent' 
                                }}>
                                    <td style={{ color: 'rgba(254,226,226,0.3)', padding: '0.5rem 0.75rem', width: '2rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{i + 1}</td>
                                    <td style={{ color: '#e5e7eb', padding: '0.5rem 0', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{p.name} {p.isCommon && <span style={{ opacity: 0.5, fontSize: '10px' }}>(Common)</span>}</span>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                {p.role === 'guest' && <span style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '0 0.25rem', height: '1rem', display: 'flex', alignItems: 'center', borderRadius: '0.25rem', fontSize: '9px' }}>GUEST</span>}
                                                {p.isCaptain && <span style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: colors.gold, padding: '0 0.25rem', height: '1rem', display: 'flex', alignItems: 'center', borderRadius: '0.25rem', fontSize: '9px', fontWeight: 'bold' }}>C</span>}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {team1.length === 0 && (
                                <tr>
                                    <td colSpan="2" style={{ color: colors.textMuted, padding: '2rem 0', textAlign: 'center', fontStyle: 'italic' }}>No players selected</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>

            {/* Middle VS */}
            <div style={{ 
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                width: '3rem', height: '3rem', borderRadius: '9999px',
                backgroundColor: colors.bg, border: `2px solid ${colors.divider}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
                <Swords size={20} color={colors.gold} />
            </div>

            {/* Team 2 (Blue) */}
            <div style={{ 
                backgroundColor: colors.cardBg, 
                borderTop: `4px solid ${colors.borderTeam2}`, 
                borderRadius: '0.75rem', 
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                display: 'flex', flexDirection: 'column'
            }}>
                 <div style={{ backgroundColor: colors.team2HeaderBg, borderBottom: `1px solid ${colors.team2Border}`, padding: '1rem', textAlign: 'center' }}>
                    <h2 style={{ color: colors.team2Text, fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>RCC Warriors</h2>
                    {matchDetails.captain2Name && (
                        <div style={{ color: 'rgba(147, 197, 253, 0.7)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', fontWeight: 'bold' }}>
                            Captain: {matchDetails.captain2Name}
                        </div>
                    )}
                 </div>
                 <div style={{ padding: '1rem', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <tbody>
                            {team2.map((p, i) => (
                                <tr key={p.id || i} style={{ 
                                    borderBottom: `1px solid ${colors.team2Border}`,
                                    backgroundColor: p.isCaptain ? 'rgba(59,130,246,0.05)' : 'transparent' 
                                }}>
                                    <td style={{ color: 'rgba(219,234,254,0.3)', padding: '0.5rem 0.75rem', width: '2rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{i + 1}</td>
                                    <td style={{ color: '#e5e7eb', padding: '0.5rem 0', fontWeight: 500 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{p.name} {p.isCommon && <span style={{ opacity: 0.5, fontSize: '10px' }}>(Common)</span>}</span>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                {p.role === 'guest' && <span style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#93c5fd', padding: '0 0.25rem', height: '1rem', display: 'flex', alignItems: 'center', borderRadius: '0.25rem', fontSize: '9px' }}>GUEST</span>}
                                                {p.isCaptain && <span style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: colors.gold, padding: '0 0.25rem', height: '1rem', display: 'flex', alignItems: 'center', borderRadius: '0.25rem', fontSize: '9px', fontWeight: 'bold' }}>C</span>}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {team2.length === 0 && (
                                <tr>
                                    <td colSpan="2" style={{ color: colors.textMuted, padding: '2rem 0', textAlign: 'center', fontStyle: 'italic' }}>No players selected</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${colors.divider}`, marginTop: '2rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ color: colors.textMuted }}>RCC Inside Edge</span>
            <span style={{ color: colors.textMuted }}>Generated on {new Date().toLocaleDateString()}</span>
        </div>
    </div>
  );
});

export default MatchShareCard;

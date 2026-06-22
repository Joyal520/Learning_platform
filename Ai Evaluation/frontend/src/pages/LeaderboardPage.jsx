import React, { useState, useEffect } from 'react';

export default function LeaderboardPage({ currentUserId }) {
  const [timeframe, setTimeframe] = useState('all-time');
  const [rankings, setRankings] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const host = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

  // Fetch rankings
  const fetchRankings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${host}/leaderboard?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to load leaderboard');
      const data = await response.json();
      setRankings(data.rankings || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch current user history
  const fetchUserHistory = async () => {
    if (!currentUserId || currentUserId === 'anonymous_user') {
      setUserHistory([]);
      return;
    }
    try {
      const response = await fetch(`${host}/leaderboard?user_id=${encodeURIComponent(currentUserId)}`);
      if (response.ok) {
        const data = await response.json();
        setUserHistory(data || []);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [timeframe]);

  useEffect(() => {
    fetchUserHistory();
  }, [currentUserId]);

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  // Calculate stats for current user
  const highestScore = userHistory.length > 0 
    ? Math.max(...userHistory.map(h => h.total_score)) 
    : 0;

  const averageScore = userHistory.length > 0 
    ? Math.round(userHistory.reduce((acc, h) => acc + h.total_score, 0) / userHistory.length) 
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* Timeframe selector header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: '0.25rem' }}>
            Competition Leaderboard
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Earn points based on handwriting readability, grammar, spelling, and sentence structures.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            className={`nav-tab ${timeframe === 'all-time' ? 'active' : ''}`}
            onClick={() => setTimeframe('all-time')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem' }}
          >
            All-Time
          </button>
          <button 
            className={`nav-tab ${timeframe === 'weekly' ? 'active' : ''}`}
            onClick={() => setTimeframe('weekly')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem' }}
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        
        {/* Rankings Table Card */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '1rem' }}>
            Rankings ({timeframe === 'weekly' ? 'Last 7 Days' : 'All Time'})
          </h3>

          {loading ? (
            <div className="loading-container" style={{ padding: '2rem' }}>
              <div className="spinner" style={{ width: '35px', height: '35px' }}></div>
              <p style={{ color: 'var(--text-secondary)' }}>Loading ranks...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : rankings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏆</div>
              <p>No submissions found for this timeframe. Be the first to submit!</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>User</th>
                    <th>Best Score</th>
                    <th>Avg Score</th>
                    <th style={{ textAlign: 'center' }}>Submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((rank) => {
                    const isCurrentUser = currentUserId && rank.user_id.toLowerCase() === currentUserId.toLowerCase();
                    return (
                      <tr key={rank.user_id} className={`leaderboard-row ${isCurrentUser ? 'current-user' : ''}`}>
                        <td>
                          {rank.rank <= 3 ? (
                            <span className={`rank-badge rank-${rank.rank}`}>{rank.rank}</span>
                          ) : (
                            <span style={{ paddingLeft: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                              {rank.rank}
                            </span>
                          )}
                        </td>
                        <td className="user-cell">
                          {rank.user_id}
                          {isCurrentUser && <span style={{ marginLeft: '6px', fontSize: '0.75rem', background: 'var(--color-primary-light)', color: 'black', padding: '0.1rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>You</span>}
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--color-primary-light)' }}>{rank.max_score}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{rank.avg_score}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{rank.submission_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* User Stats & Performance History Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Stats Summary */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '1.25rem' }}>
              Your Progress Dashboard
            </h3>
            
            {(!currentUserId || currentUserId === 'anonymous_user') ? (
              <div className="empty-state" style={{ padding: '1.5rem 0' }}>
                <p style={{ fontSize: '0.9rem' }}>Enter your name on the upload page to track your metrics and rankings here!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>User:</span>
                  <span style={{ fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>{currentUserId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Evaluations Taken:</span>
                  <span style={{ fontWeight: 'bold' }}>{userHistory.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Personal Record:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>{highestScore} / 100</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Average Grade:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-secondary)' }}>{averageScore} / 100</span>
                </div>
              </div>
            )}
          </div>

          {/* Performance History Chart */}
          {currentUserId && currentUserId !== 'anonymous_user' && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                Score History
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Visualize your growth across writing submissions.
              </p>

              {userHistory.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <p style={{ fontSize: '0.85rem' }}>Submit writing samples to see your performance chart.</p>
                </div>
              ) : (
                <div>
                  <div className="history-chart">
                    {userHistory.slice(-10).map((hist, idx) => {
                      const heightPercent = `${Math.max(hist.total_score, 5)}%`;
                      return (
                        <div key={hist.id || idx} className="chart-bar-container">
                          <div className="chart-tooltip">
                            Score: {hist.total_score}
                          </div>
                          <div 
                            className="chart-bar" 
                            style={{ height: heightPercent }}
                          ></div>
                          <span className="chart-label">
                            {formatDate(hist.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                    Showing last {Math.min(userHistory.length, 10)} submissions
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

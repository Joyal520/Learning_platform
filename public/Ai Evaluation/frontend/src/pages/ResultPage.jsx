import React, { useEffect, useState } from 'react';

// Circular Progress Component for scores
function CircularProgress({ value, max = 10, type }) {
  // Compute dashoffset
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const safeMax = Math.max(max, 1);
  const percentage = (value / safeMax) * 100;
  const dashOffset = circumference - (percentage / 100) * circumference;

  const isTotal = type === "total";

  return (
    <div className={isTotal ? "progress-circle-total-container" : "progress-circle-container"}>
      <svg className="progress-circle-svg">
        <circle className="progress-circle-bg" cx="50%" cy="50%" r={radius} />
        <circle 
          className={`progress-circle-bar ${type}`} 
          cx="50%" 
          cy="50%" 
          r={radius}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className={`progress-circle-value ${isTotal ? 'total' : ''}`}>
        {value}{isTotal ? '' : `/${max}`}
      </div>
    </div>
  );
}

const RUBRIC_DISPLAY = {
  essay: [
    ['grammar', 'Grammar', 25],
    ['vocabulary', 'Vocabulary', 20],
    ['coherence', 'Coherence', 20],
    ['sentence_structure', 'Sentence Structure', 20],
    ['spelling_punctuation', 'Spelling and Punctuation', 15]
  ],
  worksheet: [
    ['correct_answers', 'Correct Answers', 70],
    ['completion', 'Completion', 15],
    ['presentation_neatness', 'Presentation', 10],
    ['instruction_following', 'Instruction Following', 5]
  ],
  picture_description: [
    ['relevance_to_picture', 'Relevance to Picture', 25],
    ['grammar', 'Grammar', 20],
    ['vocabulary', 'Vocabulary', 20],
    ['sentence_structure', 'Sentence Structure', 15],
    ['coherence', 'Coherence', 10],
    ['spelling_punctuation', 'Spelling and Punctuation', 10]
  ],
  handwriting: [
    ['letter_formation', 'Letter Formation', 25],
    ['spacing', 'Spacing', 20],
    ['alignment', 'Alignment', 20],
    ['slant_consistency', 'Slant and Consistency', 15],
    ['neatness_readability', 'Neatness and Readability', 20]
  ]
};

function getRubricRows(moduleType, subscores = {}) {
  return (RUBRIC_DISPLAY[moduleType] || RUBRIC_DISPLAY.essay).map(([key, label, max]) => ({
    key,
    label,
    max,
    value: Math.min(max, Math.max(0, Math.round(Number(subscores[key] || 0))))
  }));
}

export default function ResultPage({ result, onReset, onResultUpdate }) {
  const [animate, setAnimate] = useState(false);
  const [retrySaving, setRetrySaving] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [retryError, setRetryError] = useState('');

  useEffect(() => {
    // Trigger animations after mount
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!result) return null;

  const handleRetrySave = async () => {
    if (!result.retry_save_payload || retrySaving) return;
    setRetrySaving(true);
    setRetryMessage('');
    setRetryError('');

    try {
      const session = await window.DigitalClassroomSupabase?.getSession?.().catch(() => null);
      const response = await fetch('/api/paper-grader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(result.retry_save_payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body.error || 'Assessment completed, but leaderboard update failed. Please retry saving the score.');
      }

      const successMessage = body.success_message || 'AI assessment completed. Score added to the classroom leaderboard.';
      const nextResult = {
        ...result,
        leaderboard_saved: true,
        leaderboard_update_failed: false,
        leaderboard_duplicate: Boolean(body.leaderboard_duplicate),
        leaderboard_error: null,
        retry_save_payload: null,
        success_message: successMessage,
        classroom_points_id: body.classroom_points_id || result.classroom_points_id || '',
        assessment_id: body.assessment_id || result.assessment_id || ''
      };
      setRetryMessage(successMessage);
      onResultUpdate?.(nextResult);
      window.ClassroomUI?.showToast?.(successMessage, 'success');
      if (nextResult.classroom_id && window.ClassroomUI?.refreshClassroomSections) {
        window.ClassroomUI.refreshClassroomSections(nextResult.classroom_id).catch(() => {});
      }
    } catch (error) {
      const message = error.message || 'Assessment completed, but leaderboard update failed. Please retry saving the score.';
      setRetryError(message);
      window.ClassroomUI?.showToast?.(message, 'warning');
    } finally {
      setRetrySaving(false);
    }
  };

  // Extract variables from unified schema
  const moduleType = result.module_type || 'essay';
  const unclear = result.unclear === true || result.unclear === 'true';
  const ocrConfidence = result.ocr_confidence !== undefined ? result.ocr_confidence : 1.0;
  const mistakes = result.mistakes || [];
  const isLeaderboardFailed = result.leaderboard_update_failed === true;
  const secureMessage = isLeaderboardFailed ? '' : (result.success_message || (result.image_deleted ? 'Assessment saved and image deleted securely.' : ''));
  const studentName = result.student_name || result.studentName || '';
  
  // Format feedback lines (convert string with newlines to bullets)
  let feedbackBullets = [];
  if (result.feedback) {
    feedbackBullets = result.feedback
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.replace(/^[\s✦•\-*]+/g, '').trim().length > 0)
      .map(line => line.replace(/^[\s✦•\-*]+/g, '').trim());
  }

  // Deterministic 100-mark scoring calculation
  const rawScore = result.total_score !== undefined ? result.total_score : result.score;
  const legacyWorksheetTotal = Number(result.subscores?.total_questions || 0);
  const legacyWorksheetCorrect = Number(result.subscores?.correct || 0);
  const displayScore = moduleType === 'worksheet' && legacyWorksheetTotal > 0 && Number(rawScore || 0) <= legacyWorksheetTotal
    ? Math.round((legacyWorksheetCorrect / Math.max(legacyWorksheetTotal, 1)) * 100)
    : Math.min(100, Math.max(0, Math.round(Number(rawScore || 0))));
  const maxScore = 100;
  const percentageScore = displayScore;
  const rubricRows = getRubricRows(moduleType, result.subscores || {});

  // Get qualitative appraisal text
  const getAppraisal = (pct) => {
    if (pct >= 90) return 'Outstanding!';
    if (pct >= 75) return 'Well Done!';
    if (pct >= 50) return 'Good Effort!';
    return 'Keep Practicing!';
  };

  // Get module name string for headers
  const getModuleName = (type) => {
    switch (type) {
      case 'essay': return 'Handwritten Essay Correction';
      case 'worksheet': return 'Worksheet Evaluation';
      case 'picture_description': return 'Picture Description Assessment';
      case 'handwriting': return 'Beautiful Handwriting Contest';
      default: return 'Handwriting Evaluation';
    }
  };

  return (
    <div className="result-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Module Title Banner */}
      <div style={{ textAlign: 'center', marginBottom: '-0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-primary-light)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em' }}>
          4. Assessment Report
        </span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginTop: '0.25rem' }}>
          {getModuleName(moduleType)}
        </h2>
        {studentName && (
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Saved for <strong style={{ color: 'var(--text-primary)' }}>{studentName}</strong>
          </p>
        )}
      </div>
      {secureMessage && <div className="alert alert-success">{secureMessage}</div>}
      {isLeaderboardFailed && (
        <div className="alert alert-danger">
          Assessment completed, but leaderboard update failed. Please retry saving the score.
          <div style={{ marginTop: '0.9rem' }}>
            <button className="btn btn-primary" type="button" onClick={handleRetrySave} disabled={retrySaving}>
              {retrySaving ? 'Saving score...' : 'Retry saving score'}
            </button>
          </div>
        </div>
      )}
      {retryMessage && <div className="alert alert-success">{retryMessage}</div>}
      {retryError && <div className="alert alert-danger">{retryError}</div>}

      {/* 1. FAILURE MODE RENDERING: If OCR is unclear */}
      {unclear ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="alert alert-danger" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
            <span style={{ fontSize: '2.5rem' }}>⚠️</span>
            <h3 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.5rem' }}>Unclear Text Detected</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', maxWidth: '500px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              The system was unable to transcribe or read the handwritten image clearly. A default partial score has been assigned.
            </p>
          </div>

          <div className="card grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Assigned Grade
              </h3>
              <CircularProgress 
                value={0} 
                max={10} 
                type="total" 
              />
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-spelling)', fontSize: '1.8rem', marginTop: '0.5rem' }}>
                Incomplete
              </h2>
            </div>

            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Upload Security
              </h3>
              <div className="empty-state" style={{ height: '220px' }}>
                Assessment saved and image deleted securely.
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '1rem' }}>
              System Resolution Instructions
            </h3>
            <ul className="feedback-list">
              <li>{result.feedback || "The uploaded handwriting is unreadable. Please upload a clearer image."}</li>
              <li>Ensure the handwriting sample is in focus with good lighting.</li>
              <li>Avoid high camera angles, shadows, or extremely light pencil markings.</li>
            </ul>
          </div>
        </div>
      ) : (
        /* 2. NORMAL SUCCESS RENDERING */
        <>
          {/* Overview Card with Total Score & Image Preview */}
          <div className="card grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Overall Score
              </h3>
              <CircularProgress 
                value={animate ? displayScore : 0} 
                max={maxScore} 
                type="total" 
              />
              <h2 style={{ fontFamily: 'var(--font-display)', background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '2rem', textAlign: 'center', marginTop: '0.5rem' }}>
                {getAppraisal(percentageScore)}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', textAlign: 'center' }}>
                Normalized score: <strong style={{ color: 'var(--color-primary-light)' }}>{percentageScore}%</strong>
              </p>
            </div>

            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Detected Text Status</span>
                <span className="mistake-tag structure" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-structure)' }}>
                  OCR Confidence: {Math.round(ocrConfidence * 100)}%
                </span>
              </h3>
              <div className="empty-state" style={{ height: '220px' }}>
                {result.extracted_text ? 'Detected text is available below.' : 'No detected text was available.'}
                <br />
                {secureMessage || 'Uploaded image was not permanently stored.'}
              </div>
            </div>
          </div>

          {/* Subscores Grid - Deterministic by Module Type */}
          <div className="grid-3">
            {rubricRows.map((row, idx) => (
              <div className="card score-card" key={row.key}>
                <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {row.label}
                </h4>
                <CircularProgress
                  value={animate ? row.value : 0}
                  max={row.max}
                  type={idx % 3 === 0 ? 'grammar' : idx % 3 === 1 ? 'clarity' : 'spelling'}
                />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {row.value}/{row.max} marks
                </p>
              </div>
            ))}

            {false && moduleType === 'essay' && (
              <>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Grammar</h4>
                  <CircularProgress value={animate ? (result.subscores?.grammar || 0) : 0} max={10} type="grammar" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Verb tense, punctuation, sentence structures</p>
                </div>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Spelling</h4>
                  <CircularProgress value={animate ? (result.subscores?.spelling || 0) : 0} max={10} type="spelling" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Orthography and spelling mistakes</p>
                </div>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Content</h4>
                  <CircularProgress value={animate ? (result.subscores?.content || 0) : 0} max={10} type="clarity" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Coherence, depth of ideas, task completion</p>
                </div>
              </>
            )}

            {false && moduleType === 'worksheet' && (
              <>
                <div className="card score-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '180px' }}>
                  <span style={{ fontSize: '2.5rem' }}>✅</span>
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Correct Items</h4>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                    {result.subscores?.correct || 0}
                  </span>
                </div>
                <div className="card score-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '180px' }}>
                  <span style={{ fontSize: '2.5rem' }}>❌</span>
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Wrong Items</h4>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-spelling)' }}>
                    {result.subscores?.wrong || 0}
                  </span>
                </div>
                <div className="card score-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '180px' }}>
                  <span style={{ fontSize: '2.5rem' }}>📊</span>
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Evaluation Total</h4>
                  <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary-light)' }}>
                    {result.subscores?.total_questions || 0} Qs
                  </span>
                </div>
              </>
            )}

            {false && moduleType === 'picture_description' && (
              <>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Relevance</h4>
                  <CircularProgress value={animate ? (result.subscores?.relevance || 0) : 0} max={10} type="grammar" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alignment with provided image context</p>
                </div>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Language</h4>
                  <CircularProgress value={animate ? (result.subscores?.language || 0) : 0} max={10} type="clarity" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vocabulary richness, grammar correctness</p>
                </div>
                <div className="card score-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={{ fontSize: '2.2rem' }}>🖼️</span>
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '0.25rem' }}>Description</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0 0.5rem' }}>
                    Assessed against visual cues and prompt instructions
                  </span>
                </div>
              </>
            )}

            {false && moduleType === 'handwriting' && (
              <>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Neatness</h4>
                  <CircularProgress value={animate ? (result.subscores?.neatness || 0) : 0} max={10} type="grammar" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Letter formation, stroke clean-ness</p>
                </div>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Readability</h4>
                  <CircularProgress value={animate ? (result.subscores?.readability || 0) : 0} max={10} type="clarity" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alignment, line spacing, sizing consistency</p>
                </div>
                <div className="card score-card">
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Accuracy</h4>
                  <CircularProgress value={animate ? (result.subscores?.accuracy || 0) : 0} max={10} type="spelling" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Copy accuracy relative to model source text</p>
                </div>
              </>
            )}
          </div>

          {/* Text Comparison Panels - Show transcribed original / corrected */}
          {result.extracted_text && (
            <div className="card text-compare-container">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                Transcription & Corrections
              </h3>
              
              <div className="grid-2">
                <div>
                  <div className="text-panel-title">
                    <span>✦</span> Original Extracted Text
                  </div>
                  <div className="text-panel">
                    {result.extracted_text}
                  </div>
                </div>
                <div>
                  <div className="text-panel-title" style={{ color: 'var(--color-primary-light)' }}>
                    <span>✦</span> Corrected Version
                  </div>
                  <div className="text-panel" style={{ border: '1px solid rgba(16, 185, 129, 0.15)', background: 'rgba(16, 185, 129, 0.02)' }}>
                    {result.corrected_text || "No edits needed! Excellent transcription."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mistakes & Improvements Grid */}
          <div className="grid-2">
            {/* Left Column: Errors list */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Errors Identified
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  ({mistakes.length})
                </span>
              </h3>

              {mistakes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎉</div>
                  <p>No errors found! Excellent work.</p>
                </div>
              ) : (
                <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {(moduleType === 'worksheet' ? mistakes.slice(0, 3) : mistakes).map((mistake, idx) => (
                    <div key={idx} className={`mistake-item ${mistake.type || 'grammar'}`}>
                      <div className="mistake-header">
                        <span className={`mistake-tag ${mistake.type || 'grammar'}`}>
                          {mistake.question ? `${mistake.question} - ${mistake.type || 'incorrect'}` : (mistake.type || 'correction')}
                        </span>
                      </div>
                      <div className="mistake-diff">
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Incorrect:</span>
                          <span className="mistake-error">{mistake.error}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Correction:</span>
                          <span className="mistake-correction">{mistake.correction}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {moduleType === 'worksheet' && mistakes.length > 3 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem' }}>
                      (Showing first 3 mistakes only)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Dynamic Actionable Insights (Omitted for worksheets) */}
            {moduleType === 'worksheet' ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '3rem 2rem' }}>
                <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</span>
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>Assessment Completed</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Worksheet results are evaluated based on strict correctness matching against the provided key. No explanations are provided.
                </p>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Top Issue Indicator */}
                {result.top_issue && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-spelling)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Primary Area of Deficit
                    </span>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                      {result.top_issue}
                    </h4>
                  </div>
                )}

                {/* Feedback Bullets */}
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                    Actionable Feedback
                  </h3>
                  {feedbackBullets.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No specific feedback issues listed.</p>
                  ) : (
                    <ul className="feedback-list">
                      {feedbackBullets.map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Actionable Improvement */}
                {result.improvement && (
                  <div style={{ marginTop: 'auto', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Actionable Improvement Tip
                    </span>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.25rem', marginBottom: 0, lineHeight: '1.4' }}>
                      {result.improvement}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Evaluate Another Button */}
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button className="btn btn-outline" onClick={onReset} style={{ padding: '0.9rem 2.5rem' }}>
          Evaluate Another Sample
        </button>
      </div>

    </div>
  );
}

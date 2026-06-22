import React, { useState } from 'react';
import UploadPage from './pages/UploadPage';
import ResultPage from './pages/ResultPage';

function App() {
  const [currentResult, setCurrentResult] = useState(null);
  
  // Persistence for User ID across visits
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem('edtechra_user_id') || 'Student_1';
  });

  const setUserIdGlobal = (newId) => {
    setUserId(newId);
    localStorage.setItem('edtechra_user_id', newId);
  };

  const handleUploadSuccess = (evaluationData) => {
    setCurrentResult(evaluationData);
  };

  const handleResultUpdate = (nextResult) => {
    setCurrentResult(nextResult);
  };

  const handleReset = () => {
    setCurrentResult(null);
  };

  return (
    <div className="app-container ocr-page">
      {/* Soft Liquid Moving Blobs Background */}
      <div className="aurora-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="blob blob-4"></div>
      </div>

      {/* Premium Navigation Header */}
      <header className="header ocr-header" style={{ justifyContent: 'center', borderBottom: 'none', marginBottom: '3rem', paddingTop: '1rem' }}>
        <div className="logo" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', flexDirection: 'column' }} onClick={handleReset}>
          <img 
            src={`${import.meta.env.BASE_URL}logo_dark.webp`} 
            alt="EdTechra Logo" 
            style={{ 
              height: '80px', 
              width: '80px',
              objectFit: 'contain', 
              borderRadius: '18px',
              border: '1px solid rgba(139, 92, 246, 0.12)',
              boxShadow: '0 8px 20px rgba(139, 92, 246, 0.08), 0 2px 5px rgba(0, 0, 0, 0.05)',
              backgroundColor: '#ffffff',
              padding: '8px'
            }} 
          />
          <h1 className="ocr-header-title" style={{ fontSize: '2.2rem', fontWeight: '800', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', textAlign: 'center', margin: 0 }}>
            EdTechra <span style={{ fontWeight: '300', color: 'var(--text-secondary)' }}>AI Assessment Engine</span>
          </h1>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ minHeight: 'calc(100vh - 220px)', paddingBottom: '3rem' }}>
        {currentResult ? (
          <ResultPage 
            result={currentResult} 
            onReset={handleReset} 
            onResultUpdate={handleResultUpdate}
          />
        ) : (
          <UploadPage 
            onUploadSuccess={handleUploadSuccess} 
            defaultUserId={userId} 
            setUserIdGlobal={setUserIdGlobal}
          />
        )}
      </main>

      {/* Premium Footer */}
      <footer style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <p>&copy; {new Date().getFullYear()} EdTechra Handwriting AI Evaluation System. All rights reserved.</p>
        <p style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}>
          Powered by Advanced Vision OCR & Strict Evaluation Contracts
        </p>
      </footer>
    </div>
  );
}

export default App;

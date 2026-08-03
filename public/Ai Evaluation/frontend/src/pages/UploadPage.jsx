import React, { useEffect, useRef, useState } from 'react';

const EVALUATION_MODES = [
  {
    id: 'essay',
    icon: 'Aa',
    title: 'Essay Correction',
    description: 'Grammar, spelling, sentence structure, and coherence.'
  },
  {
    id: 'worksheet',
    icon: 'OK',
    title: 'Worksheet Grading',
    description: 'Correctness against an answer key or worksheet logic.'
  },
  {
    id: 'picture_description',
    icon: 'IMG',
    title: 'Picture Description',
    description: 'Relevance, grammar, clarity, and vocabulary.'
  },
  {
    id: 'handwriting',
    icon: 'Pen',
    title: 'Handwriting Contest',
    description: 'Neatness, alignment, readability, and copy accuracy.'
  }
];

function getEmbeddedContext() {
  const routeContext = window.__EDTECHRA_OCR_CONTEXT || {};
  const query = new URLSearchParams(window.location.search || '');
  const hashMatch = String(window.location.hash || '').match(/classroom\/ocr-grading\/([^/?#]+)/i);
  return {
    classroomId: routeContext.classroomId || query.get('classroomId') || (hashMatch ? decodeURIComponent(hashMatch[1]) : ''),
    embedded: window.__EDTECHRA_OCR_EMBEDDED === true ||
      window.location.pathname.startsWith('/ocr-grading/') ||
      window.location.hash.includes('classroom/ocr-grading')
  };
}

function detectMobileOrTablet() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 900px) and (pointer: coarse)').matches
  );
}

function getStudentId(student) {
  return student?.profileId || student?.profile_id || student?.id || '';
}

export default function UploadPage({ onUploadSuccess, defaultUserId, setUserIdGlobal }) {
  const embeddedContext = getEmbeddedContext();
  const [userId, setUserId] = useState(defaultUserId || 'anonymous_user');
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [successText, setSuccessText] = useState('');
  const [compressionInfo, setCompressionInfo] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [moduleType, setModuleType] = useState('essay');
  const [answerKey, setAnswerKey] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(() => detectMobileOrTablet());

  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const selectedStudent = students.find((student) => getStudentId(student) === selectedStudentId) || null;
  const canUpload = !embeddedContext.embedded || Boolean(selectedStudent);
  const successTextIsWarning = successText.includes('leaderboard update failed');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px) and (pointer: coarse)');
    const updateDeviceMode = () => setIsMobileOrTablet(detectMobileOrTablet());
    updateDeviceMode();
    mediaQuery.addEventListener?.('change', updateDeviceMode);
    return () => mediaQuery.removeEventListener?.('change', updateDeviceMode);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!embeddedContext.embedded || !embeddedContext.classroomId) return undefined;

    setStudentsLoading(true);
    setError(null);
    window.ClassroomAPI?.getStudentsByClassroom(embeddedContext.classroomId)
      .then((rows) => {
        if (!mounted) return;
        setStudents(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError?.message || 'Could not load classroom students.');
      })
      .finally(() => {
        if (mounted) setStudentsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [embeddedContext.classroomId, embeddedContext.embedded]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCompressionInfo('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1200;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              const savings = ((file.size - compressedFile.size) / 1024).toFixed(1);
              setCompressionInfo(
                `Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (saved ${savings}KB)`
              );
              resolve(compressedFile);
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => reject(new Error('Failed to load image for compression.'));
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
    });
  };

  const processImageFile = (file) => {
    setError(null);
    setSuccessText('');
    setCompressionInfo('');
    if (!file) return;
    if (!file.type.match('image.*')) {
      setError('Only JPG, JPEG, and PNG files are supported.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') setDragActive(true);
    if (event.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files?.[0]) processImageFile(event.dataTransfer.files[0]);
  };

  const handleImageSelected = (event) => {
    if (event.target.files?.[0]) processImageFile(event.target.files[0]);
    event.target.value = '';
  };

  const handleStudentSelect = (studentId) => {
    setSelectedStudentId(studentId);
    clearUpload();
    setSuccessText('');
  };

  const handleStandaloneUserIdChange = (event) => {
    const nextUserId = event.target.value;
    setUserId(nextUserId);
    setUserIdGlobal(nextUserId);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (embeddedContext.embedded && !selectedStudent) {
      setError('Select one classroom student before uploading.');
      return;
    }
    if (!selectedFile) {
      setError('Please select or drag an image first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessText('');
    setLoadingStep('Scanning and grading...');

    try {
      let fileToUpload = selectedFile;
      if (selectedFile.size > 200 * 1024) {
        fileToUpload = await compressImage(selectedFile);
      }
      if (fileToUpload.size > 5 * 1024 * 1024) {
        throw new Error('Image exceeds the 5MB size limit even after compression.');
      }

      const formData = new FormData();
      formData.append('image', fileToUpload);
      formData.append('user_id', embeddedContext.embedded ? getStudentId(selectedStudent) : (userId.trim() || 'anonymous_user'));
      formData.append('module_type', moduleType);
      if (embeddedContext.classroomId) formData.append('classroom_id', embeddedContext.classroomId);
      if (selectedStudent) {
        formData.append('student_id', getStudentId(selectedStudent));
        formData.append('profile_id', getStudentId(selectedStudent));
      }
      if (moduleType === 'worksheet') formData.append('answer_key', answerKey.trim());
      if (moduleType === 'picture_description') formData.append('image_prompt', imagePrompt.trim());
      if (moduleType === 'handwriting') formData.append('reference_text', referenceText.trim());

      const endpoint = embeddedContext.embedded ? '/api/paper-grader' : 'http://localhost:5000/upload';
      const session = await window.DigitalClassroomSupabase?.getSession?.().catch(() => null);
      if (session?.user?.id) formData.append('teacher_id', session.user.id);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server failed to process image.');
      }

      const result = await response.json();
      if (result?.success === false) {
        throw new Error(result.error || 'AI grading is not configured yet.');
      }
      const savedText = result.success_message || 'Assessment saved and image deleted securely.';
      setSuccessText(savedText);
      clearUpload();
      window.ClassroomUI?.showToast?.(savedText, result.leaderboard_update_failed ? 'warning' : 'success');
      if (result.leaderboard_saved && embeddedContext.classroomId && window.ClassroomUI?.refreshClassroomSections) {
        window.ClassroomUI.refreshClassroomSections(embeddedContext.classroomId).catch(() => {});
      }
      onUploadSuccess({
        ...result,
        student_name: selectedStudent?.name || selectedStudent?.displayName || '',
        selected_evaluation_mode: moduleType
      });
    } catch (submitError) {
      setError(submitError.message || 'An error occurred during evaluation.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="card ocr-panel" style={{ maxWidth: '1350px', margin: '0 auto', paddingTop: '2.5rem' }}>
      {error && <div className="alert alert-danger">{error}</div>}
      {successText && <div className={`alert ${successTextIsWarning ? 'alert-danger' : 'alert-success'}`}>{successText}</div>}

      {isLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>Scanning and grading...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{loadingStep || 'Scanning and grading...'}</p>
          <div className="progress-track">
            <div className="progress-fill"></div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <section className="workflow-section">
            <div className="workflow-heading">
              <span>1</span>
              <div>
                <h3>Evaluation Mode</h3>
                <p>Select how the uploaded work should be assessed.</p>
              </div>
            </div>
            <div className="mode-cards-grid">
              {EVALUATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`mode-card ${moduleType === mode.id ? 'active' : ''}`}
                  onClick={() => setModuleType(mode.id)}
                  aria-pressed={moduleType === mode.id}
                >
                  <div className="mode-card-icon">{mode.icon}</div>
                  <div className="mode-card-title">{mode.title}</div>
                  <div className="mode-card-desc">{mode.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="workflow-section">
            <div className="workflow-heading">
              <span>2</span>
              <div>
                <h3>Student</h3>
                <p>Choose one student from the current classroom.</p>
              </div>
            </div>

            {embeddedContext.embedded ? (
              <>
                {studentsLoading && <div className="empty-state">Loading classroom students...</div>}
                {!studentsLoading && students.length === 0 && (
                  <div className="empty-state">No students found in this classroom.</div>
                )}
                <div className="student-select-grid">
                  {students.map((student) => {
                    const studentId = getStudentId(student);
                    const name = student.name || student.displayName || 'Student';
                    return (
                      <button
                        key={student.memberId || studentId}
                        type="button"
                        className={`student-select-card ${selectedStudentId === studentId ? 'active' : ''}`}
                        onClick={() => handleStudentSelect(studentId)}
                      >
                        <span className="student-select-avatar">{student.avatar || name.charAt(0).toUpperCase()}</span>
                        <strong>{name}</strong>
                        <small>{Number(student.points || 0).toLocaleString()} pts</small>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <input
                className="form-input"
                value={userId}
                onChange={handleStandaloneUserIdChange}
                placeholder="Student ID"
              />
            )}
          </section>

          {canUpload && (
            <section className="workflow-section">
              <div className="workflow-heading">
                <span>3</span>
                <div>
                  <h3>Add Student Work Image</h3>
                  <p>Capture or upload one clear student work image.</p>
                </div>
              </div>

              {selectedStudent && (
                <div className="selected-student-banner">
                  <span className="student-select-avatar">{selectedStudent.avatar || selectedStudent.name?.charAt(0).toUpperCase() || 'S'}</span>
                  <div>
                    <small>Selected student</small>
                    <strong>{selectedStudent.name || selectedStudent.displayName}</strong>
                  </div>
                </div>
              )}

              {moduleType === 'worksheet' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="answerKey">Answer Key / Rubric (Optional)</label>
                  <textarea id="answerKey" className="form-input" value={answerKey} onChange={(e) => setAnswerKey(e.target.value)} rows={3} />
                </div>
              )}

              {moduleType === 'picture_description' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="imagePrompt">Description Prompt / Image Context (Optional)</label>
                  <input id="imagePrompt" className="form-input" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} />
                </div>
              )}

              {moduleType === 'handwriting' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="referenceText">Reference Copy Text (Optional)</label>
                  <textarea id="referenceText" className="form-input" value={referenceText} onChange={(e) => setReferenceText(e.target.value)} rows={3} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Handwriting / Worksheet Image</label>
                <input ref={cameraInputRef} type="file" hidden accept="image/*" capture="environment" onChange={handleImageSelected} />
                <input ref={uploadInputRef} type="file" hidden accept="image/*" onChange={handleImageSelected} />

                <div className={`ocr-image-options ${isMobileOrTablet ? 'mobile' : 'desktop'}`}>
                  {isMobileOrTablet && (
                    <button type="button" className="ocr-upload-card" onClick={() => cameraInputRef.current?.click()}>
                      <span className="ocr-upload-card-icon">CAM</span>
                      <span>
                        <strong>Take Photo</strong>
                        <small>Use the device camera</small>
                      </span>
                    </button>
                  )}
                  <button type="button" className="ocr-upload-card" onClick={() => uploadInputRef.current?.click()}>
                    <span className="ocr-upload-card-icon">IMG</span>
                    <span>
                      <strong>Upload Image</strong>
                      <small>Select JPG, JPEG, or PNG</small>
                    </span>
                  </button>
                </div>

                {previewUrl && (
                  <div
                    className={`ocr-preview-panel ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <div className="upload-preview-container">
                      <img src={previewUrl} alt="Preview" className="upload-preview" />
                      <button type="button" className="remove-preview-btn" onClick={clearUpload}>
                        X
                      </button>
                    </div>
                    <div className="ocr-preview-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => uploadInputRef.current?.click()}>
                        Change Image
                      </button>
                    </div>
                    {compressionInfo && (
                      <p style={{ color: 'var(--color-accent)', fontSize: '0.85rem', marginTop: '0.75rem', fontWeight: '500' }}>
                        {compressionInfo}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedFile && (
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem' }} disabled={!selectedFile || isLoading}>
                    {isLoading ? 'Scanning and grading...' : 'Grade with AI'}
                  </button>
                </div>
              )}
            </section>
          )}
        </form>
      )}
    </div>
  );
}

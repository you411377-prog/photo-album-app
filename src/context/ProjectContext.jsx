import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ProjectContext = createContext(null);

/**
 * Central project state — replaces localStorage coupling between pages.
 *
 * Flow: FilterPage → ReviewPage → StylePage → GeneratePage → SharePage
 * Each page reads/writes to this context instead of localStorage.
 */
export const ProjectProvider = ({ children }) => {
  // --- Filter stage ---
  const [filteredMedia, setFilteredMedia] = useState([]);
  const [importedMedia, setImportedMedia] = useState([]);

  // --- Review stage (dedup/quality) ---
  const [reviewedMedia, setReviewedMedia] = useState([]);

  // --- Style stage ---
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [textTone, setTextTone] = useState('温情');

  // --- Generate stage ---
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoMime, setVideoMime] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [textBundle, setTextBundle] = useState({ title: '', intro: '', ending: '' });

  // --- Derived ---
  const derived = useMemo(() => {
    const media = reviewedMedia.length > 0 ? reviewedMedia : filteredMedia;
    const dates = media.map(m => m.date).filter(Boolean).sort();
    const start = dates[0] ?? '';
    const end = dates[dates.length - 1] ?? '';
    const locations = media.map(m => m.location).filter(Boolean);
    const location = locations[0] ?? '';
    return { start, end, location, mediaCount: media.length };
  }, [filteredMedia, reviewedMedia]);

  // Convenience: the "current" media list (reviewed if available, else filtered)
  const currentMedia = reviewedMedia.length > 0 ? reviewedMedia : filteredMedia;

  // --- Actions ---
  const commitFilter = useCallback((media) => {
    setFilteredMedia(media);
    setReviewedMedia([]); // reset downstream
    // Also write to localStorage for backward compat during migration
    try { localStorage.setItem('filteredMedia', JSON.stringify(media)); } catch { /* noop */ }
  }, []);

  const commitReview = useCallback((media) => {
    setReviewedMedia(media);
    try { localStorage.setItem('filteredMedia', JSON.stringify(media)); } catch { /* noop */ }
  }, []);

  const commitStyle = useCallback((style, tone) => {
    setSelectedStyle(style);
    setTextTone(tone);
    try {
      localStorage.setItem('selectedStyle', JSON.stringify(style));
      localStorage.setItem('textTone', tone);
    } catch { /* noop */ }
  }, []);

  const commitVideo = useCallback((blob, mime, url) => {
    setVideoBlob(blob);
    setVideoMime(mime);
    setVideoUrl(url);
  }, []);

  const resetProject = useCallback(() => {
    setFilteredMedia([]);
    setImportedMedia([]);
    setReviewedMedia([]);
    setSelectedStyle(null);
    setTextTone('温情');
    setVideoBlob(null);
    setVideoMime('');
    setVideoUrl('');
    setTextBundle({ title: '', intro: '', ending: '' });
  }, []);

  const value = useMemo(() => ({
    // State
    filteredMedia,
    importedMedia,
    setImportedMedia,
    reviewedMedia,
    selectedStyle,
    textTone,
    videoBlob,
    videoMime,
    videoUrl,
    textBundle,
    setTextBundle,
    derived,
    currentMedia,
    // Actions
    commitFilter,
    commitReview,
    commitStyle,
    commitVideo,
    resetProject,
  }), [
    filteredMedia, importedMedia, reviewedMedia,
    selectedStyle, textTone,
    videoBlob, videoMime, videoUrl,
    textBundle, derived, currentMedia,
    commitFilter, commitReview, commitStyle, commitVideo, resetProject,
  ]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
};

export default ProjectContext;

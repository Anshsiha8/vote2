import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { StudentVotePage } from './pages/StudentVotePage';

// Lazy-load heavy host, presentation, and admin routes to keep student voting bundle ultra-lightweight
const HostDashboardPage = lazy(() =>
  import('./pages/HostDashboardPage').then((m) => ({ default: m.HostDashboardPage }))
);
const CreatePollPage = lazy(() =>
  import('./pages/CreatePollPage').then((m) => ({ default: m.CreatePollPage }))
);
const CreateQuizPage = lazy(() =>
  import('./pages/CreateQuizPage').then((m) => ({ default: m.CreateQuizPage }))
);
const PollRoomPage = lazy(() =>
  import('./pages/PollRoomPage').then((m) => ({ default: m.PollRoomPage }))
);
const LiveResultsPage = lazy(() =>
  import('./pages/LiveResultsPage').then((m) => ({ default: m.LiveResultsPage }))
);
const PresentationMode = lazy(() =>
  import('./pages/PresentationMode').then((m) => ({ default: m.PresentationMode }))
);
const SupabaseConfigModal = lazy(() =>
  import('./components/SupabaseConfigModal').then((m) => ({ default: m.SupabaseConfigModal }))
);

const PageLoadingFallback = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
    <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
    <span className="text-xs font-medium text-slate-400">Loading module...</span>
  </div>
);

function AppLayout() {
  const location = useLocation();
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  const isPresentation = location.pathname.includes('/present');
  const isStudentVoting =
    (location.pathname.startsWith('/poll/') ||
     location.pathname.startsWith('/vote/') ||
     location.pathname.startsWith('/join/')) &&
    !location.pathname.includes('/room') &&
    !location.pathname.includes('/results') &&
    !location.pathname.includes('/present');

  return (
    <div className="flex flex-col min-h-screen">
      {!isPresentation && !isStudentVoting && (
        <Navbar onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)} />
      )}

      <main className="flex-1">
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/host"
              element={
                <HostDashboardPage
                  onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
                />
              }
            />
            <Route path="/create-poll" element={<CreatePollPage />} />
            <Route path="/create-quiz" element={<CreateQuizPage />} />
            <Route path="/poll/:pollId/room" element={<PollRoomPage />} />
            <Route path="/poll/:pollId/results" element={<LiveResultsPage />} />
            <Route path="/poll/:pollId/present" element={<PresentationMode />} />
            {/* Student Voting Routes (Directly imported for maximum speed and minimum bundle size) */}
            <Route path="/poll/:pollId" element={<StudentVotePage />} />
            <Route path="/vote/:pollId" element={<StudentVotePage />} />
            <Route path="/join/:pollId" element={<StudentVotePage />} />
            <Route path="/join" element={<LandingPage />} />
            {/* Fallback route */}
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Suspense>
      </main>

      {!isPresentation && !isStudentVoting && <Footer />}

      {isSupabaseModalOpen && (
        <Suspense fallback={null}>
          <SupabaseConfigModal
            isOpen={isSupabaseModalOpen}
            onClose={() => setIsSupabaseModalOpen(false)}
            onCredentialsSaved={() => {
              window.dispatchEvent(new CustomEvent('campus_vote_update', { detail: {} }));
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

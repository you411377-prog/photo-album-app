import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from './context/ProjectContext';
import HomePage from './pages/HomePage';
import FilterPage from './pages/FilterPage';
import ReviewPage from './pages/ReviewPage';
import StylePage from './pages/StylePage';
import GeneratePage from './pages/GeneratePage';
import SharePage from './pages/SharePage';
import './App.css';

function App() {
  return (
    <ProjectProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/filter" element={<FilterPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/style" element={<StylePage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/share/:shareId" element={<SharePage />} />
        </Routes>
      </Router>
    </ProjectProvider>
  );
}

export default App;

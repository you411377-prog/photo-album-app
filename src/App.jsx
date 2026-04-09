import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SplashScreen from './pages/SplashScreen';
import PermissionPage from './pages/PermissionPage';
import HomePage from './pages/HomePage';
import FilterPage from './pages/FilterPage';
import ReviewPage from './pages/ReviewPage';
import StylePage from './pages/StylePage';
import GeneratePage from './pages/GeneratePage';
import SharePage from './pages/SharePage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/permission" element={<PermissionPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/filter" element={<FilterPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/style" element={<StylePage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/share/:shareId" element={<SharePage />} />
      </Routes>
    </Router>
  );
}

export default App;

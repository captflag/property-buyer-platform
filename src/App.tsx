import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ConstructionUpdates } from './pages/ConstructionUpdates';
import { DocumentLibrary } from './pages/DocumentLibrary';
import { Support } from './pages/Support';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import './App.css';
import './components.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Header />
        <div className="main-layout">
          <Navigation />
          <main className="content" role="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/updates" element={<ConstructionUpdates />} />
              <Route path="/documents" element={<DocumentLibrary />} />
              <Route path="/support" element={<Support />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
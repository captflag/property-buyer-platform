const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Property Buyer Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// Mock data endpoints
app.get('/api/projects', (req, res) => {
  res.json({
    projects: [
      {
        id: '1',
        name: 'Sunset Villa Construction',
        address: '123 Sunset Drive, California',
        status: 'in-progress',
        completionPercentage: 65,
        estimatedCompletion: '2024-03-15',
        startDate: '2023-09-01'
      }
    ]
  });
});

app.get('/api/updates/:projectId', (req, res) => {
  const { projectId } = req.params;
  res.json({
    updates: [
      {
        id: '1',
        projectId,
        title: 'Foundation Complete',
        description: 'Foundation work completed successfully.',
        date: new Date().toISOString(),
        status: 'completed'
      },
      {
        id: '2',
        projectId,
        title: 'Framing in Progress',
        description: 'Structural framing is 75% complete.',
        date: new Date(Date.now() - 86400000).toISOString(),
        status: 'in-progress'
      }
    ]
  });
});

// Fallback to serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
const express = require('express');
const router = express.Router();

// GET /api/updates/:projectId
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // TODO: Fetch updates from database
    const mockUpdates = [
      {
        id: '1',
        projectId,
        title: 'Foundation Complete',
        description: 'Foundation work has been completed successfully.',
        date: new Date().toISOString(),
        images: [],
        status: 'completed'
      },
      {
        id: '2',
        projectId,
        title: 'Framing in Progress',
        description: 'Structural framing is 75% complete.',
        date: new Date(Date.now() - 86400000).toISOString(),
        images: [],
        status: 'in-progress'
      }
    ];
    
    res.json({ updates: mockUpdates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/updates/:projectId
router.post('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const updateData = req.body;
    
    // TODO: Save update to database and broadcast via socket
    const newUpdate = {
      id: Date.now().toString(),
      projectId,
      ...updateData,
      date: new Date().toISOString()
    };
    
    // Broadcast to connected clients
    req.app.get('socketio').to(`project-${projectId}`).emit('update-received', newUpdate);
    
    res.status(201).json({ update: newUpdate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
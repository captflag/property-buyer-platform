const express = require('express');
const router = express.Router();

// GET /api/documents/:projectId
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // TODO: Fetch documents from database
    const mockDocuments = [
      {
        id: '1',
        projectId,
        name: 'Building Permit',
        type: 'permit',
        url: '/documents/building-permit.pdf',
        uploadDate: '2023-09-01',
        size: '2.5 MB'
      },
      {
        id: '2',
        projectId,
        name: 'Architectural Plans',
        type: 'blueprint',
        url: '/documents/architectural-plans.pdf',
        uploadDate: '2023-09-01',
        size: '15.2 MB'
      }
    ];
    
    res.json({ documents: mockDocuments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
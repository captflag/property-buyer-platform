const express = require('express');
const router = express.Router();

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    // TODO: Fetch projects from database
    const mockProjects = [
      {
        id: '1',
        name: 'Sunset Villa Construction',
        address: '123 Sunset Drive, California',
        status: 'in-progress',
        completionPercentage: 65,
        estimatedCompletion: '2024-03-15',
        startDate: '2023-09-01'
      }
    ];
    
    res.json({ projects: mockProjects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Fetch specific project from database
    const mockProject = {
      id,
      name: 'Sunset Villa Construction',
      address: '123 Sunset Drive, California',
      status: 'in-progress',
      completionPercentage: 65,
      estimatedCompletion: '2024-03-15',
      startDate: '2023-09-01',
      description: 'Modern 3-bedroom villa with sustainable features',
      contractor: 'ABC Construction Co.',
      architect: 'Design Studio XYZ'
    };
    
    res.json({ project: mockProject });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();

// POST /api/support/chat
router.post('/chat', async (req, res) => {
  try {
    const { message, projectId } = req.body;
    
    // TODO: Integrate with AI service (OpenAI, etc.)
    const aiResponse = {
      message: `Thank you for your question: "${message}". This is a mock response. AI integration will be implemented here.`,
      timestamp: new Date().toISOString(),
      projectId
    };
    
    res.json({ response: aiResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/support/faq
router.get('/faq', async (req, res) => {
  try {
    const mockFAQ = [
      {
        id: '1',
        question: 'How often are construction updates posted?',
        answer: 'Updates are posted daily when work is in progress, and weekly during planning phases.'
      },
      {
        id: '2',
        question: 'Can I visit the construction site?',
        answer: 'Site visits can be arranged with advance notice for safety and coordination purposes.'
      }
    ];
    
    res.json({ faq: mockFAQ });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Send, Mail, Phone, MessageCircle, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const Support: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [faq, setFAQ] = useState<FAQItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load FAQ on component mount
    const fetchFAQ = async () => {
      try {
        const response = await fetch('/api/support/faq');
        if (response.ok) {
          const data = await response.json();
          setFAQ(data.faq);
        }
      } catch (error) {
        console.error('Failed to fetch FAQ:', error);
        setFAQ([
          {
            id: '1',
            question: 'How often are construction updates posted?',
            answer: 'Updates are posted daily when work is in progress, and weekly during planning phases. You can view all updates in the Construction Updates section.'
          },
          {
            id: '2',
            question: 'Can I visit the construction site?',
            answer: 'Site visits can be arranged with advance notice for safety and coordination purposes. Please contact our team at least 48 hours in advance.'
          },
          {
            id: '3',
            question: 'How do I access project documents?',
            answer: 'All project documents are available in the Document Library section. You can view and download permits, plans, contracts, and certificates at any time.'
          },
          {
            id: '4',
            question: 'What if I notice an issue during construction?',
            answer: 'Please report any concerns immediately through this chat system or by contacting our support team directly. We take all feedback seriously and will investigate promptly.'
          }
        ]);
      }
    };

    fetchFAQ();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: inputValue,
          projectId: '1'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response.message,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'I apologize, but I\'m experiencing technical difficulties. Please try again or contact support directly.',
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="support">
      <header className="page-header">
        <h1>AI-Powered Support</h1>
        <p className="page-description">
          Get instant answers to your construction questions with our intelligent support system.
        </p>
      </header>

      <div className="support-layout">
        <div className="chat-section">
          <div className="chat-container">
            <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
              {messages.length === 0 && (
                <div className="welcome-message">
                  <div className="ai-avatar" aria-hidden="true">
                    <Bot size={32} />
                  </div>
                  <div className="welcome-text">
                    <h2>Hello! I'm your AI construction assistant.</h2>
                    <p>I can help answer questions about your project, timeline, materials, and more. What would you like to know?</p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.sender === 'user' ? 'message--user' : 'message--ai'}`}
                >
                  <div className="message-avatar" aria-hidden="true">
                    {message.sender === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className="message-content">
                    <div className="message-text">{message.text}</div>
                    <time className="message-time" dateTime={message.timestamp.toISOString()}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message message--ai">
                  <div className="message-avatar" aria-hidden="true">
                    <Bot size={20} />
                  </div>
                  <div className="message-content">
                    <div className="typing-indicator" aria-label="AI is typing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="chat-form">
              <label htmlFor="message-input" className="sr-only">
                Type your message
              </label>
              <input
                id="message-input"
                type="text"
                className="chat-input"
                placeholder="Ask me anything about your construction project..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                maxLength={500}
              />
              <button
                type="submit"
                className="chat-submit"
                disabled={isLoading || !inputValue.trim()}
                aria-label="Send message"
              >
                <Send size={18} />
                Send
              </button>
            </form>
          </div>
        </div>

        <aside className="faq-section" role="complementary">
          <div className="faq-header">
            <HelpCircle size={24} className="faq-header-icon" />
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="faq-list">
            {faq.map((item) => (
              <details key={item.id} className="faq-item">
                <summary className="faq-question">{item.question}</summary>
                <div className="faq-answer">{item.answer}</div>
              </details>
            ))}
          </div>

          <div className="support-info">
            <h3>Need More Help?</h3>
            <p>For urgent matters or complex issues, please contact our support team directly:</p>
            <ul>
              <li>
                <Mail size={16} className="contact-icon" />
                <span>support@propertybuyer.com</span>
              </li>
              <li>
                <Phone size={16} className="contact-icon" />
                <span>1-800-BUILD-NOW</span>
              </li>
              <li>
                <MessageCircle size={16} className="contact-icon" />
                <span>Live Chat: Available 24/7</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
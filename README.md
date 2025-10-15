# 🏗️ Property Buyer Platform

A comprehensive customer-facing platform designed to provide property buyers with transparent, real-time insights into their construction projects.

![Platform Preview](https://via.placeholder.com/800x400/4FACFE/ffffff?text=Property+Buyer+Platform)

## ✨ Features

### 🏗️ Real-time Construction Updates
- Live progress tracking with photos and timeline updates
- Interactive project milestones and completion status
- Push notifications for important project updates
- Weather impact tracking and notifications

### 📋 Transparent Documentation
- Access to all project documents and permits
- Change orders and modifications tracking
- Financial transparency with cost breakdowns
- Quality inspection reports and certifications

### 🤖 AI-Powered Support
- Intelligent chatbot for instant project questions
- Automated FAQ responses
- Smart document search and retrieval
- Predictive timeline adjustments based on progress

### ♿ Accessible UX for All Users
- WCAG 2.1 AA compliance
- Screen reader compatibility
- Keyboard navigation support
- High contrast and large text options
- Multi-language support

## 🛠️ Technology Stack

- **Frontend**: React 18+ with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Prisma ORM
- **Real-time Updates**: WebSocket integration
- **AI Integration**: OpenAI API for intelligent support
- **Authentication**: JWT with refresh tokens
- **File Storage**: AWS S3 for documents and media
- **Deployment**: Docker containers on AWS

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL 14+
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/property-buyer-platform.git
   cd property-buyer-platform
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development servers:**

   **Frontend (React):**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`

   **Backend (Express - in a separate terminal):**
   ```bash
   npm run server
   ```
   The API will be available at `http://localhost:3001`

## 📁 Project Structure

```
property-buyer-platform/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Route components
│   ├── services/          # API clients and external services
│   ├── utils/             # Helper functions and utilities
│   └── types/             # TypeScript type definitions
├── backend/               # Node.js API server
│   ├── routes/            # API route definitions
│   ├── middleware/        # Express middleware
│   ├── models/            # Data models and schemas
│   └── services/          # Business logic services
├── docs/                  # Documentation
├── tests/                 # Test files
├── public/                # Static assets
└── assets/                # Project assets and media
```

## 🎨 Design Features

### Soothing UI/UX
- **Soft gradient backgrounds** with calming blue tones
- **Glass-morphism effects** with backdrop blur
- **Gentle floating animations** for interactive elements
- **Smooth transitions** and hover effects
- **Professional typography** with Inter font family

### Accessibility-First
- Full WCAG 2.1 AA compliance
- Screen reader optimization
- Keyboard navigation support
- High contrast mode
- Responsive design for all devices

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production application
- `npm run serve` - Preview production build
- `npm run server` - Start backend API server
- `npm run dev:server` - Start backend with nodemon
- `npm run test` - Run test suite
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### API Endpoints

- `GET /api/health` - Health check
- `GET /api/projects` - Get user projects
- `GET /api/projects/:id` - Get specific project
- `GET /api/updates/:projectId` - Get construction updates
- `POST /api/updates/:projectId` - Create new update
- `GET /api/documents/:projectId` - Get project documents
- `POST /api/support/chat` - AI chat support
- `GET /api/support/faq` - Get FAQ items

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🚀 Deployment

### Using Docker

```bash
# Build the application
npm run build

# Build Docker image
docker build -t property-buyer-platform .

# Run container
docker run -p 3000:3000 property-buyer-platform
```

### Environment Variables

Required environment variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/property_buyer_platform

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# AI Integration
OPENAI_API_KEY=your_openai_api_key_here

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your_s3_bucket_name
```

## 📱 Features Demo

### Dashboard
- Project overview with progress tracking
- Real-time status updates
- Quick access to all platform features

### Construction Updates
- Timeline view of construction progress
- Photo galleries for each milestone
- Status indicators and completion percentages

### Document Library
- Organized document categories
- Search and filter functionality
- Secure document viewing and downloading

### AI Support
- Real-time chat interface
- Intelligent question answering
- FAQ section with common queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

This project uses:
- ESLint for code linting
- Prettier for code formatting
- Husky for pre-commit hooks
- TypeScript for type safety

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- 📧 Email: support@propertybuyer.com
- 📖 Documentation: [docs.propertybuyer.com](https://docs.propertybuyer.com)
- 🐛 Issues: [GitHub Issues](https://github.com/YOUR_USERNAME/property-buyer-platform/issues)

## 🙏 Acknowledgments

- Built with modern React and Node.js
- Designed with accessibility in mind
- Inspired by the need for transparent construction communication

---

⭐ **Star this repo if you find it helpful!** ⭐
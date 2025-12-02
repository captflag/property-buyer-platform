# Property Buyer Platform Documentation

## 🏢 Project Overview
The **Property Buyer Platform** is a premium, customer-facing web application designed to provide property buyers with transparent, real-time insights into their construction projects. It features a luxurious, professional interface comparable to high-end real estate platforms.

## 🚀 Technology Stack
- **Frontend**: React 18, TypeScript, Vite
- **Styling**: CSS Modules, Glassmorphism effects, Lucide React Icons
- **Backend**: Node.js, Express
- **Real-time**: Socket.io (configured for port 3001)

## ✨ Key Features & Enhancements

### 🎨 Premium User Interface
- **Royal Header Design**: Luxurious deep navy/purple gradient with gold accents (#d4af37) and elegant typography.
- **Professional Imagery**: AI-generated high-quality construction and architectural images.
- **Modern Icons**: Comprehensive integration of `lucide-react` SVG icons.
- **Animations**: Smooth transitions, hover effects, and modern loading spinners.

### 📊 Dashboard
- **Hero Section**: Dynamic background with property visualization.
- **Statistics**: Animated cards showing completion %, expected date, and status.
- **Quick Actions**: Easy access to updates, documents, and support.

### 🏗️ Construction Updates
- **Timeline Visualization**: Vertical timeline with status-based color coding.
- **Visual Progress**: Updates include professional photos of foundation, framing, interior, and roofing work.
- **Status Indicators**: Scheduled (Purple), In-Progress (Blue), Completed (Green).

### 📂 Document Library
- **Smart Organization**: Color-coded icons for Permits, Blueprints, Contracts, and Certificates.
- **Search**: Real-time filtering with professional search interface.

### 🤖 AI Support
- **Chat Interface**: Professional chat UI with AI and User avatars.
- **FAQ**: Expandable section with common questions.
- **Contact**: Integrated contact options (Email, Phone, Chat).

## 🛠️ Development Commands

### Frontend
```bash
npm run dev          # Start development server (Port 5173)
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend
```bash
npm run server       # Start backend server
npm run dev:server   # Start backend with nodemon
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## 📁 Project Structure
```
src/
├── components/      # Reusable UI components (Header, Navigation)
├── pages/           # Main route components (Dashboard, Updates, etc.)
├── assets/          # Static assets
├── App.css          # Global and layout styles
├── components.css   # Component-specific styles
└── main.tsx         # Entry point
```

## 🎨 Design System
- **Primary Colors**: Royal Blue (`#4facfe`), Cyan (`#00f2fe`)
- **Accent Colors**: Gold (`#d4af37`), Royal Purple (`#2d1b4e`)
- **Typography**: Inter (Google Fonts)
- **Visual Style**: Glassmorphism, Gradients, Rounded Corners (16px/20px)
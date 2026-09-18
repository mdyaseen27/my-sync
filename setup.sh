#!/bin/bash
set -e

echo "🚀 MY Sync — Setup Script"
echo "================================"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install it first."
    exit 1
fi

echo "📦 Installing dependencies..."

# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

echo ""
echo "📝 Copy .env.example to .env and fill in your Supabase credentials"
echo ""
echo "   Backend:  cp backend/.env.example backend/.env"
echo "   Frontend: cp frontend/.env.example frontend/.env"
echo ""
echo "⚡ To start development:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "✅ Setup complete!"
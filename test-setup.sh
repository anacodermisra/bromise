#!/bin/bash
# BROMISE Test Setup Script

echo "🚀 BROMISE - Bug Fix Testing Script"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file. Please update with your credentials."
    echo ""
fi

echo "📦 Step 1: Fixing npm vulnerabilities..."
npm audit fix

echo ""
echo "🔨 Step 2: Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi

echo ""
echo "🧹 Step 3: Running linter..."
npm run lint

echo ""
echo "✅ All checks passed!"
echo ""
echo "🎯 Ready to test! Run these commands:"
echo ""
echo "  Terminal 1: npm run dev        # Start frontend (port 5173)"
echo "  Terminal 2: npm run dev:server # Start backend (port 3001)"
echo ""
echo "  Or run both: npm run dev:all"
echo ""
echo "🌐 Then open: http://localhost:5173"
echo ""
echo "📋 Test checklist available in DEPLOYMENT.md"

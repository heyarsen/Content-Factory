#!/bin/bash

# Content Factory - Automated Deployment Script
# This script sets up the application for production deployment

set -e  # Exit on any error

echo "🚀 Content Factory Deployment Script"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v) ✓"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL is not installed. Installing..."
    
    # Detect OS and install PostgreSQL
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt update
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install postgresql
            brew services start postgresql
        else
            print_error "Homebrew not found. Please install PostgreSQL manually."
            exit 1
        fi
    else
        print_error "Unsupported OS. Please install PostgreSQL manually."
        exit 1
    fi
fi

print_status "PostgreSQL is available ✓"

# Install dependencies
print_status "Installing npm dependencies..."
npm install

# Check if .env exists
if [ ! -f ".env" ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    
    # Generate a secure JWT secret
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "\n")
    
    # Update .env with generated JWT secret
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your-super-secret-jwt-key-change-this-in-production-make-it-very-long-and-random/$JWT_SECRET/" .env
    else
        sed -i "s/your-super-secret-jwt-key-change-this-in-production-make-it-very-long-and-random/$JWT_SECRET/" .env
    fi
    
    print_warning "Please edit .env file and configure:"
    print_warning "  - DATABASE_URL (PostgreSQL connection string)"
    print_warning "  - HEYGEN_KEY (for AI video generation)"
    print_warning "  - UPLOADPOST_KEY (for social media publishing)"
    print_warning "  - FRONTEND_URL (your domain for production)"
    
    echo ""
    read -p "Press Enter after you've configured the .env file..."
else
    print_status ".env file already exists ✓"
fi

# Setup database
print_status "Setting up database..."

# Check if DATABASE_URL is configured
if grep -q "postgresql://username:password@localhost:5432/contentfabrica" .env; then
    print_warning "DATABASE_URL is not configured. Setting up local database..."
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE IF NOT EXISTS contentfabrica;"
    sudo -u postgres psql -c "CREATE USER IF NOT EXISTS contentfabrica_user WITH ENCRYPTED PASSWORD 'contentfabrica_pass';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE contentfabrica TO contentfabrica_user;"
    
    # Update .env with local database URL
    LOCAL_DB_URL="postgresql://contentfabrica_user:contentfabrica_pass@localhost:5432/contentfabrica"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|postgresql://username:password@localhost:5432/contentfabrica|$LOCAL_DB_URL|" .env
    else
        sed -i "s|postgresql://username:password@localhost:5432/contentfabrica|$LOCAL_DB_URL|" .env
    fi
    
    print_status "Local database configured ✓"
fi

# Run database migrations
print_status "Running database migrations..."
npx prisma migrate dev --name init
npx prisma generate

# Seed database
print_status "Seeding database with initial data..."
npm run seed

# Build for production
print_status "Building application for production..."
npm run build

# Create systemd service file (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    print_status "Creating systemd service..."
    
    sudo tee /etc/systemd/system/content-factory.service > /dev/null <<EOF
[Unit]
Description=Content Factory Application
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=$(which node) server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable content-factory
    
    print_status "Systemd service created. Use 'sudo systemctl start content-factory' to start."
fi

print_status "🎉 Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. For development: npm run dev"
echo "2. For production: npm start"
echo "3. Access the app at: http://localhost:5173 (dev) or http://localhost:4000 (prod)"
echo ""
echo "Demo credentials:"
echo "  Email: demo@contentfabrica.com"
echo "  Password: demo123"
echo ""
echo "Production admin:"
echo "  Email: admin@contentfabrica.com"
echo "  Password: admin123"
echo ""
print_warning "Remember to:"
print_warning "  - Configure your domain in FRONTEND_URL"
print_warning "  - Get API keys for HeyGen and UploadPost"
print_warning "  - Set up SSL certificate for production"
print_warning "  - Configure firewall rules"

echo ""
print_status "For troubleshooting, see: QUICK_FIX.md"
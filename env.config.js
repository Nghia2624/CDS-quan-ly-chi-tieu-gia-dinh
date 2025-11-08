// Environment Configuration
export const envConfig = {
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/financeflow',
  MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017/financeflow_logs',
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-2024',
  
  // API Configuration
  API_PORT: parseInt(process.env.API_PORT) || 3001,
  CLIENT_PORT: parseInt(process.env.CLIENT_PORT) || 5173,
  
  // AI Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyAEKaLFrnUbHQ8jbGu23jk5hGop2UJMQbw',
  
  // Security Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5242880,
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  
  // Sync Configuration
  SYNC_INTERVAL_MS: parseInt(process.env.SYNC_INTERVAL_MS) || 30000,
  SYNC_TIMEOUT_MS: parseInt(process.env.SYNC_TIMEOUT_MS) || 10000,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log'
};

export default envConfig;


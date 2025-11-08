import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';

// Rate limiting configurations
export const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Input validation schemas
export const expenseSchema = z.object({
  description: z.string().min(1).max(500).trim(),
  amount: z.number().positive().max(100000000), // Max 100M VND
  category: z.string().min(1).max(50),
});

export const userSchema = z.object({
  email: z.string().email().max(100),
  password: z.string().min(8).max(100),
  fullName: z.string().min(1).max(100).trim(),
  phone: z.string().regex(/^[0-9+\-\s()]+$/).max(20).optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(2000).trim(),
  sessionId: z.string().uuid().optional(),
});

// Input validation middleware
export const validateInput = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dữ liệu đầu vào không hợp lệ',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// SQL injection protection
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj.replace(/[<>'"&]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
};

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:5000',
      'https://financeflow.app',
      'https://www.financeflow.app'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Request logging for security monitoring
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    // Log suspicious activities
    if (res.statusCode >= 400) {
      console.warn('Security Warning:', logData);
    }
    
    // Log all requests for monitoring
    console.log('Request:', logData);
  });
  
  next();
};

// API key validation (for external integrations)
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // In production, validate against database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// File upload security
export const fileUploadSecurity = (req: Request, res: Response, next: NextFunction) => {
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({ error: 'File too large' });
  }
  
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  const contentType = req.headers['content-type'];
  
  if (contentType && !allowedTypes.includes(contentType)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }
  
  next();
};

// Brute force protection
export const bruteForceProtection = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const key = `brute_force_${ip}`;
  
  // This would integrate with Redis in production
  // For now, we'll use a simple in-memory store
  const attempts = (global as any).bruteForceAttempts || {};
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  
  // Clean old attempts
  Object.keys(attempts).forEach(key => {
    if (now - attempts[key].timestamp > windowMs) {
      delete attempts[key];
    }
  });
  
  if (attempts[key] && attempts[key].count >= maxAttempts) {
    return res.status(429).json({ 
      error: 'Too many attempts. Please try again later.',
      retryAfter: Math.ceil((attempts[key].timestamp + windowMs - now) / 1000)
    });
  }
  
  next();
};

// Data encryption helper
export const encryptSensitiveData = (data: string): string => {
  // In production, use proper encryption like crypto.createCipher
  // For now, return base64 encoded data
  return Buffer.from(data).toString('base64');
};

export const decryptSensitiveData = (encryptedData: string): string => {
  // In production, use proper decryption
  // For now, decode base64
  return Buffer.from(encryptedData, 'base64').toString();
};


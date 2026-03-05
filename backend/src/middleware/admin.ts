import { Request, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from './auth';

export const requireAdmin = [
    authenticateToken,
    (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin role required.' });
        }
        next();
    }
];

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const encryption_1 = require("../utils/encryption");
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// In-memory storage for demo (in production, use database)
const packageStorage = new Map();
/**
 * Initialize encryption system (generate RSA keys if not exist)
 */
router.post('/init-keys', (req, res) => {
    try {
        if ((0, encryption_1.keysExist)()) {
            return res.json({
                status: 'success',
                message: 'RSA keys already exist',
                keysPath: path_1.default.join(process.cwd(), 'keys'),
            });
        }
        const { privateKey, publicKey } = (0, encryption_1.generateRSAKeyPair)();
        res.json({
            status: 'success',
            message: 'RSA-4096 key pair generated successfully',
            publicKey: publicKey.substring(0, 50) + '...',
            keysPath: path_1.default.join(process.cwd(), 'keys'),
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
});
/**
 * Encrypt a question paper
 * POST /api/encryption/encrypt
 * Body: { content: string, questionId?: number, examId?: string }
 */
router.post('/encrypt', (req, res) => {
    try {
        const { content, questionId, examId } = req.body;
        if (!content) {
            return res.status(400).json({
                status: 'error',
                message: 'Question content is required',
            });
        }
        // Ensure keys exist
        if (!(0, encryption_1.keysExist)()) {
            return res.status(400).json({
                status: 'error',
                message: 'RSA keys not initialized. Call /api/encryption/init-keys first',
            });
        }
        // Encrypt the question paper
        const encryptedPackage = (0, encryption_1.encryptQuestionPaper)(content);
        const packageId = (0, encryption_1.generatePackageId)();
        // Store the encrypted package
        packageStorage.set(packageId, {
            id: packageId,
            encryptedPackage,
            questionId: questionId || -1,
            createdBy: 'system',
            createdAt: new Date().toISOString(),
        });
        res.json({
            status: 'success',
            message: 'Question paper encrypted successfully',
            packageId,
            encryption: {
                algorithm: encryptedPackage.metadata.algorithm,
                keySize: encryptedPackage.metadata.keySize,
                timestamp: encryptedPackage.metadata.timestamp,
            },
            size: {
                original: Buffer.byteLength(content, 'utf8'),
                encrypted: Buffer.from(encryptedPackage.encryptedQP, 'base64').length,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
});
/**
 * Decrypt a question paper
 * POST /api/encryption/decrypt
 * Body: { packageId: string }
 */
router.post('/decrypt', (req, res) => {
    try {
        const { packageId } = req.body;
        if (!packageId) {
            return res.status(400).json({
                status: 'error',
                message: 'Package ID is required',
            });
        }
        const stored = packageStorage.get(packageId);
        if (!stored) {
            return res.status(404).json({
                status: 'error',
                message: 'Encrypted package not found',
            });
        }
        // Decrypt the package
        const decrypted = (0, encryption_1.decryptQuestionPaper)(stored.encryptedPackage);
        res.json({
            status: 'success',
            message: 'Question paper decrypted successfully',
            data: {
                packageId,
                content: decrypted.content,
                verification: {
                    signatureValid: decrypted.metadata.verified,
                    timestamp: decrypted.metadata.timestamp,
                },
                originalTimestamp: stored.createdAt,
            },
        });
    }
    catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message,
        });
    }
});
/**
 * Get available packages
 * GET /api/encryption/packages
 */
router.get('/packages', (req, res) => {
    const packages = Array.from(packageStorage.values()).map((pkg) => ({
        id: pkg.id,
        questionId: pkg.questionId,
        createdAt: pkg.createdAt,
        encryptedSize: Buffer.from(pkg.encryptedPackage.encryptedQP, 'base64').length,
    }));
    res.json({
        status: 'success',
        total: packages.length,
        packages,
    });
});
/**
 * Demo endpoint - shows full encryption/decryption flow
 * GET /api/encryption/demo
 */
router.get('/demo', (req, res) => {
    try {
        if (!(0, encryption_1.keysExist)()) {
            return res.status(400).json({
                status: 'error',
                message: 'RSA keys not initialized',
            });
        }
        const sampleQuestion = `EXAM: Mathematics Advanced
Question 1: Calculate the derivative

The function f(x) = 3x² + 2x + 1
Find f'(x)

A) 6x + 2
B) 6x² + 2
C) 3x + 1
D) 6x + 1

Answer: A

---

Question 2: Integration

∫(2x + 1)dx = ?

A) x² + x + C
B) 2x² + x + C  
C) x² + 2x + C
D) 2x + 1 + C

Answer: A`;
        // Encrypt
        const encrypted = (0, encryption_1.encryptQuestionPaper)(sampleQuestion);
        const packageId = (0, encryption_1.generatePackageId)();
        packageStorage.set(packageId, {
            id: packageId,
            encryptedPackage: encrypted,
            questionId: 1,
            createdBy: 'demo',
            createdAt: new Date().toISOString(),
        });
        // Decrypt
        const decrypted = (0, encryption_1.decryptQuestionPaper)(encrypted);
        res.json({
            status: 'success',
            message: 'Encryption/Decryption demo completed',
            flow: {
                step1: 'Original content encrypted with AES-256-GCM',
                step2: 'AES key encrypted with RSA-4096',
                step3: 'Package signed for tamper detection',
                step4: 'Client decrypts AES key with RSA private key',
                step5: 'Client decrypts content with AES-256-GCM',
            },
            results: {
                packageId,
                originalLength: sampleQuestion.length,
                encryptedLength: Buffer.from(encrypted.encryptedQP, 'base64').length,
                decryptedSuccessfully: decrypted.content === sampleQuestion,
                signatureVerified: decrypted.metadata.verified,
                algorithm: encrypted.metadata.algorithm,
            },
            decryptedContent: decrypted.content.substring(0, 200) + '...',
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
});
/**
 * Verify signature only (without decrypting content)
 * POST /api/encryption/verify
 */
router.post('/verify', (req, res) => {
    try {
        const { packageId } = req.body;
        if (!packageId) {
            return res.status(400).json({
                status: 'error',
                message: 'Package ID is required',
            });
        }
        const stored = packageStorage.get(packageId);
        if (!stored) {
            return res.status(404).json({
                status: 'error',
                message: 'Package not found',
            });
        }
        const encryptedQPBuffer = Buffer.from(stored.encryptedPackage.encryptedQP, 'base64');
        const signatureBuffer = Buffer.from(stored.encryptedPackage.signature, 'base64');
        const isValid = (0, encryption_1.verifySignature)(encryptedQPBuffer, signatureBuffer);
        res.json({
            status: 'success',
            packageId,
            signatureValid: isValid,
            message: isValid
                ? 'Package is authentic and has not been tampered'
                : 'WARNING: Package signature is invalid - possible tampering detected',
            timestamp: stored.createdAt,
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
});
/**
 * Get encryption info/status
 * GET /api/encryption/info
 */
router.get('/info', (req, res) => {
    res.json({
        status: 'success',
        encryption: {
            algorithm: 'Hybrid (AES-256-GCM + RSA-4096)',
            components: {
                dataEncryption: 'AES-256-GCM',
                keyEncryption: 'RSA-4096 with OAEP padding',
                signing: 'RSA-4096 PSS with SHA-256',
                integrity: 'SHA-256 HMAC (built into GCM)',
            },
            keyManagement: {
                initialized: (0, encryption_1.keysExist)(),
                keyPath: (0, encryption_1.keysExist)() ? path_1.default.join(process.cwd(), 'keys') : 'Not initialized',
            },
            securityProperties: [
                '✓ AES-256 encryption (256-bit key)',
                '✓ RSA-4096 key protection (4096-bit key)',
                '✓ Authenticated encryption (AES-GCM)',
                '✓ Digital signatures with PSS padding',
                '✓ Tamper detection',
                '✓ Nonce-based uniqueness per encryption',
                '✓ Time-stamped packages',
            ],
        },
        endpoints: {
            'POST /api/encryption/init-keys': 'Initialize RSA key pair',
            'POST /api/encryption/encrypt': 'Encrypt question paper',
            'POST /api/encryption/decrypt': 'Decrypt question paper',
            'GET /api/encryption/packages': 'List all encrypted packages',
            'POST /api/encryption/verify': 'Verify package signature',
            'GET /api/encryption/demo': 'Run complete demo',
        },
    });
});
exports.default = router;

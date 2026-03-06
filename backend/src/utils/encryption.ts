import crypto from 'crypto';
import NodeRSA from 'node-rsa';
import fs from 'fs';
import path from 'path';

const KEY_DIR = path.join(process.cwd(), 'keys');

// Ensure keys directory exists
if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
}

const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'private_key.pem');
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'public_key.pem');

export interface EncryptedPackage {
    encryptedQP: string; // base64 encoded
    encryptedAESKey: string; // base64 encoded
    signature: string; // base64 encoded
    metadata: {
        timestamp: string;
        algorithm: string;
        keySize: number;
        nonce: string; // base64 encoded
    };
}

export interface DecryptedPackage {
    content: string;
    metadata: {
        timestamp: string;
        verified: boolean;
    };
}

/**
 * Generate RSA-4096 key pair (one-time setup)
 */
export function generateRSAKeyPair(): { privateKey: string; publicKey: string } {
    try {
        const key = new NodeRSA({ b: 4096 });

        const privateKey = key.exportKey('private');
        const publicKey = key.exportKey('public');

        // Save to files
        fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
        fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

        console.log('✓ RSA Key Pair generated and saved to', KEY_DIR);

        return { privateKey, publicKey };
    } catch (error) {
        console.error('Error generating RSA key pair:', error);
        throw error;
    }
}

/**
 * Check if RSA keys exist
 */
export function keysExist(): boolean {
    try {
        const privExists = fs.existsSync(PRIVATE_KEY_PATH);
        const pubExists = fs.existsSync(PUBLIC_KEY_PATH);
        const result = privExists && pubExists;
        console.log(`Checking keys: private=${privExists}, public=${pubExists}, exists=${result}`);
        return result;
    } catch (error) {
        console.error('Error checking if keys exist:', error);
        return false;
    }
}

/**
 * Load public key from file
 */
function getPublicKey(): NodeRSA {
    const pubKeyContent = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    return new NodeRSA(pubKeyContent);
}

/**
 * Load private key from file
 */
function getPrivateKey(): NodeRSA {
    const privKeyContent = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    return new NodeRSA(privKeyContent);
}

/**
 * Encrypt question paper using AES-256-GCM
 */
function encryptAES(data: Buffer): { ciphertext: Buffer; nonce: Buffer; authTag: Buffer } {
    const aesKey = crypto.randomBytes(32); // AES-256
    const nonce = crypto.randomBytes(12); // GCM nonce

    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);

    let ciphertext = cipher.update(data);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Store AES key for later encryption with RSA
    (global as any).__tempAESKey = aesKey;

    return { ciphertext, nonce, authTag };
}

/**
 * Decrypt AES-256-GCM data
 */
export function decryptAES(
    ciphertext: Buffer,
    nonce: Buffer,
    aesKey: Buffer,
    authTag: Buffer
): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext;
}

/**
 * Encrypt AES key using RSA-4096
 */
function encryptAESKeyWithRSA(aesKey: Buffer): Buffer {
    const publicKey = getPublicKey();
    const encrypted = publicKey.encrypt(aesKey);
    return Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
}

/**
 * Decrypt AES key using RSA-4096
 */
function decryptAESKeyWithRSA(encryptedKey: Buffer): Buffer {
    const privateKey = getPrivateKey();
    const decrypted = privateKey.decrypt(encryptedKey);
    return Buffer.isBuffer(decrypted) ? decrypted : Buffer.from(decrypted);
}

/**
 * Sign encrypted data using Node's crypto module with RSA private key
 */
function signData(data: Buffer): Buffer {
    const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    
    const signature = sign.sign({
        key: privateKeyPem,
        format: 'pem',
        type: 'pkcs8',
    });
    
    return signature;
}

/**
 * Verify signature using Node's crypto module with RSA public key
 */
export function verifySignature(data: Buffer, signature: Buffer): boolean {
    try {
        const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
        
        const verify = crypto.createVerify('SHA256');
        verify.update(data);
        
        return verify.verify({
            key: publicKeyPem,
            format: 'pem',
        }, signature);
    } catch (error) {
        console.error('Signature verification failed:', error);
        return false;
    }
}

/**
 * Complete encryption workflow for question paper
 */
export function encryptQuestionPaper(questionContent: string): EncryptedPackage {
    const data = Buffer.from(questionContent, 'utf8');

    // Step 1: Encrypt with AES-256-GCM
    const { ciphertext, nonce, authTag } = encryptAES(data);

    // Combine ciphertext and authTag for signing
    const dataToSign = Buffer.concat([ciphertext, authTag]);

    // Step 2: Sign the encrypted data
    const signature = signData(dataToSign);

    // Step 3: Get the temporary AES key and encrypt it with RSA
    const aesKey = (global as any).__tempAESKey;
    const encryptedAESKey = encryptAESKeyWithRSA(aesKey);

    return {
        encryptedQP: Buffer.concat([ciphertext, authTag]).toString('base64'),
        encryptedAESKey: encryptedAESKey.toString('base64'),
        signature: signature.toString('base64'),
        metadata: {
            timestamp: new Date().toISOString(),
            algorithm: 'AES-256-GCM + RSA-4096',
            keySize: 4096,
            nonce: nonce.toString('base64'),
        },
    };
}

/**
 * Complete decryption workflow
 */
export function decryptQuestionPaper(encryptedPackage: EncryptedPackage): DecryptedPackage {
    try {
        // Convert from base64
        const encryptedQPBuffer = Buffer.from(encryptedPackage.encryptedQP, 'base64');
        const encryptedAESKeyBuffer = Buffer.from(encryptedPackage.encryptedAESKey, 'base64');
        const signatureBuffer = Buffer.from(encryptedPackage.signature, 'base64');
        const nonceBuffer = Buffer.from(encryptedPackage.metadata.nonce, 'base64');

        // Step 1: Verify signature
        const isValid = verifySignature(encryptedQPBuffer, signatureBuffer);
        if (!isValid) {
            throw new Error('Signature verification failed - package may be tampered');
        }

        // Step 2: Decrypt AES key using RSA private key
        const aesKey = decryptAESKeyWithRSA(encryptedAESKeyBuffer);

        // Step 3: Extract ciphertext and authTag
        // authTag is last 16 bytes of GCM
        const authTag = encryptedQPBuffer.slice(-16);
        const ciphertext = encryptedQPBuffer.slice(0, -16);

        // Step 4: Decrypt question paper using AES-256-GCM
        const plaintext = decryptAES(ciphertext, nonceBuffer, aesKey, authTag);

        return {
            content: plaintext.toString('utf8'),
            metadata: {
                timestamp: encryptedPackage.metadata.timestamp,
                verified: true,
            },
        };
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
}

/**
 * Generate random exam package ID
 */
export function generatePackageId(): string {
    return crypto.randomUUID();
}

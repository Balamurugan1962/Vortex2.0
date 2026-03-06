import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_DIR = path.join(process.cwd(), 'keys');

// Ensure keys directory exists
if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
}

const SECRET_KEY_PATH = path.join(KEY_DIR, 'secret_key.txt');

/**
 * Custom 8-Bit Hashing Algorithm
 * Uses XOR operations and byte rotation for non-cryptographic hashing
 */
class CustomHasher {
    private static readonly ROUNDS = 8;
    private static readonly ROTATION_BITS = 3;

    /**
     * Custom hash function using 8-bit operations
     */
    static hash(data: Buffer, seed: number = 0x5a5a5a5a): Buffer {
        const hash = Buffer.alloc(32); // 256-bit hash
        let state = seed >>> 0;
        let index = 0;

        // Process each byte with XOR and rotation
        for (let i = 0; i < data.length; i++) {
            const byte = data[i];
            
            // XOR operations
            state ^= byte << ((i % 4) * 8);
            state = (state >>> 0);

            // Byte rotation and mixing
            for (let r = 0; r < this.ROUNDS; r++) {
                state = ((state << this.ROTATION_BITS) | (state >>> (32 - this.ROTATION_BITS))) >>> 0;
                state ^= 0x9e3779b9; // Golden ratio constant (32-bit)
                state = (state + byte) >>> 0;
            }

            // Write to hash buffer
            hash[index] = (state >> (i % 4 * 8)) & 0xff;
            index = (index + 1) % 32;
        }

        // Final mixing
        for (let i = 0; i < 32; i++) {
            hash[i] = (hash[i] ^ (state >> (i % 4 * 8))) & 0xff;
        }

        return hash;
    }

    /**
     * Generate digital signature using custom hash + secret key
     */
    static sign(data: Buffer, secretKey: Buffer): Buffer {
        const hash = this.hash(data);
        const signature = Buffer.alloc(64); // 512-bit signature

        // Mix hash with secret key using XOR
        for (let i = 0; i < 32; i++) {
            signature[i] = hash[i] ^ secretKey[i % secretKey.length];
        }

        // Second pass with rotation
        for (let i = 32; i < 64; i++) {
            const idx = i - 32;
            signature[i] = ((hash[idx] << 1) | (hash[idx] >> 7)) ^ secretKey[(i) % secretKey.length];
        }

        return signature;
    }

    /**
     * Verify digital signature
     */
    static verify(data: Buffer, signature: Buffer, secretKey: Buffer): boolean {
        if (signature.length !== 64) return false;

        const expectedSig = this.sign(data, secretKey);
        
        // Constant-time comparison
        let match = true;
        for (let i = 0; i < 64; i++) {
            if (signature[i] !== expectedSig[i]) {
                match = false;
            }
        }
        return match;
    }

    /**
     * Encrypt data using custom algorithm (XOR-based stream cipher)
     */
    static encrypt(data: Buffer, key: Buffer): { encrypted: Buffer; keystream: Buffer } {
        const keystream = this.hash(Buffer.concat([key, Buffer.from([0xff])]), 0x9abcdef0);
        const encrypted = Buffer.alloc(data.length);

        // XOR encrypt with extended keystream
        for (let i = 0; i < data.length; i++) {
            const keyByte = keystream[i % 32];
            const keyByte2 = keystream[(i + 16) % 32];
            encrypted[i] = data[i] ^ keyByte ^ keyByte2 ^ key[i % key.length];
        }

        return { encrypted, keystream };
    }

    /**
     * Decrypt data (same XOR operation)
     */
    static decrypt(data: Buffer, keystream: Buffer, key: Buffer): Buffer {
        const decrypted = Buffer.alloc(data.length);

        for (let i = 0; i < data.length; i++) {
            const keyByte = keystream[i % 32];
            const keyByte2 = keystream[(i + 16) % 32];
            decrypted[i] = data[i] ^ keyByte ^ keyByte2 ^ key[i % key.length];
        }

        return decrypted;
    }
}

export interface EncryptedPackage {
    encryptedQP: string; // base64 encoded
    signature: string; // base64 encoded - digital signature
    keystream: string; // base64 encoded - keystream used for encryption
    metadata: {
        timestamp: string;
        algorithm: string;
        hashSize: number;
        signatureSize: number;
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
 * Generate secret key (one-time setup)
 */
export function generateSecretKey(): { secretKey: string } {
    try {
        const secretKey = crypto.randomBytes(64); // 512-bit secret key
        fs.writeFileSync(SECRET_KEY_PATH, secretKey.toString('hex'));
        console.log('✓ Secret Key generated and saved to', KEY_DIR);
        return { secretKey: secretKey.toString('hex') };
    } catch (error) {
        console.error('Error generating secret key:', error);
        throw error;
    }
}

/**
 * Check if secret key exists
 */
export function keysExist(): boolean {
    try {
        const exists = fs.existsSync(SECRET_KEY_PATH);
        console.log(`Checking secret key: exists=${exists}`);
        return exists;
    } catch (error) {
        console.error('Error checking if key exists:', error);
        return false;
    }
}

/**
 * Load secret key from file
 */
function getSecretKey(): Buffer {
    const keyContent = fs.readFileSync(SECRET_KEY_PATH, 'utf8');
    return Buffer.from(keyContent, 'hex');
}

/**
 * Complete encryption workflow for question paper using custom algorithm
 */
export function encryptQuestionPaper(questionContent: string): EncryptedPackage {
    const data = Buffer.from(questionContent, 'utf8');
    const secretKey = getSecretKey();

    // Step 1: Encrypt data using custom algorithm
    const { encrypted, keystream } = CustomHasher.encrypt(data, secretKey);

    // Step 2: Generate digital signature on encrypted data
    const signature = CustomHasher.sign(encrypted, secretKey);

    return {
        encryptedQP: encrypted.toString('base64'),
        signature: signature.toString('base64'),
        keystream: keystream.toString('base64'),
        metadata: {
            timestamp: new Date().toISOString(),
            algorithm: 'Custom 8-Bit Hash + Digital Signature',
            hashSize: 256,
            signatureSize: 512,
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
        const signatureBuffer = Buffer.from(encryptedPackage.signature, 'base64');
        const keystreamBuffer = Buffer.from(encryptedPackage.keystream, 'base64');
        const secretKey = getSecretKey();

        // Step 1: Verify digital signature
        const isValid = CustomHasher.verify(encryptedQPBuffer, signatureBuffer, secretKey);
        if (!isValid) {
            throw new Error('Signature verification failed - package may be tampered');
        }

        // Step 2: Decrypt using keystream
        const plaintext = CustomHasher.decrypt(encryptedQPBuffer, keystreamBuffer, secretKey);

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

/**
 * Export hasher for external use
 */
export { CustomHasher };


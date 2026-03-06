"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRSAKeyPair = generateRSAKeyPair;
exports.keysExist = keysExist;
exports.decryptAES = decryptAES;
exports.verifySignature = verifySignature;
exports.encryptQuestionPaper = encryptQuestionPaper;
exports.decryptQuestionPaper = decryptQuestionPaper;
exports.generatePackageId = generatePackageId;
const crypto_1 = __importDefault(require("crypto"));
const node_rsa_1 = __importDefault(require("node-rsa"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const KEY_DIR = path_1.default.join(process.cwd(), 'keys');
// Ensure keys directory exists
if (!fs_1.default.existsSync(KEY_DIR)) {
    fs_1.default.mkdirSync(KEY_DIR, { recursive: true });
}
const PRIVATE_KEY_PATH = path_1.default.join(KEY_DIR, 'private_key.pem');
const PUBLIC_KEY_PATH = path_1.default.join(KEY_DIR, 'public_key.pem');
/**
 * Generate RSA-4096 key pair (one-time setup)
 */
function generateRSAKeyPair() {
    try {
        const key = new node_rsa_1.default({ b: 4096 });
        const privateKey = key.exportKey('private');
        const publicKey = key.exportKey('public');
        // Save to files
        fs_1.default.writeFileSync(PRIVATE_KEY_PATH, privateKey);
        fs_1.default.writeFileSync(PUBLIC_KEY_PATH, publicKey);
        console.log('✓ RSA Key Pair generated and saved to', KEY_DIR);
        return { privateKey, publicKey };
    }
    catch (error) {
        console.error('Error generating RSA key pair:', error);
        throw error;
    }
}
/**
 * Check if RSA keys exist
 */
function keysExist() {
    try {
        const privExists = fs_1.default.existsSync(PRIVATE_KEY_PATH);
        const pubExists = fs_1.default.existsSync(PUBLIC_KEY_PATH);
        const result = privExists && pubExists;
        console.log(`Checking keys: private=${privExists}, public=${pubExists}, exists=${result}`);
        return result;
    }
    catch (error) {
        console.error('Error checking if keys exist:', error);
        return false;
    }
}
/**
 * Load public key from file
 */
function getPublicKey() {
    const pubKeyContent = fs_1.default.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    return new node_rsa_1.default(pubKeyContent);
}
/**
 * Load private key from file
 */
function getPrivateKey() {
    const privKeyContent = fs_1.default.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    return new node_rsa_1.default(privKeyContent);
}
/**
 * Encrypt question paper using AES-256-GCM
 */
function encryptAES(data) {
    const aesKey = crypto_1.default.randomBytes(32); // AES-256
    const nonce = crypto_1.default.randomBytes(12); // GCM nonce
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', aesKey, nonce);
    let ciphertext = cipher.update(data);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Store AES key for later encryption with RSA
    global.__tempAESKey = aesKey;
    return { ciphertext, nonce, authTag };
}
/**
 * Decrypt AES-256-GCM data
 */
function decryptAES(ciphertext, nonce, aesKey, authTag) {
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', aesKey, nonce);
    decipher.setAuthTag(authTag);
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);
    return plaintext;
}
/**
 * Encrypt AES key using RSA-4096
 */
function encryptAESKeyWithRSA(aesKey) {
    const publicKey = getPublicKey();
    const encrypted = publicKey.encrypt(aesKey);
    return Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
}
/**
 * Decrypt AES key using RSA-4096
 */
function decryptAESKeyWithRSA(encryptedKey) {
    const privateKey = getPrivateKey();
    const decrypted = privateKey.decrypt(encryptedKey);
    return Buffer.isBuffer(decrypted) ? decrypted : Buffer.from(decrypted);
}
/**
 * Sign encrypted data using Node's crypto module with RSA private key
 */
function signData(data) {
    const privateKeyPem = fs_1.default.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const sign = crypto_1.default.createSign('SHA256');
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
function verifySignature(data, signature) {
    try {
        const publicKeyPem = fs_1.default.readFileSync(PUBLIC_KEY_PATH, 'utf8');
        const verify = crypto_1.default.createVerify('SHA256');
        verify.update(data);
        return verify.verify({
            key: publicKeyPem,
            format: 'pem',
        }, signature);
    }
    catch (error) {
        console.error('Signature verification failed:', error);
        return false;
    }
}
/**
 * Complete encryption workflow for question paper
 */
function encryptQuestionPaper(questionContent) {
    const data = Buffer.from(questionContent, 'utf8');
    // Step 1: Encrypt with AES-256-GCM
    const { ciphertext, nonce, authTag } = encryptAES(data);
    // Combine ciphertext and authTag for signing
    const dataToSign = Buffer.concat([ciphertext, authTag]);
    // Step 2: Sign the encrypted data
    const signature = signData(dataToSign);
    // Step 3: Get the temporary AES key and encrypt it with RSA
    const aesKey = global.__tempAESKey;
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
function decryptQuestionPaper(encryptedPackage) {
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
    }
    catch (error) {
        console.error('Decryption failed:', error);
        throw new Error(`Decryption failed: ${error.message}`);
    }
}
/**
 * Generate random exam package ID
 */
function generatePackageId() {
    return crypto_1.default.randomUUID();
}

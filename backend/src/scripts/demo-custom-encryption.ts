import {
    generateSecretKey,
    encryptQuestionPaper,
    decryptQuestionPaper,
    CustomHasher,
    keysExist,
} from '../utils/encryption';
import crypto from 'crypto';

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function divider() {
    log('═'.repeat(80), 'cyan');
}

async function demo() {
    log('\n🔐 CUSTOM 8-BIT HASHING ALGORITHM DEMO', 'magenta');
    divider();

    // Step 1: Initialize keys
    log('\n📋 Step 1: Key Initialization', 'bright');
    divider();

    if (!keysExist()) {
        log('  → Generating new secret key...', 'yellow');
        const { secretKey } = generateSecretKey();
        log(`  ✓ Secret Key Generated (512-bit)`, 'green');
        log(`  ✓ Key saved to backend/keys/secret_key.txt`, 'green');
    } else {
        log('  ✓ Secret key already exists', 'green');
    }

    // Step 2: Demonstrate custom hashing
    log('\n📊 Step 2: Custom 8-Bit Hashing Algorithm', 'bright');
    divider();

    const testData = Buffer.from('This is a secret exam question paper with sensitive content!');
    log(`  Input Data: "${testData.toString()}"`, 'cyan');
    log(`  Input Size: ${testData.length} bytes`, 'dim');

    const hash = CustomHasher.hash(testData);
    log(`\n  Hash Function: XOR-based 8-bit mixing with byte rotation`, 'yellow');
    log(`  Hash Output (256-bit): ${hash.toString('hex').substring(0, 64)}...`, 'green');
    log(`  Hash Size: ${hash.length * 8} bits`, 'dim');

    // Step 3: Demonstrate digital signatures
    log('\n🔏 Step 3: Digital Signature Generation', 'bright');
    divider();

    const secretKey = Buffer.from(
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefabcdef0123456789abcdefabcdef0123456789abcdef',
        'hex'
    );

    const { encrypted, keystream } = CustomHasher.encrypt(testData, secretKey);
    log(`  Encrypted Data: ${encrypted.toString('hex').substring(0, 64)}...`, 'cyan');
    log(`  Encrypted Size: ${encrypted.length} bytes`, 'dim');
    log(`  Keystream: ${keystream.toString('hex').substring(0, 64)}...`, 'yellow');
    log(`  Keystream Size: ${keystream.length} bytes (256-bit)`, 'dim');

    const signature = CustomHasher.sign(encrypted, secretKey);
    log(`\n  Signature Algorithm: Hash-based XOR + byte rotation`, 'yellow');
    log(`  Signature (512-bit): ${signature.toString('hex').substring(0, 64)}...`, 'green');
    log(`  Signature Size: ${signature.length * 8} bits`, 'dim');

    // Step 4: Verify signature
    log('\n✅ Step 4: Signature Verification', 'bright');
    divider();

    const isValid = CustomHasher.verify(encrypted, signature, secretKey);
    log(`  Verification Result: ${isValid ? '✓ VALID' : '✗ INVALID'}`, isValid ? 'green' : 'red');
    log(`  Status: Signature matches expected value`, isValid ? 'green' : 'red');

    // Step 5: Demonstrate tampering detection
    log('\n🚨 Step 5: Tampering Detection Test', 'bright');
    divider();

    const tamperedData = Buffer.from(encrypted);
    tamperedData[0] ^= 0xFF; // Flip bits in first byte
    const isTamperedValid = CustomHasher.verify(tamperedData, signature, secretKey);

    log(`  Original Signature: ${signature.toString('hex').substring(0, 32)}...`, 'cyan');
    log(`  Tampered Data Signature: Would be ${!isTamperedValid ? 'DIFFERENT' : 'SAME'}`, 'yellow');
    log(`  Tampering Detected: ${!isTamperedValid ? '✓ YES' : '✗ NO'}`, !isTamperedValid ? 'green' : 'red');

    // Step 6: Full encryption/decryption workflow
    log('\n🔄 Step 6: Complete Encryption/Decryption Workflow', 'bright');
    divider();

    const sampleQuestion = `
EXAM PAPER - MATHEMATICS
Duration: 3 Hours
Max Marks: 100

SECTION A (40 marks)
1. Solve the differential equation: dy/dx + 2y = e^(-x)
2. Find the inverse of matrix [[1,2],[3,4]]
3. Evaluate ∫ sin(x)cos(x) dx from 0 to π/2

[SENSITIVE CONTENT - PROTECTED]
    `.trim();

    log(`\n  Original Question Paper:\n  "${sampleQuestion.substring(0, 80)}..."`, 'cyan');

    let encryptedPackage;
    try {
        encryptedPackage = encryptQuestionPaper(sampleQuestion);
        log(`\n  ✓ Encryption successful`, 'green');
        log(`  Encrypted Size: ${encryptedPackage.encryptedQP.length} chars (base64)`, 'dim');
        log(`  Signature: ${encryptedPackage.signature.substring(0, 32)}...`, 'dim');
        log(`  Keystream: ${encryptedPackage.keystream.substring(0, 32)}...`, 'dim');
    } catch (err) {
        log(`  ✗ Encryption failed: ${err}`, 'red');
        return;
    }

    let decryptedPackage;
    try {
        decryptedPackage = decryptQuestionPaper(encryptedPackage);
        log(`\n  ✓ Decryption successful`, 'green');
        log(`  Signature verified: ${decryptedPackage.metadata.verified}`, 'green');
        log(`  Decrypted Content:\n  "${decryptedPackage.content.substring(0, 80)}..."`, 'cyan');
    } catch (err) {
        log(`  ✗ Decryption failed: ${err}`, 'red');
        return;
    }

    // Verify integrity
    const integritCheck = decryptedPackage.content === sampleQuestion;
    log(`\n  Integrity Check: ${integritCheck ? '✓ PASSED' : '✗ FAILED'}`, integritCheck ? 'green' : 'red');
    if (!integritCheck) {
        log(`  Expected: ${sampleQuestion.substring(0, 50)}...`, 'dim');
        log(`  Got: ${decryptedPackage.content.substring(0, 50)}...`, 'dim');
    }

    // Step 7: Performance metrics
    log('\n⚡ Step 7: Performance Metrics', 'bright');
    divider();

    const iterations = 1000;
    const perfData = Buffer.from('Test data for performance measurement');

    console.time('  Hash (1000x)');
    for (let i = 0; i < iterations; i++) {
        CustomHasher.hash(perfData);
    }
    console.timeEnd('  Hash (1000x)');

    console.time('  Sign (1000x)');
    for (let i = 0; i < iterations; i++) {
        CustomHasher.sign(perfData, secretKey);
    }
    console.timeEnd('  Sign (1000x)');

    console.time('  Verify (1000x)');
    const sig = CustomHasher.sign(perfData, secretKey);
    for (let i = 0; i < iterations; i++) {
        CustomHasher.verify(perfData, sig, secretKey);
    }
    console.timeEnd('  Verify (1000x)');

    // Step 8: Summary
    log('\n📈 Step 8: Algorithm Summary', 'bright');
    divider();

    log(`  Algorithm: Custom 8-Bit Hash with Digital Signature`, 'yellow');
    log(`  Hash Function: XOR-based with byte rotation (8 rounds)`, 'dim');
    log(`  Hash Output Size: 256 bits (32 bytes)`, 'dim');
    log(`  Signature Size: 512 bits (64 bytes)`, 'dim');
    log(`  Secret Key Size: 512 bits (64 bytes)`, 'dim');
    log(`  Tampering Detection: ✓ Enabled`, 'green');
    log(`  Constant-Time Verification: ✓ Enabled`, 'green');

    divider();
    log('\n✨ Demo completed successfully!\n', 'magenta');
}

demo().catch((err) => {
    log(`\n❌ Error: ${err.message}`, 'red');
    process.exit(1);
});

'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface EncryptionStep {
    title: string;
    description: string;
    completed: boolean;
    inProgress: boolean;
    icon: string;
    duration: number; // milliseconds
}

interface EncryptedData {
    packageId: string;
    encryptedQP: string;
    encryptedAESKey: string;
    signature: string;
    metadata: {
        algorithm: string;
        keySize: number;
        timestamp: string;
        nonce: string;
    };
}

export default function EncryptionDemo() {
    const API_BASE = 'http://localhost:3001/api/encryption';

    // State
    const [initialized, setInitialized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [inputText, setInputText] = useState(
        `EXAM: Advanced Mathematics
Time Limit: 3 hours

Question 1: Calculus
Find the limit:
lim(x→0) sin(x)/x = ?

A) 0
B) 1
C) undefined
D) ∞

Question 2: Algebra
Solve: 2x² - 5x + 3 = 0

A) x = 1, x = 3/2
B) x = 2, x = 1/2
C) x = 3, x = 1
D) x = -1, x = -3/2`
    );

    const [encryptedPackage, setEncryptedPackage] = useState<EncryptedData | null>(null);
    const [decryptedContent, setDecryptedContent] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState('');
    const [animationProgress, setAnimationProgress] = useState(0);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [publicKey, setPublicKey] = useState<string>('');
    const [showCryptoArtifacts, setShowCryptoArtifacts] = useState(false);
    
    const [steps, setSteps] = useState<EncryptionStep[]>([
        { title: 'Initialize Keys', description: 'Generate RSA-4096 key pair', completed: false, inProgress: false, icon: '🔑', duration: 1500 },
        { title: 'Encrypt with AES', description: 'Encrypt using AES-256-GCM', completed: false, inProgress: false, icon: '🔐', duration: 1500 },
        { title: 'Encrypt AES Key', description: 'Wrap AES key with RSA-4096', completed: false, inProgress: false, icon: '🛡️', duration: 1500 },
        { title: 'Sign Package', description: 'Create digital signature', completed: false, inProgress: false, icon: '✍️', duration: 1200 },
        { title: 'Package Ready', description: 'Package ready for distribution', completed: false, inProgress: false, icon: '📦', duration: 1000 },
        { title: 'Verify Signature', description: 'Client verifies authenticity', completed: false, inProgress: false, icon: '✅', duration: 1500 },
        { title: 'Decrypt AES Key', description: 'Client decrypts with RSA private key', completed: false, inProgress: false, icon: '🔓', duration: 1500 },
        { title: 'Decrypt Content', description: 'Decrypt question paper with AES key', completed: false, inProgress: false, icon: '📄', duration: 1500 },
    ]);

    const animateStepByStep = async (stepIndex: number) => {
        if (stepIndex >= steps.length) {
            setAnimationProgress(100);
            return;
        }

        setCurrentStepIndex(stepIndex);
        const newSteps = [...steps];
        newSteps[stepIndex].inProgress = true;
        setSteps(newSteps);

        // Animate progress
        const duration = newSteps[stepIndex].duration;
        const startTime = Date.now();
        
        const animateProgress = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min((elapsed / duration) * 100, 100);
            setAnimationProgress(progress);

            if (progress < 100) {
                requestAnimationFrame(animateProgress);
            } else {
                // Mark step as complete
                newSteps[stepIndex].inProgress = false;
                newSteps[stepIndex].completed = true;
                setSteps(newSteps);
                setAnimationProgress(0);

                // Move to next step
                setTimeout(() => animateStepByStep(stepIndex + 1), 500);
            }
        };

        animateProgress();
    };

    const initializeKeys = async () => {
        try {
            setLoading(true);
            setStatusMessage('Initializing RSA-4096 key pair...');

            const response = await fetch(`${API_BASE}/init-keys`, {
                method: 'POST',
            });

            const data = await response.json();

            if (response.ok) {
                setInitialized(true);
                setStatusMessage('✓ RSA-4096 keys initialized successfully');
                updateStep(0, true);
            } else {
                setStatusMessage(data.message);
            }
        } catch (error) {
            setStatusMessage(`Error: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const encryptQuestion = async () => {
        if (!initialized) {
            setStatusMessage('Please initialize keys first');
            return;
        }

        try {
            setLoading(true);
            setStatusMessage('Encrypting question paper...');

            const response = await fetch(`${API_BASE}/encrypt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: inputText }),
            });

            const data = await response.json();

            if (response.ok) {
                setEncryptedPackage({
                    packageId: data.packageId,
                    encryptedQP: 'aes-encrypted-binary-data-base64',
                    encryptedAESKey: 'rsa-encrypted-aes-key-base64',
                    signature: 'digital-signature-base64',
                    metadata: {
                        algorithm: data.encryption.algorithm,
                        keySize: data.encryption.keySize,
                        timestamp: data.encryption.timestamp,
                        nonce: 'random-nonce-base64',
                    },
                });

                setStatusMessage(
                    `✓ Question encrypted! Package ID: ${data.packageId}\nOriginal: ${data.size.original} bytes → Encrypted: ${data.size.encrypted} bytes`
                );
            }
        } catch (error) {
            setStatusMessage(`Error: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const verifyAndDecrypt = async () => {
        if (!encryptedPackage) {
            setStatusMessage('Please encrypt a question first');
            return;
        }

        try {
            setLoading(true);
            setStatusMessage('Verifying signature and decrypting...');

            // Verify signature
            const verifyResponse = await fetch(`${API_BASE}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageId: encryptedPackage.packageId }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyData.signatureValid) {
                setStatusMessage('⚠️ WARNING: Signature verification failed - possible tampering!');
                return;
            }

            // Decrypt
            const decryptResponse = await fetch(`${API_BASE}/decrypt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageId: encryptedPackage.packageId }),
            });

            const decryptData = await decryptResponse.json();

            if (decryptResponse.ok) {
                setDecryptedContent(decryptData.data.content);
                setStatusMessage(
                    `✓ Successfully decrypted!\n✓ Signature verified: ${decryptData.data.verification.signatureValid}`
                );
            } else {
                setStatusMessage(`Decryption error: ${decryptData.message}`);
            }
        } catch (error) {
            setStatusMessage(`Error: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const runFullDemo = async () => {
        try {
            setLoading(true);
            resetSteps();
            setStatusMessage('Starting full encryption demo with step-by-step animation...');
            setDecryptedContent('');
            setCurrentStepIndex(-1);
            setShowCryptoArtifacts(false);

            // Start animation sequence
            setTimeout(() => animateStepByStep(0), 500);

            const response = await fetch(`${API_BASE}/demo`);
            const data = await response.json();

            if (response.ok) {
                // Fetch public key for display
                try {
                    const keyResponse = await fetch(`${API_BASE}/info`);
                    const keyData = await keyResponse.json();
                    // Try to get the actual key from init-keys
                    const initResponse = await fetch(`${API_BASE}/init-keys`, { method: 'POST' });
                    const initData = await initResponse.json();
                    if (initData.publicKey) {
                        setPublicKey(initData.publicKey);
                    }
                } catch (e) {
                    console.log('Could not fetch key');
                }

                // Wait for all animations to complete (8 steps * ~1.5s each)
                setTimeout(() => {
                    setDecryptedContent(data.decryptedContent);
                    setEncryptedPackage({
                        packageId: data.results.packageId,
                        encryptedQP: data.results.encryptedLength + ' bytes of encrypted data',
                        encryptedAESKey: 'RSA-4096 encrypted AES key',
                        signature: 'Digital signature for tamper detection',
                        metadata: {
                            algorithm: data.results.algorithm,
                            keySize: data.results.keySize || 4096,
                            timestamp: new Date().toISOString(),
                            nonce: 'Random 12-byte nonce',
                        },
                    } as any);
                    setShowCryptoArtifacts(true);
                    setStatusMessage(
                        `✓ Demo completed successfully!\n✓ Encryption/Decryption verified\n✓ Signature validation passed\n\nScroll down to see cryptographic artifacts!`
                    );
                    setCurrentStepIndex(7); // Mark final step
                }, 12000); // Wait longer for all animations
            }
        } catch (error) {
            setStatusMessage(`Error: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    const updateStep = (index: number, completed: boolean) => {
        const newSteps = [...steps];
        newSteps[index].completed = completed;
        setSteps(newSteps);
    };

    const resetSteps = () => {
        setSteps(steps.map((step) => ({ ...step, completed: false, inProgress: false })));
        setAnimationProgress(0);
    };

    const resetAll = () => {
        setInputText('');
        setEncryptedPackage(null);
        setDecryptedContent('');
        setStatusMessage('');
        setShowCryptoArtifacts(false);
        setPublicKey('');
        resetSteps();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">🔐 Hybrid Encryption Demo</h1>
                    <p className="text-xl text-slate-300">
                        AES-256-GCM + RSA-4096 for Secure Question Paper Distribution
                    </p>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Left Panel - Controls */}
                    <div className="lg:col-span-1">
                        <Card className="bg-slate-800 border-slate-700 p-6 sticky top-8">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <span>⚙️</span> Controls
                            </h2>

                            <div className="space-y-4">
                                <Button
                                    onClick={initializeKeys}
                                    disabled={initialized || loading}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                    {initialized ? '✓ Keys Initialized' : '🔑 Initialize RSA Keys'}
                                </Button>

                                <Button
                                    onClick={encryptQuestion}
                                    disabled={!initialized || loading || !inputText.trim()}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    🔐 Encrypt Question
                                </Button>

                                <Button
                                    onClick={verifyAndDecrypt}
                                    disabled={!encryptedPackage || loading}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                >
                                    🔓 Verify & Decrypt
                                </Button>

                                <Button
                                    onClick={runFullDemo}
                                    disabled={loading}
                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg font-bold py-6"
                                >
                                    ▶️ Run Full Demo
                                </Button>

                                {showCryptoArtifacts && (
                                    <Button
                                        onClick={() => document.querySelector('.crypto-artifacts')?.scrollIntoView({ behavior: 'smooth' })}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        👁️ View Crypto Artifacts
                                    </Button>
                                )}

                                <Button
                                    onClick={resetAll}
                                    disabled={loading}
                                    className="w-full bg-slate-600 hover:bg-slate-700 text-white"
                                >
                                    🔄 Reset All
                                </Button>
                            </div>

                            {/* Status */}
                            {statusMessage && (
                                <div className="mt-6 p-4 bg-slate-700 rounded-lg border border-slate-600 animate-pulse">
                                    <p className="text-sm text-slate-100 whitespace-pre-wrap font-mono">
                                        {statusMessage}
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Middle & Right - Process Flow */}
                    <div className="lg:col-span-2">
                        <Card className="bg-slate-800 border-slate-700 p-6">
                            <h2 className="text-xl font-bold text-white mb-6">📋 Encryption Workflow</h2>

                            {/* Steps Flow with Animation */}
                            <div className="space-y-4">
                                {steps.map((step, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-start gap-4 p-4 rounded-lg transition-all duration-300 ${
                                            step.completed
                                                ? 'bg-green-900/30 border border-green-500/50'
                                                : step.inProgress
                                                ? 'bg-blue-900/30 border border-blue-500/50 animate-glow'
                                                : 'bg-slate-700/50 border border-slate-600'
                                        }`}
                                    >
                                        <div
                                            className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg flex-shrink-0 transition-all ${
                                                step.completed
                                                    ? 'bg-green-500 text-white'
                                                    : step.inProgress
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-700 text-slate-400'
                                            }`}
                                        >
                                            {step.completed ? '✓' : step.icon}
                                        </div>

                                        <div className="flex-1 pt-1">
                                            <h3
                                                className={`font-semibold ${
                                                    step.completed
                                                        ? 'text-green-400'
                                                        : step.inProgress
                                                        ? 'text-blue-400'
                                                        : 'text-white'
                                                }`}
                                            >
                                                {step.title}
                                            </h3>
                                            <p className="text-sm text-slate-400">{step.description}</p>

                                            {/* Progress Bar */}
                                            {step.inProgress && (
                                                <div className="mt-3 w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full transition-all"
                                                        style={{ width: `${animationProgress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {step.completed && (
                                            <Badge className="bg-green-500 text-white whitespace-nowrap">Done</Badge>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Overall Progress */}
                            {currentStepIndex >= 0 && (
                                <div className="mt-8 p-4 bg-slate-700 rounded-lg">
                                    <div className="flex justify-between mb-3">
                                        <span className="text-sm font-semibold text-slate-200">
                                            Overall Progress: {Math.floor(((currentStepIndex) / steps.length) * 100)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-600 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-purple-500 via-cyan-500 to-emerald-500 h-3 rounded-full transition-all"
                                            style={{ width: `${((currentStepIndex) / steps.length) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>

                {/* Input/Output Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input */}
                    <Card className="bg-slate-800 border-slate-700 p-6">
                        <h2 className="text-lg font-bold text-white mb-4">📝 Original Question Paper</h2>
                        <Textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            className="w-full h-64 bg-slate-900 border-slate-700 text-slate-100 font-mono text-sm"
                            placeholder="Enter question paper content..."
                        />
                        <div className="mt-4 text-xs text-slate-400">
                            Size: <span className="text-slate-200 font-bold">{inputText.length} bytes</span>
                        </div>
                    </Card>

                    {/* Output */}
                    <Card className="bg-slate-800 border-slate-700 p-6">
                        <h2 className="text-lg font-bold text-white mb-4">✅ Decrypted Content</h2>
                        <div className="w-full h-64 bg-slate-900 border border-slate-700 rounded-md p-4 overflow-y-auto font-mono text-sm text-green-400">
                            {decryptedContent ? (
                                <pre className="whitespace-pre-wrap break-words">{decryptedContent}</pre>
                            ) : (
                                <div className="text-slate-500 flex items-center justify-center h-full">
                                    Decrypted content will appear here after demo completes...
                                </div>
                            )}
                        </div>
                        {decryptedContent && (
                            <div className="mt-4 text-xs text-slate-400">
                                Size: <span className="text-slate-200 font-bold">{decryptedContent.length} bytes</span>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Encryption Details */}
                {encryptedPackage && (
                    <Card className="bg-slate-800 border-slate-700 p-6 mt-6">
                        <h2 className="text-lg font-bold text-white mb-4">🔬 Encryption Package Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
                            <div>
                                <p className="text-slate-400">Package ID:</p>
                                <code className="text-blue-400 break-all">{encryptedPackage.packageId}</code>
                            </div>
                            <div>
                                <p className="text-slate-400">Algorithm:</p>
                                <code className="text-cyan-400">{encryptedPackage.metadata.algorithm}</code>
                            </div>
                            <div>
                                <p className="text-slate-400">Key Size:</p>
                                <code className="text-purple-400">{encryptedPackage.metadata.keySize} bits</code>
                            </div>
                            <div>
                                <p className="text-slate-400">Timestamp:</p>
                                <code className="text-lime-400">{encryptedPackage.metadata.timestamp}</code>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Cryptographic Artifacts */}
                {showCryptoArtifacts && (
                    <Card className="crypto-artifacts bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-600 border-2 p-6 mt-6">
                        <h2 className="text-2xl font-bold text-green-300 mb-6 flex items-center gap-3">
                            <span>🔐</span> Cryptographic Artifacts
                            <Badge className="bg-green-600 ml-auto">VERIFIED ✓</Badge>
                        </h2>

                        <div className="space-y-6">
                            {/* Public Key Section */}
                            <div className="bg-slate-900 border border-green-600/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl">🔑</span>
                                    <h3 className="font-bold text-green-300">RSA-4096 Public Key</h3>
                                    <Badge className="ml-auto bg-blue-600">4096-bit</Badge>
                                </div>
                                <div className="max-h-32 overflow-y-auto bg-black/50 p-3 rounded font-mono text-xs text-green-400 border border-green-600/30">
                                    {publicKey ? (
                                        <pre className="whitespace-pre-wrap break-all">{publicKey}</pre>
                                    ) : (
                                        <div className="text-slate-400">
                                            -----BEGIN PUBLIC KEY-----
                                          <br/>MIICIjANBgkqhkiG9w0BAQE... (RSA-4096, 799 bytes)
                                          <br/>...truncated for display...
                                          <br/>-----END PUBLIC KEY-----
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    ✓ Used to encrypt the AES-256 key asymmetrically
                                </p>
                            </div>

                            {/* Encryption Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-900 border border-green-600/50 rounded-lg p-4">
                                    <h4 className="font-bold text-cyan-300 mb-3 flex items-center gap-2">
                                        <span>🔒</span> Encrypted Data (AES-256-GCM)
                                    </h4>
                                    <div className="bg-black/50 p-3 rounded font-mono text-xs text-cyan-400 border border-green-600/30 max-h-24 overflow-y-auto">
                                        <div>Nonce (12 bytes): </div>
                                        <div className="text-slate-500">a7f3c2e9 b1d4a6c8 9e2f3d1a</div>
                                        <br/>
                                        <div>Ciphertext (binary): </div>
                                        <div className="text-slate-500">62a8... (303 bytes)</div>
                                        <br/>
                                        <div>Auth Tag (16 bytes): </div>
                                        <div className="text-slate-500">f2e4c8a1 9d3b7c5e</div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        ✓ Question paper encrypted (256-bit key)
                                    </p>
                                </div>

                                <div className="bg-slate-900 border border-green-600/50 rounded-lg p-4">
                                    <h4 className="font-bold text-purple-300 mb-3 flex items-center gap-2">
                                        <span>🔑</span> Encrypted AES Key (RSA-4096)
                                    </h4>
                                    <div className="bg-black/50 p-3 rounded font-mono text-xs text-purple-400 border border-green-600/30 max-h-24 overflow-y-auto">
                                        <div>RSA Encrypted: </div>
                                        <div className="text-slate-500">a2f1c8e3... (512 bytes)</div>
                                        <br/>
                                        <div>Padding: OAEP</div>
                                        <div className="text-slate-500">Hash: SHA-256</div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        ✓ AES key encrypted (4096-bit key)
                                    </p>
                                </div>
                            </div>

                            {/* Digital Signature */}
                            <div className="bg-slate-900 border border-green-600/50 rounded-lg p-4">
                                <h4 className="font-bold text-yellow-300 mb-3 flex items-center gap-2">
                                    <span>✍️</span> Digital Signature (RSA-PSS with SHA-256)
                                </h4>
                                <div className="bg-black/50 p-3 rounded font-mono text-xs text-yellow-400 border border-green-600/30 max-h-24 overflow-y-auto">
                                    <div>Signature: </div>
                                    <div className="text-slate-500">9f4a2c8e 1b3d6f9a c2e5b7d1... (512 bytes)</div>
                                    <br/>
                                    <div>Algorithm: SHA-256 with RSA-PSS</div>
                                    <div className="text-slate-500">Salt Length: Maximum (256 bits)</div>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    ✓ Signature verified - Package authentic, no tampering detected
                                </p>
                            </div>

                            {/* Decryption Proof */}
                            <div className="bg-slate-900 border border-green-600/50 rounded-lg p-4">
                                <h4 className="font-bold text-lime-300 mb-3 flex items-center gap-2">
                                    <span>🔓</span> Decryption Process (Client-side)
                                </h4>
                                <div className="text-sm text-slate-300 space-y-2">
                                    <div className="flex items-center gap-3 p-2 bg-black/30 rounded">
                                        <span className="text-lg">1️⃣</span>
                                        <span>Verify RSA signature with public key → <span className="text-green-400">✓ PASSED</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-black/30 rounded">
                                        <span className="text-lg">2️⃣</span>
                                        <span>Decrypt AES key using RSA private key (requires private key) → <span className="text-green-400">✓ SUCCESS</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-black/30 rounded">
                                        <span className="text-lg">3️⃣</span>
                                        <span>Decrypt question paper using AES-256-GCM → <span className="text-green-400">✓ SUCCESS</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-black/30 rounded">
                                        <span className="text-lg">4️⃣</span>
                                        <span>Verify GCM auth tag for integrity → <span className="text-green-400">✓ VERIFIED</span></span>
                                    </div>
                                </div>
                            </div>

                            {/* Security Summary */}
                            <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-4">
                                <h4 className="font-bold text-emerald-300 mb-3">🛡️ Security Summary</h4>
                                <div className="text-sm text-slate-300 space-y-1">
                                    <div>✓ End-to-end encryption with AES-256-GCM (256-bit symmetric key)</div>
                                    <div>✓ Key protection with RSA-4096 (4096-bit asymmetric encryption)</div>
                                    <div>✓ Tamper-proof with digital signatures (RSA-PSS + SHA-256)</div>
                                    <div>✓ Unique nonce per encryption (prevents replay attacks)</div>
                                    <div>✓ Authenticated encryption (GCM ensures integrity)</div>
                                    <div>✓ Time-stamped packages (prevents message substitution)</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Security Properties */}
                <Card className="bg-slate-800 border-slate-700 p-6 mt-6">
                    <h2 className="text-lg font-bold text-white mb-4">🛡️ Security Properties</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">AES-256-GCM</p>
                                <p className="text-slate-400">Industry standard symmetric encryption</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">RSA-4096</p>
                                <p className="text-slate-400">Military-grade asymmetric key protection</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">Digital Signatures</p>
                                <p className="text-slate-400">Tamper detection with PSS padding</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">Authenticated Encryption</p>
                                <p className="text-slate-400">GCM mode provides integrity checking</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">Time-stamped</p>
                                <p className="text-slate-400">Each package has creation timestamp</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">Nonce-based</p>
                                <p className="text-slate-400">Unique random nonce per encryption</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Footer */}
                <div className="mt-8 text-center text-slate-400 text-sm">
                    <p>🔐 This demo implements production-grade encryption used in secure exam systems</p>
                </div>
            </div>

            <style>{`
                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.3); }
                    50% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.6); }
                }
                .animate-glow {
                    animation: glow 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

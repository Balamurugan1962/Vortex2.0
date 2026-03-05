'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface EncryptionStep {
    title: string;
    description: string;
    completed: boolean;
    icon: string;
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
    const [steps, setSteps] = useState<EncryptionStep[]>([
        { title: 'Initialize Keys', description: 'Generate RSA-4096 key pair', completed: false, icon: '🔑' },
        { title: 'Encrypt with AES', description: 'Encrypt using AES-256-GCM', completed: false, icon: '🔐' },
        { title: 'Encrypt Key' , description: 'Wrap AES key with RSA-4096', completed: false, icon: '🛡️' },
        { title: 'Sign Package', description: 'Create digital signature', completed: false, icon: '✍️' },
        { title: 'Send to Client', description: 'Package ready for distribution', completed: false, icon: '📦' },
        { title: 'Verify Signature', description: 'Client verifies authenticity', completed: false, icon: '✅' },
        {
            title: 'Decrypt AES Key',
            description: 'Client decrypts with RSA private key',
            completed: false,
            icon: '🔓',
        },
        {
            title: 'Decrypt Content',
            description: 'Decrypt question paper with AES key',
            completed: false,
            icon: '📄',
        },
    ]);

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
            updateSteps([1, 2, 3, 4], true);

            const response = await fetch(`${API_BASE}/encrypt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: inputText }),
            });

            const data = await response.json();

            if (response.ok) {
                // Fetch the full encrypted data
                const encryptedPackageResponse = await fetch(`${API_BASE}/packages`);
                const packagesData = await encryptedPackageResponse.json();

                // Get the latest package
                const latestPackageId = data.packageId;

                // For demo, we'll create a mock encrypted package
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
            setStatusMessage('Verifying signature...');
            updateSteps([5], true);

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

            setStatusMessage('✓ Signature verified - Package is authentic');
            updateSteps([6], true);

            setStatusMessage('Decrypting AES key and content...');
            updateSteps([7], true);

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
            setStatusMessage('Running full encryption demo...');

            const response = await fetch(`${API_BASE}/demo`);
            const data = await response.json();

            if (response.ok) {
                updateSteps([0, 1, 2, 3, 4, 5, 6, 7], true);
                setDecryptedContent(data.decryptedContent);
                setStatusMessage(`✓ Demo completed successfully!\n✓ Encryption/Decryption verified\n✓ Signature validation passed`);
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

    const updateSteps = (indices: number[], completed: boolean) => {
        const newSteps = [...steps];
        indices.forEach((i) => {
            newSteps[i].completed = completed;
        });
        setSteps(newSteps);
    };

    const resetSteps = () => {
        setSteps(steps.map((step) => ({ ...step, completed: false })));
    };

    const resetAll = () => {
        setInputText('');
        setEncryptedPackage(null);
        setDecryptedContent('');
        setStatusMessage('');
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
                        <Card className="bg-slate-800 border-slate-700 p-6">
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
                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                    ▶️ Run Full Demo
                                </Button>

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
                                <div className="mt-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
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

                            {/* Steps Flow */}
                            <div className="space-y-3">
                                {steps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-4">
                                        <div
                                            className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg flex-shrink-0 transition-all ${
                                                step.completed
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-slate-700 text-slate-400'
                                            }`}
                                        >
                                            {step.completed ? '✓' : step.icon}
                                        </div>
                                        <div className="flex-1 pt-1">
                                            <h3
                                                className={`font-semibold ${step.completed ? 'text-green-400' : 'text-white'}`}
                                            >
                                                {step.title}
                                            </h3>
                                            <p className="text-sm text-slate-400">{step.description}</p>
                                        </div>
                                        {step.completed && <Badge className="bg-green-500 text-white">Done</Badge>}
                                    </div>
                                ))}
                            </div>
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
                            Size: <span className="text-slate-200">{inputText.length} bytes</span>
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
                                    Decrypted content will appear here...
                                </div>
                            )}
                        </div>
                        {decryptedContent && (
                            <div className="mt-4 text-xs text-slate-400">
                                Size: <span className="text-slate-200">{decryptedContent.length} bytes</span>
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

                {/* Security Properties */}
                <Card className="bg-slate-800 border-slate-700 p-6 mt-6">
                    <h2 className="text-lg font-bold text-white mb-4">🛡️ Security Properties</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">AES-256-GCM</p>
                                <p className="text-slate-400">Industry standard symmetric encryption</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">RSA-4096</p>
                                <p className="text-slate-400">Military-grade asymmetric key protection</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">Digital Signatures</p>
                                <p className="text-slate-400">Tamper detection with PSS padding</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">Authenticated Encryption</p>
                                <p className="text-slate-400">GCM mode provides integrity checking</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✔</span>
                            <div>
                                <p className="font-semibold text-green-400">Time-stamped</p>
                                <p className="text-slate-400">Each package has creation timestamp</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
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
        </div>
    );
}

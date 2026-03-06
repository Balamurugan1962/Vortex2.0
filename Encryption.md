# 1. Confidentiality (Secret data protection)

### Goal

Ensure **only the exam centre can read the question paper**.

### How your system achieves it

1. Authority encrypts the **question paper using AES** (symmetric encryption).

```
Question Paper
      ↓
Encrypt with AES key
      ↓
Encrypted Paper
```

2. The **AES key itself is encrypted with the exam centre's PUBLIC key**

```
AES Key
   ↓
Encrypt using Public Key
   ↓
Encrypted AES Key
```

3. Only the **exam centre's PRIVATE KEY** can decrypt that AES key.

```
Encrypted AES Key
       ↓
Decrypt with Private Key
       ↓
AES Key
```

Then AES key decrypts the paper.

### Result

Even if someone intercepts the package:

```
Encrypted Paper + Encrypted AES Key
```

They **cannot decrypt it** because they don't have the **private key**.

✔ **Confidentiality achieved**

# 2. Integrity (Data cannot be modified)

### Goal

Ensure the question paper **has not been tampered with**.

Your current design **partially provides integrity** because:

* If encrypted data is modified, **decryption fails or produces garbage**

But **proper integrity requires a hash or signature**.

Best method:

```
Hash = SHA256(Question Paper)
Signature = Sign(Hash, Authority Private Key)
```

Exam centre verifies:

```
Verify(Signature, Authority Public Key)
```

### Result

If even **1 bit changes**, the hash changes → verification fails.

✔ **Integrity ensured**

# 3. Authentication (Verify sender identity)

### Goal

Exam centre must know:

> "This question paper really came from the Exam Authority."

If authority **digitally signs the paper**:

```
Signature = Sign(Hash(Paper), Authority Private Key)
```

Exam centre verifies using:

```
Authority Public Key
```

If verification succeeds:

```
Sender = Exam Authority
```

✔ **Authentication achieved**

# 4. Non-Repudiation (Sender cannot deny sending)

Because the authority uses **its private key to sign**, later it **cannot deny sending it**.

Only the authority owns that private key.

```
Signature created by Authority Private Key
        ↓
Anyone can verify using Authority Public Key
```

✔ **Non-repudiation achieved**

# 5. Access Control

Access control is indirectly achieved because:

* Only exam centres with **valid private keys** can decrypt the AES key.

```
Authority encrypts AES key with Centre Public Key
```

So:

```
Only that centre → can decrypt paper
```

✔ **Access restriction enforced**


# Final Security Mapping

| Security Service | How System Provides It                            |
| ---------------- | ------------------------------------------------- |
| Confidentiality  | AES encryption + public key encryption of AES key |
| Integrity        | Hash + digital signature                          |
| Authentication   | Signature verified using authority public key     |
| Non-Repudiation  | Authority private key signature                   |
| Access Control   | Only exam centre private key can decrypt          |

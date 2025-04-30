/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import * as ed25519 from '@noble/ed25519'

// browser MUST provide "crypto.getRandomValues"
const crypto = globalThis.crypto
if (typeof crypto.getRandomValues === 'undefined') {
  throw new Error('Environment does not provide "crypto.getRandomValues".')
}

interface EdKeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export default {
  async generateKeyPair(): Promise<EdKeyPair> {
    const seed = new Uint8Array(32)
    crypto.getRandomValues(seed)
    const keyPair = await generateKeyPairFromSeed(seed)
    seed.fill(0)
    return keyPair
  },

  generateKeyPairFromSeed,

  async sign(
    secretKey: Uint8Array | string,
    data: Uint8Array | string
  ): Promise<Uint8Array> {
    return ed25519.sign(data, secretKey.slice(0, 32))
  },

  async verify(
    publicKey: Uint8Array | string,
    data: Uint8Array | string,
    signature: Uint8Array | string
  ): Promise<boolean> {
    return ed25519.verify(signature, data, publicKey)
  },

  async sha256digest(data: Uint8Array): Promise<ArrayBuffer> {
    return crypto.subtle.digest('SHA-256', data)
  }
}

async function generateKeyPairFromSeed(seed: Uint8Array): Promise<EdKeyPair> {
  const publicKey = await ed25519.getPublicKey(seed)
  const secretKey = new Uint8Array(64)
  secretKey.set(seed)
  secretKey.set(publicKey, seed.length)
  return {
    publicKey,
    secretKey
  }
}

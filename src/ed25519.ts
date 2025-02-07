/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {
  sign,
  verify,
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  KeyExportOptions
} from 'crypto'
import {assertKeyBytes} from './validators'
import { promisify } from 'util'

const randomBytesAsync = promisify(randomBytes)

// used to export node's public keys to buffers
const publicKeyEncoding: KeyExportOptions<any> = {
  format: 'der',
  type: 'spki'
}
// used to turn private key bytes into a buffer in DER format
const DER_PRIVATE_KEY_PREFIX = Buffer.from(
  '302e020100300506032b657004220420',
  'hex'
)
// used to turn public key bytes into a buffer in DER format
const DER_PUBLIC_KEY_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

interface EdKeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

/**
 * Generates a key using a 32 byte Uint8Array.
 *
 * @param {Uint8Array} seedBytes - The bytes for the private key.
 *
 * @returns {object} The object with the public and private key material.
 */
async function generateKeyPairFromSeed(
  seedBytes: Uint8Array
): Promise<EdKeyPair> {
  const privateKey = await createPrivateKey({
    // node is more than happy to create a new private key using a DER
    key: privateKeyDerEncode({ seedBytes: seedBytes as Buffer }),
    format: 'der',
    type: 'pkcs8'
  })
  // this expects either a PEM encoded key or a node privateKeyObject
  const publicKey = await createPublicKey(privateKey)
  const publicKeyBuffer = publicKey.export(publicKeyEncoding) as Buffer
  const publicKeyBytes = getKeyMaterial(publicKeyBuffer)
  return {
    publicKey: publicKeyBytes,
    secretKey: Buffer.concat([seedBytes, publicKeyBytes])
  }
}

// generates an ed25519 key using a random seed
async function generateKeyPair(): Promise<EdKeyPair> {
  const seed = await randomBytesAsync(32)
  return generateKeyPairFromSeed(seed)
}

async function signData(
  privateKeyBytes: Uint8Array,
  data: Uint8Array
): Promise<Buffer> {
  const privateKey = await createPrivateKey({
    key: privateKeyDerEncode({ privateKeyBytes: privateKeyBytes as Buffer }),
    format: 'der',
    type: 'pkcs8'
  })
  return sign(null, data, privateKey)
}

async function verifyData(
  publicKeyBytes: Uint8Array,
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  const publicKey = await createPublicKey({
    key: publicKeyDerEncode(publicKeyBytes),
    format: 'der',
    type: 'spki'
  })
  return verify(null, data, publicKey, signature)
}

async function sha256digest(data: Uint8Array | string): Promise<Uint8Array> {
  return createHash('sha256').update(data).digest()
}

export default {
  generateKeyPairFromSeed,
  generateKeyPair,
  sign: signData,
  verify: verifyData,
  sha256digest
}

/**
 * The key material is the part of the buffer after the DER Prefix.
 *
 * @param {Buffer} buffer - A DER encoded key buffer.
 *
 * @throws {Error} If the buffer does not contain a valid DER Prefix.
 *
 * @returns {Buffer} The key material part of the Buffer.
 */
function getKeyMaterial(buffer: Buffer): Buffer {
  if (buffer.indexOf(DER_PUBLIC_KEY_PREFIX) === 0) {
    return buffer.slice(DER_PUBLIC_KEY_PREFIX.length, buffer.length)
  }
  if (buffer.indexOf(DER_PRIVATE_KEY_PREFIX) === 0) {
    return buffer.slice(DER_PRIVATE_KEY_PREFIX.length, buffer.length)
  }
  throw new Error('Expected Buffer to match Ed25519 Public or Private Prefix')
}

interface IPrivateKeyEncode {
  privateKeyBytes?: Buffer
  seedBytes?: Buffer
}

/**
 * Takes a Buffer or Uint8Array with the raw private key and encodes it
 * in DER-encoded PKCS#8 format.
 * Allows Uint8Arrays to be interoperable with node's crypto functions.
 *
 * @param {Buffer} [privateKeyBytes] - Required if no seedBytes.
 * @param {Buffer} [seedBytes] - Required if no privateKeyBytes.
 *
 * @throws {TypeError} Throws if the supplied buffer is not of the right size
 *  or not a Uint8Array or Buffer.
 *
 * @returns {Buffer} DER private key prefix + key bytes.
 */
function privateKeyDerEncode({
  privateKeyBytes,
  seedBytes
}: IPrivateKeyEncode): Buffer {
  if (!(privateKeyBytes != null || seedBytes != null)) {
    throw new TypeError('`privateKeyBytes` or `seedBytes` is required.')
  }
  if(seedBytes && !privateKeyBytes) {
    assertKeyBytes({
      bytes: seedBytes,
      expectedLength: 32
    });
  }
  if(privateKeyBytes && !seedBytes) {
    assertKeyBytes({
      bytes: privateKeyBytes,
      expectedLength: 64
    });
  }
  if (
    seedBytes == null &&
    !(privateKeyBytes instanceof Uint8Array && privateKeyBytes.length === 64)
  ) {
    throw new TypeError('`privateKeyBytes` must be a 64 byte Buffer.')
  }
  let p
  if (seedBytes != null) {
    p = seedBytes
  } else {
    // extract the first 32 bytes of the 64 byte private key representation
    // @ts-ignore
    p = privateKeyBytes.slice(0, 32)
  }
  return Buffer.concat([DER_PRIVATE_KEY_PREFIX, p])
}

/**
 * Takes a Uint8Array of public key bytes and encodes it in DER-encoded
 * SubjectPublicKeyInfo (SPKI) format.
 * Allows Uint8Arrays to be interoperable with node's crypto functions.
 *
 * @param {Uint8Array} publicKeyBytes - The keyBytes.
 *
 * @throws {TypeError} Throws if the bytes are not Uint8Array or of length 32.
 *
 * @returns {Buffer} DER Public key Prefix + key bytes.
 */
function publicKeyDerEncode(publicKeyBytes: Uint8Array): Buffer {
  assertKeyBytes({
    bytes: publicKeyBytes,
    expectedLength: 32,
    code: 'invalidPublicKeyLength'
  });
  return Buffer.concat([DER_PUBLIC_KEY_PREFIX, publicKeyBytes])
}

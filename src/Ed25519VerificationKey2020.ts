/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */

import { base58btc, base64url } from './baseX'
import ed25519 from './ed25519'
import {
  GenerateKeyPairOptions,
  KeyPair,
  PublicKeyJwk,
  PrivateKeyJwk,
  SerializedKeyPair,
  Signer,
  VerificationResult,
  Verifier
} from '@digitalcredentials/keypair'

const SUITE_ID = 'Ed25519VerificationKey2020'
// multibase base58-btc header
const MULTIBASE_BASE58BTC_HEADER = 'z'
// multicodec ed25519-pub header as varint
const MULTICODEC_ED25519_PUB_HEADER = new Uint8Array([0xed, 0x01])
// multicodec ed25519-priv header as varint
const MULTICODEC_ED25519_PRIV_HEADER = new Uint8Array([0x80, 0x26])

export class Ed25519VerificationKey2020 extends KeyPair {
  // Used by CryptoLD harness's fromKeyId() method.
  static SUITE_CONTEXT: string =
    'https://w3id.org/security/suites/ed25519-2020/v1'

  // Used by CryptoLD harness for dispatching.
  static suite: string = SUITE_ID

  publicKeyMultibase: string
  privateKeyMultibase?: string

  /**
   * An implementation of the Ed25519VerificationKey2020 spec, for use with
   * Linked Data Proofs.
   *
   * @see https://w3c-ccg.github.io/lds-ed25519-2020/#ed25519verificationkey2020
   * @see https://github.com/digitalbazaar/jsonld-signatures
   *
   * @param {object} options - Options hashmap.
   * @param {string} options.controller - Controller DID or document url.
   * @param {string} [options.id] - The key ID. If not provided, will be
   *   composed of controller and key fingerprint as hash fragment.
   * @param {string} options.publicKeyMultibase - Multibase encoded public key
   *   with a multicodec ed25519-pub varint header [0xed, 0x01].
   * @param {string} [options.privateKeyMultibase] - Multibase private key
   *   with a multicodec ed25519-priv varint header [0x80, 0x26].
   * @param {string} [options.revoked] - Timestamp of when the key has been
   *   revoked, in RFC3339 format. If not present, the key itself is considered
   *   not revoked. Note that this mechanism is slightly different than DID
   *   Document key revocation, where a DID controller can revoke a key from
   *   that DID by removing it from the DID Document.
   */
  constructor({
    id,
    controller,
    revoked,
    publicKeyMultibase,
    privateKeyMultibase
  }: {
    id?: string
    controller?: string
    revoked?: string
    publicKeyMultibase?: string
    privateKeyMultibase?: string
  } = {}) {
    super({ id, controller, revoked })
    this.type = SUITE_ID
    if (!publicKeyMultibase) {
      throw new TypeError('The "publicKeyMultibase" property is required.')
    }

    if (!_isValidKeyHeader(publicKeyMultibase, MULTICODEC_ED25519_PUB_HEADER)) {
      throw new TypeError(
        '"publicKeyMultibase" has invalid header bytes: ' +
          `"${publicKeyMultibase}".`
      )
    }

    if (
      privateKeyMultibase &&
      !_isValidKeyHeader(privateKeyMultibase, MULTICODEC_ED25519_PRIV_HEADER)
    ) {
      throw new Error('"privateKeyMultibase" has invalid header bytes.')
    }

    // assign valid key values
    this.publicKeyMultibase = publicKeyMultibase
    this.privateKeyMultibase = privateKeyMultibase

    // set key identifier if controller is provided
    if (controller && this.controller && !this.id) {
      this.id = `${this.controller}#${this.fingerprint()}`
    }
  }

  /**
   * Creates an Ed25519 Key Pair from an existing serialized key pair.
   *
   * @param {object} options - Key pair options (see constructor).
   * @example
   * > const keyPair = await Ed25519VerificationKey2020.from({
   * controller: 'did:ex:1234',
   * type: 'Ed25519VerificationKey2020',
   * publicKeyMultibase,
   * privateKeyMultibase
   * });
   *
   * @returns {Promise<Ed25519VerificationKey2020>} An Ed25519 Key Pair.
   */
  static async from(
    options: SerializedKeyPair
  ): Promise<Ed25519VerificationKey2020> {
    if (options.type === 'Ed25519VerificationKey2018') {
      return Ed25519VerificationKey2020.fromEd25519VerificationKey2018({
        keyPair: options
      })
    }
    if (options.type === 'JsonWebKey2020') {
      return Ed25519VerificationKey2020.fromJsonWebKey2020(options)
    }
    return new Ed25519VerificationKey2020(options)
  }

  /**
   * Instance creation method for backwards compatibility with the
   * `Ed25519VerificationKey2018` key suite.
   *
   * @see https://github.com/digitalbazaar/ed25519-verification-key-2018
   * @typedef {object} Ed25519VerificationKey2018
   * @param {Ed25519VerificationKey2018} keyPair - Ed25519 2018 suite key pair.
   *
   * @returns {Ed25519VerificationKey2020} - 2020 suite instance.
   */
  static fromEd25519VerificationKey2018({
    keyPair
  }: {
    keyPair: any
  }): Ed25519VerificationKey2020 {
    const publicKeyMultibase = _encodeMbKey(
      MULTICODEC_ED25519_PUB_HEADER,
      base58btc.decode(keyPair.publicKeyBase58)
    )
    const keyPair2020 = new Ed25519VerificationKey2020({
      id: keyPair.id,
      controller: keyPair.controller,
      publicKeyMultibase
    })

    if (keyPair.privateKeyBase58) {
      keyPair2020.privateKeyMultibase = _encodeMbKey(
        MULTICODEC_ED25519_PRIV_HEADER,
        base58btc.decode(keyPair.privateKeyBase58)
      )
    }

    return keyPair2020
  }

  /**
   * Creates a key pair instance (public key only) from a JsonWebKey2020
   * object.
   *
   * @see https://w3c-ccg.github.io/lds-jws2020/#json-web-key-2020
   *
   * @param {object} options - Options hashmap.
   * @param {string} options.id - Key id.
   * @param {string} options.type - Key suite type.
   * @param {string} options.controller - Key controller.
   * @param {object} options.publicKeyJwk - JWK object.
   *
   * @returns {Promise<Ed25519VerificationKey2020>} Resolves with key pair.
   */
  static async fromJsonWebKey2020({
    id,
    type,
    controller,
    publicKeyJwk,
    privateKeyJwk
  }: SerializedKeyPair): Promise<Ed25519VerificationKey2020> {
    if (type !== 'JsonWebKey2020') {
      throw new TypeError(`Invalid key type: "${type}".`)
    }
    if (!publicKeyJwk) {
      throw new TypeError('"publicKeyJwk" property is required.')
    }
    const { kty, crv } = publicKeyJwk
    if (kty !== 'OKP') {
      throw new TypeError('"kty" is required to be "OKP".')
    }
    if (crv !== 'Ed25519') {
      throw new TypeError('"crv" is required to be "Ed25519".')
    }
    const { x: publicKeyBase64Url } = publicKeyJwk
    const publicKeyBytes = base64url.decode(publicKeyBase64Url as string)
    const publicKeyMultibase = _encodeMbKey(
      MULTICODEC_ED25519_PUB_HEADER,
      publicKeyBytes
    )

    const inputKeyDocument: any = {
      id,
      controller,
      publicKeyMultibase
    }
    if (privateKeyJwk) {
      const { d: privateKeyBase64Url } = privateKeyJwk
      const privateKeyBytes = base64url.decode(privateKeyBase64Url as string)

      // Concat the private and public key bytes
      const combinedPrivatePublicBytes = new Uint8Array(
        privateKeyBytes.length + publicKeyBytes.length
      )
      combinedPrivatePublicBytes.set(privateKeyBytes)
      combinedPrivatePublicBytes.set(publicKeyBytes, privateKeyBytes.length)

      inputKeyDocument.privateKeyMultibase = _encodeMbKey(
        MULTICODEC_ED25519_PRIV_HEADER,
        combinedPrivatePublicBytes
      )
    }

    return Ed25519VerificationKey2020.from(inputKeyDocument)
  }

  /**
   * Generates a KeyPair with an optional deterministic seed.
   *
   * @param {object} [options={}] - Options hashmap.
   * @param {Uint8Array} [options.seed] - A 32-byte array seed for a
   *   deterministic key.
   *
   * @returns {Promise<Ed25519VerificationKey2020>} Resolves with generated
   *   public/private key pair.
   */
  static async generate({
    seed,
    ...keyPairOptions
  }: GenerateKeyPairOptions = {}): Promise<Ed25519VerificationKey2020> {
    let keyObject
    if (seed) {
      keyObject = await ed25519.generateKeyPairFromSeed(seed)
    } else {
      keyObject = await ed25519.generateKeyPair()
    }
    const publicKeyMultibase = _encodeMbKey(
      MULTICODEC_ED25519_PUB_HEADER,
      keyObject.publicKey
    )

    const privateKeyMultibase = _encodeMbKey(
      MULTICODEC_ED25519_PRIV_HEADER,
      keyObject.secretKey
    )

    return new Ed25519VerificationKey2020({
      publicKeyMultibase,
      privateKeyMultibase,
      ...keyPairOptions
    })
  }

  /**
   * Creates an instance of Ed25519VerificationKey2020 from a key fingerprint.
   *
   * @param {object} options - Options hashmap.
   * @param {string} options.fingerprint - Multibase encoded key fingerprint.
   *
   * @returns {Ed25519VerificationKey2020} Returns key pair instance (with
   *   public key only).
   */
  static fromFingerprint({
    fingerprint
  }: {
    fingerprint: string
  }): Ed25519VerificationKey2020 {
    return new Ed25519VerificationKey2020({ publicKeyMultibase: fingerprint })
  }

  /**
   * @returns {Uint8Array} Public key bytes.
   */
  get _publicKeyBuffer(): Uint8Array | undefined {
    if (!this.publicKeyMultibase) {
      return
    }
    // remove multibase header
    const publicKeyMulticodec = base58btc.decode(
      this.publicKeyMultibase.substr(1)
    )
    // remove multicodec header
    const publicKeyBytes = publicKeyMulticodec.slice(
      MULTICODEC_ED25519_PUB_HEADER.length
    )

    return publicKeyBytes
  }

  /**
   * @returns {Uint8Array} Private key bytes.
   */
  get _privateKeyBuffer(): Uint8Array | undefined {
    if (!this.privateKeyMultibase) {
      return
    }
    // remove multibase header
    const privateKeyMulticodec = base58btc.decode(
      this.privateKeyMultibase.substr(1)
    )
    // remove multicodec header
    const privateKeyBytes = privateKeyMulticodec.slice(
      MULTICODEC_ED25519_PRIV_HEADER.length
    )

    return privateKeyBytes
  }

  /**
   * Generates and returns a multiformats encoded
   * ed25519 public key fingerprint (for use with cryptonyms, for example).
   *
   * @see https://github.com/multiformats/multicodec
   *
   * @returns {string} The fingerprint.
   */
  fingerprint(): string {
    return this.publicKeyMultibase
  }

  /**
   * Exports the serialized representation of the KeyPair
   * and other information that JSON-LD Signatures can use to form a proof.
   *
   * @param {object} [options={}] - Options hashmap.
   * @param {boolean} [options.publicKey] - Export public key material?
   * @param {boolean} [options.privateKey] - Export private key material?
   * @param {boolean} [options.includeContext] - Include JSON-LD context?
   *
   * @returns {object} A plain js object that's ready for serialization
   *   (to JSON, etc), for use in DIDs, Linked Data Proofs, etc.
   */
  export({
    publicKey = false,
    privateKey = false,
    includeContext = false
  }: {
    publicKey?: boolean
    privateKey?: boolean
    includeContext?: boolean
  } = {}): SerializedKeyPair {
    if (!(publicKey || privateKey)) {
      throw new TypeError(
        'Export requires specifying either "publicKey" or "privateKey".'
      )
    }
    const exportedKey: any = {
      id: this.id,
      type: this.type
    }
    if (includeContext) {
      exportedKey['@context'] = Ed25519VerificationKey2020.SUITE_CONTEXT
    }
    if (this.controller) {
      exportedKey.controller = this.controller
    }
    if (publicKey) {
      exportedKey.publicKeyMultibase = this.publicKeyMultibase
    }
    if (privateKey) {
      exportedKey.privateKeyMultibase = this.privateKeyMultibase
    }
    if (this.revoked) {
      exportedKey.revoked = this.revoked
    }
    return exportedKey
  }

  /**
   * Exports the representation of the KeyPair in Ed25519VerificationKey2018
   * serialization format.
   *
   * @param {object} [options={}] - Options hashmap.
   * @param {boolean} [options.publicKey] - Export public key material?
   * @param {boolean} [options.privateKey] - Export private key material?
   * @param {boolean} [options.includeContext] - Include JSON-LD context?
   *
   * @returns {object} A plain js object that's ready for serialization
   *   (to JSON, etc), for use in DIDs, Linked Data Proofs, etc.
   */
  toEd255519VerificationKey2018({
    publicKey = false,
    privateKey = false,
    includeContext = false
  }: {
    publicKey?: boolean
    privateKey?: boolean
    includeContext?: boolean
  } = {}): SerializedKeyPair {
    if (!(publicKey || privateKey)) {
      throw new TypeError(
        'Export requires specifying either "publicKey" or "privateKey".'
      )
    }
    const exportedKey: any = {
      id: this.id,
      type: 'Ed25519VerificationKey2018'
    }
    if (includeContext) {
      exportedKey['@context'] =
        'https://w3id.org/security/suites/ed25519-2018/v1'
    }
    if (this.controller) {
      exportedKey.controller = this.controller
    }
    if (publicKey && this._publicKeyBuffer) {
      exportedKey.publicKeyBase58 = base58btc.encode(this._publicKeyBuffer)
    }
    if (privateKey && this._privateKeyBuffer) {
      exportedKey.privateKeyBase58 = base58btc.encode(this._privateKeyBuffer)
    }
    if (this.revoked) {
      exportedKey.revoked = this.revoked
    }
    return exportedKey
  }

  /**
   * Returns the JWK representation of this key pair.
   *
   * @see https://datatracker.ietf.org/doc/html/rfc8037
   *
   * @param {object} [options={}] - Options hashmap.
   * @param {boolean} [options.publicKey] - Include public key?
   * @param {boolean} [options.privateKey] - Include private key?
   *
   * @returns {{kty: string, crv: string, x: string, d: string}} JWK
   *   representation.
   */
  toJwk({
    publicKey = true,
    privateKey = false
  }: { publicKey?: boolean; privateKey?: boolean } = {}):
    | PublicKeyJwk
    | PrivateKeyJwk {
    if (!(publicKey || privateKey)) {
      throw new TypeError('Either a "publicKey" or a "privateKey" is required.')
    }
    if (!this._publicKeyBuffer) {
      throw new TypeError('Public key buffer is not set.')
    }
    const jwk: any = { crv: 'Ed25519', kty: 'OKP' }
    if (publicKey && this._publicKeyBuffer) {
      jwk.x = base64url.encode(this._publicKeyBuffer)
    }
    if (privateKey && this._privateKeyBuffer) {
      // the private key buffer is a concatenation of <priv key bytes><pub key bytes>
      // however, the JWK wants just the private key
      jwk.d = base64url.encode(
        this._privateKeyBuffer.slice(
          0,
          this._privateKeyBuffer.length - this._publicKeyBuffer.length
        )
      )
    }
    return jwk
  }

  /**
   * @see https://datatracker.ietf.org/doc/html/rfc8037#appendix-A.3
   *
   * @returns {Promise<string>} JWK Thumbprint.
   */
  async jwkThumbprint(): Promise<string> {
    if (!this._publicKeyBuffer) {
      throw new TypeError('Public key buffer is not set.')
    }
    const publicKey = base64url.encode(this._publicKeyBuffer)
    const serialized = `{"crv":"Ed25519","kty":"OKP","x":"${publicKey}"}`
    const data = new TextEncoder().encode(serialized)
    return base64url.encode(new Uint8Array(await ed25519.sha256digest(data)))
  }

  /**
   * Returns the JsonWebKey2020 representation of this key pair.
   *
   * @see https://w3c-ccg.github.io/lds-jws2020/#json-web-key-2020
   *
   * @returns {Promise<object>} JsonWebKey2020 representation.
   */
  async toJsonWebKey2020(): Promise<SerializedKeyPair> {
    const serialized: any = {
      '@context': 'https://w3id.org/security/jws/v1',
      type: 'JsonWebKey2020',
      publicKeyJwk: this.toJwk({ publicKey: true })
    }
    if (this.controller) {
      serialized.controller = this.controller
      serialized.id = `${this.controller}#${await this.jwkThumbprint()}`
    }

    return serialized
  }

  /**
   * Tests whether the fingerprint was generated from a given key pair.
   *
   * @example
   * > edKeyPair.verifyFingerprint({fingerprint: 'z6Mk2S2Q...6MkaFJewa'});
   * {verified: true};
   *
   * @param {object} options - Options hashmap.
   * @param {string} options.fingerprint - A public key fingerprint.
   *
   * @returns {{valid: boolean, error: *}} Result of verification.
   */
  verifyFingerprint({
    fingerprint
  }: {
    fingerprint: string
  }): VerificationResult {
    // fingerprint should have multibase base58-btc header
    if (
      !(
        typeof fingerprint === 'string' &&
        fingerprint[0] === MULTIBASE_BASE58BTC_HEADER
      )
    ) {
      return {
        error: new Error('"fingerprint" must be a multibase encoded string.'),
        verified: false
      } as VerificationResult
    }
    if (!this._publicKeyBuffer) {
      throw new TypeError('Public key buffer is not set.')
    }

    let fingerprintBuffer
    try {
      fingerprintBuffer = base58btc.decode(fingerprint.substr(1))
      if (!fingerprintBuffer) {
        throw new TypeError('Invalid encoding of fingerprint.')
      }
    } catch (e: any) {
      return { error: e, verified: false } as VerificationResult
    }

    const buffersEqual = _isEqualBuffer(
      this._publicKeyBuffer,
      fingerprintBuffer.slice(2)
    )

    // validate the first two multicodec bytes
    const verified =
      fingerprintBuffer[0] === MULTICODEC_ED25519_PUB_HEADER[0] &&
      fingerprintBuffer[1] === MULTICODEC_ED25519_PUB_HEADER[1] &&
      buffersEqual
    if (!verified) {
      return {
        error: new Error(
          'Invalid fingerprint encoding (expecting 0xed01 byte prefix).'
        ),
        verified: false
      } as VerificationResult
    }
    return { verified } as VerificationResult
  }

  signer(): Signer {
    const privateKeyBuffer = this._privateKeyBuffer

    return {
      async sign({ data }) {
        if (!privateKeyBuffer) {
          throw new Error('A private key is not available for signing.')
        }
        return ed25519.sign(privateKeyBuffer, data)
      },
      id: this.id
    }
  }

  verifier(): Verifier {
    const publicKeyBuffer = this._publicKeyBuffer

    return {
      async verify({ data, signature }) {
        if (!publicKeyBuffer) {
          throw new Error('A public key is not available for verifying.')
        }
        return ed25519.verify(publicKeyBuffer, data, signature)
      },
      id: this.id
    }
  }
}

// check to ensure that two buffers are byte-for-byte equal
// WARNING: this function must only be used to check public information as
//          timing attacks can be used for non-constant time checks on
//          secret information.
function _isEqualBuffer(buf1: Uint8Array, buf2: Uint8Array): boolean {
  if (buf1.length !== buf2.length) {
    return false
  }
  for (let i = 0; i < buf1.length; i++) {
    if (buf1[i] !== buf2[i]) {
      return false
    }
  }
  return true
}

// check a multibase key for an expected header
function _isValidKeyHeader(
  multibaseKey: string,
  expectedHeader: Uint8Array
): boolean {
  if (
    !(
      typeof multibaseKey === 'string' &&
      multibaseKey[0] === MULTIBASE_BASE58BTC_HEADER
    )
  ) {
    return false
  }

  const keyBytes = base58btc.decode(multibaseKey.slice(1))
  return expectedHeader.every((val, i) => keyBytes[i] === val)
}

// encode a multibase base58-btc multicodec key
function _encodeMbKey(header: Uint8Array, key: Uint8Array): string {
  const mbKey = new Uint8Array(header.length + key.length)

  mbKey.set(header)
  mbKey.set(key, header.length)

  return MULTIBASE_BASE58BTC_HEADER + base58btc.encode(mbKey)
}

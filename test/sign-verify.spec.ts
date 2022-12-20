/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import { expect } from 'chai'

import { Ed25519VerificationKey2020 } from '../src'
import { mockKey, suites } from './mock-data'
import { stringToUint8Array } from './text-encoder'
import { base58btc } from '../src/baseX'

const keyPair = new Ed25519VerificationKey2020({
  controller: 'did:example:1234',
  ...mockKey
})

const signer = keyPair.signer()
const verifier = keyPair.verifier()

// the same signature should be generated on every test platform
// (eg. browser, node14)
const targetSignatureBase58 =
  '25fgrioJMRbKuq4sGz2Ngh6K7GuonRTUAzRk7asgvnVA2W' +
  'YSHtLBPX1BXiTtMqTwen7MKgQfbMpm6N6vgDc7VDF9'

describe('sign and verify', () => {
  it('works properly', async () => {
    expect(signer).to.have.property(
      'id',
      'did:example:1234#z6MknCCLeeHBUaHu4aHSVLDCYQW9gjVJ7a63FpMvtuVMy53T'
    )
    expect(verifier).to.have.property(
      'id',
      'did:example:1234#z6MknCCLeeHBUaHu4aHSVLDCYQW9gjVJ7a63FpMvtuVMy53T'
    )
    const data = stringToUint8Array('test 1234')
    const signature = await signer.sign({ data })
    expect(base58btc.encode(signature)).to.equal(targetSignatureBase58)
    const result = await verifier.verify({ data, signature })
    expect(result).to.be.true
  })

  it('fails if signing data is changed', async () => {
    const data = stringToUint8Array('test 1234')
    const signature = await signer.sign({ data })
    const changedData = stringToUint8Array('test 4321')
    const result = await verifier.verify({ data: changedData, signature })
    expect(result).to.be.false
  })
  // these tests simulate what happens when a key & signature
  // created in either the browser or the node is verified
  // in a different enviroment
  for (const suite of suites) {
    it(suite.title, async () => {
      const _keyPair = new Ed25519VerificationKey2020({
        controller: 'did:example:1234',
        ...suite.key
      })

      const data = stringToUint8Array(suite.data)
      const signature = base58btc.decode(suite.signature)
      const result = await _keyPair.verifier().verify({ data, signature })
      expect(result).to.be.true
    })
  }
})

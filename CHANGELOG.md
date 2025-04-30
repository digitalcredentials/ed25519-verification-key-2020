# @digitalcredentials/ed25519-verification-key-2020 ChangeLog

## 5.0.0 -
### Changed
- Update to latest versions of `keypair`, `base-X` and `ssi` libraries.
- **BREAKING**: Drop CommonJS export option. (Now ESM only.)

## 4.0.0 - 2022-12-22
### Changed
- Update to upstream `v4.1.0` (use `assertKeyBytes()` etc).
- **BREAKING**: Convert to Typescript, use [`@digitalcredentials/keypair`](https://github.com/digitalcredentials/keypair)
  lib instead of `crypto-ld`.
- Fix `toJwk()` and `fromJsonWebKey2020()` logic (see [issue #5](https://github.com/digitalcredentials/ed25519-verification-key-2020/issues/5))

### Added
- Public key byte checks have error codes compatible with the `did:key` spec.

### Fixed
- No longer throw a `TypeError` when passing in a Uint8Array of the wrong length.

## 3.3.0 - 2022-05-27
### Added
- Add `toEd255519VerificationKey2018()` instance method, round trip serialization
  and import to 2018.

### Changed
- Replace underlying ed25519 implementation with `@noble/ed25519`. This
  should be a non-breaking change.

## 3.2.2 - 2021-10-15
### Added
- Add some type check validation to toJwk() method.

## 3.2.0 - 2021-09-28
### Added
- Add support for `JsonWebKey2020` and JWK import/export, and JWK thumbprint.

## 3.1.1 - 2021-09-17

### Changed
- **BREAKING**: Synced with [`@digitalbazaar/ed25519-verification-key-2020 v3.1.0`
  (see its CHANGELOG)](https://github.com/digitalbazaar/ed25519-verification-key-2020/blob/main/CHANGELOG.md#310---2021-06-24)
- Removed `esm` runtime transpiler usage, make compatible with TypeScript.

## 1.0.0 - 2021-02-27

Initial version.

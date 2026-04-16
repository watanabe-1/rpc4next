# Changelog

## [0.7.0](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.6.1...rpc4next-v0.7.0) (2026-04-16)


### Features

* add procedure contract foundations ([#382](https://github.com/watanabe-1/rpc4next/issues/382)) ([3f0eb7d](https://github.com/watanabe-1/rpc4next/commit/3f0eb7d83afe75709d503a033666e37319e79df4))
* add shared baseProcedure preset example for procedure routes ([#393](https://github.com/watanabe-1/rpc4next/issues/393)) ([ae36dfb](https://github.com/watanabe-1/rpc4next/commit/ae36dfbf081aad60d47534e944eebc4080118982))
* **client:** Infer custom validation response types ([#413](https://github.com/watanabe-1/rpc4next/issues/413)) ([91b96b7](https://github.com/watanabe-1/rpc4next/commit/91b96b7a131bbb39b305b920dacd8bf818d75fbb))
* generate route contracts and require bound procedure ([#397](https://github.com/watanabe-1/rpc4next/issues/397)) ([6d1eb87](https://github.com/watanabe-1/rpc4next/commit/6d1eb8792311af7a583506444a2c83ff3b76b0d8))
* preserve shared procedure error contracts across routes and client types ([#394](https://github.com/watanabe-1/rpc4next/issues/394)) ([488bdb9](https://github.com/watanabe-1/rpc4next/commit/488bdb989feb7d4c9a1602314892c6e9d580d6c3))
* **rpc4next:** start phase 3 with procedure builder and nextRoute ([#384](https://github.com/watanabe-1/rpc4next/issues/384)) ([2132ea8](https://github.com/watanabe-1/rpc4next/commit/2132ea8ac717b49cda33f5029d7e5d08efdd17c6))
* **server:** Add Arktype and Valibot schema support ([#407](https://github.com/watanabe-1/rpc4next/issues/407)) ([a152731](https://github.com/watanabe-1/rpc4next/commit/a1527314435ac0c29cd2d4d17c6028b5a29fa8fa))
* **server:** Add configurable procedure error formatting ([#400](https://github.com/watanabe-1/rpc4next/issues/400)) ([a2a6161](https://github.com/watanabe-1/rpc4next/commit/a2a61611f283ea602792bc070312d9fcdaa23daa))
* **server:** add first-class procedure.formData support ([#398](https://github.com/watanabe-1/rpc4next/issues/398)) ([7669ce0](https://github.com/watanabe-1/rpc4next/commit/7669ce0d4327e6b898a32e9f2780d96b359f5420))
* **server:** add opt-in runtime output validation for procedures ([#395](https://github.com/watanabe-1/rpc4next/issues/395)) ([61bc70f](https://github.com/watanabe-1/rpc4next/commit/61bc70f3538a1f18e9d3822aef2138ae7f70a4f6))
* **server:** Add procedure defaults for shared onError ([#429](https://github.com/watanabe-1/rpc4next/issues/429)) ([fc39764](https://github.com/watanabe-1/rpc4next/commit/fc39764f67d26bfda705c52e86044920e23a58ee))
* **server:** Add procedure nextRoute sugar ([#428](https://github.com/watanabe-1/rpc4next/issues/428)) ([59463b4](https://github.com/watanabe-1/rpc4next/commit/59463b4953d9470d57ca4ac933076cffba79a573))
* **server:** Add procedure response helpers ([#403](https://github.com/watanabe-1/rpc4next/issues/403)) ([d80dc85](https://github.com/watanabe-1/rpc4next/commit/d80dc85bfe34d713cd0723a2888185fba5b1b974))
* **server:** Add procedure validation branching ([#401](https://github.com/watanabe-1/rpc4next/issues/401)) ([13d957b](https://github.com/watanabe-1/rpc4next/commit/13d957b5b1b0efa4a78f313344afbef936d5fc41))
* **server:** Add Standard Schema V1 procedure support ([#392](https://github.com/watanabe-1/rpc4next/issues/392)) ([5207824](https://github.com/watanabe-1/rpc4next/commit/520782476193b8c23a03009354d7dcd94036947f))
* **server:** Bind kit rpcError to error registry status ([#411](https://github.com/watanabe-1/rpc4next/issues/411)) ([075438f](https://github.com/watanabe-1/rpc4next/commit/075438fda7c67b8a28f1961c6f4a603b5489b82a))
* **server:** Validate response helper output payload ([#412](https://github.com/watanabe-1/rpc4next/issues/412)) ([4be5db6](https://github.com/watanabe-1/rpc4next/commit/4be5db60f724cff45fee3ae8d33898d0c65cec07))


### Bug Fixes

* **client:** Remove body from GET and HEAD requests ([#440](https://github.com/watanabe-1/rpc4next/issues/440)) ([27b19e1](https://github.com/watanabe-1/rpc4next/commit/27b19e1411078e53985ba51c6b542c68b57b8889))
* **client:** Support array query serialization ([#439](https://github.com/watanabe-1/rpc4next/issues/439)) ([cb8bebb](https://github.com/watanabe-1/rpc4next/commit/cb8bebb916962ceb21f381f7980e7f4de774ea2d))
* **monorepo:** Preserve raw validation error responses ([#414](https://github.com/watanabe-1/rpc4next/issues/414)) ([254ccc8](https://github.com/watanabe-1/rpc4next/commit/254ccc83ae0caaaef7d817f638a4bd3b6642b0fb))
* Preserve helper response statusText ([#416](https://github.com/watanabe-1/rpc4next/issues/416)) ([48d8603](https://github.com/watanabe-1/rpc4next/commit/48d860354ec6ec692d66206810d111ba4e40b629))
* Preserve literal output types in procedure responses ([#404](https://github.com/watanabe-1/rpc4next/issues/404)) ([cb0d051](https://github.com/watanabe-1/rpc4next/commit/cb0d0516188fed3e8123baf2626a5d21842e3eb2))
* **rpc4next:** align procedure bad-request and rpcError status contracts ([#389](https://github.com/watanabe-1/rpc4next/issues/389)) ([67d5d82](https://github.com/watanabe-1/rpc4next/commit/67d5d8275bdd87d64825ffabca0da0be7da7a5a6))
* **rpc4next:** align procedure contract typing with runtime ([#386](https://github.com/watanabe-1/rpc4next/issues/386)) ([187e5c8](https://github.com/watanabe-1/rpc4next/commit/187e5c84b6fb683db60c63bf6a76f78b3d47ae94))
* **rpc4next:** align procedure route query, error, and method typing ([#385](https://github.com/watanabe-1/rpc4next/issues/385)) ([f3cc213](https://github.com/watanabe-1/rpc4next/commit/f3cc213046e9dc55d95a142f07f052dff3dd7bff))
* **rpc4next:** guard invalid procedure methods and read request metadata from NextRequest ([#390](https://github.com/watanabe-1/rpc4next/issues/390)) ([540974e](https://github.com/watanabe-1/rpc4next/commit/540974ebbc55299ed122947c3c8c9f45c4e1e6bf))
* **rpc4next:** normalize procedure JSON errors and add error contracts ([#387](https://github.com/watanabe-1/rpc4next/issues/387)) ([b155911](https://github.com/watanabe-1/rpc4next/commit/b1559119d399ecd16e45c428e1e03edbca6057b7))
* **server:** Align procedure response helpers ([#410](https://github.com/watanabe-1/rpc4next/issues/410)) ([0a6c23b](https://github.com/watanabe-1/rpc4next/commit/0a6c23bf4afa2e77148eebe7e9969f22d4d948e5))
* Validate reflected procedure output payloads ([#419](https://github.com/watanabe-1/rpc4next/issues/419)) ([369a631](https://github.com/watanabe-1/rpc4next/commit/369a6319e832c81e0e2dcabdbdbd22ac58e665fe))

## [0.6.1](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.6.0...rpc4next-v0.6.1) (2026-03-16)


### Bug Fixes

* **rpc:** Clarify validation and client type helpers ([#345](https://github.com/watanabe-1/rpc4next/issues/345)) ([737ca33](https://github.com/watanabe-1/rpc4next/commit/737ca33a27bd4cb1efc326ac23b66f00c4eb6a8f))


### Reverts

* **main:** roll back to aa0e728 ([#348](https://github.com/watanabe-1/rpc4next/issues/348)) ([6436b9f](https://github.com/watanabe-1/rpc4next/commit/6436b9fede96c8df940125c7d614dcdbd9e193d3))

## [0.6.0](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.5.1...rpc4next-v0.6.0) (2026-03-15)


### Features

* **monorepo:** add Next 16 peer dependency support ([#337](https://github.com/watanabe-1/rpc4next/issues/337)) ([fe6e9df](https://github.com/watanabe-1/rpc4next/commit/fe6e9dfee8005b7494e2fe4200c6aae23750aa41))

## [0.5.1](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.5.0...rpc4next-v0.5.1) (2026-03-15)


### Bug Fixes

* **client:** Handle malformed static segments ([#310](https://github.com/watanabe-1/rpc4next/issues/310)) ([48594c6](https://github.com/watanabe-1/rpc4next/commit/48594c6c185020acfe95029744687dede3cad80b))
* **client:** Handle optional catch-all segments ([#308](https://github.com/watanabe-1/rpc4next/issues/308)) ([9d764fb](https://github.com/watanabe-1/rpc4next/commit/9d764fbf707fe1ffb8f015968eb931facad2f25d))

## [0.5.0](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.14...rpc4next-v0.5.0) (2026-03-04)


### Features

* **ci:** copy root files before publish ([#252](https://github.com/watanabe-1/rpc4next/issues/252)) ([408fd0c](https://github.com/watanabe-1/rpc4next/commit/408fd0c9b562d2f07a4dbf43697aae5c8e366da8))

## [0.4.14](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.13...rpc4next-v0.4.14) (2026-02-26)


### Bug Fixes

* **deps:** bump the bun group with 16 updates ([#196](https://github.com/watanabe-1/rpc4next/issues/196)) ([c2f5560](https://github.com/watanabe-1/rpc4next/commit/c2f5560c0db83baeafc9a1503cbcc48ff2300d92))

## [0.4.13](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.12...rpc4next-v0.4.13) (2026-02-23)


### Bug Fixes

* **build:** Normalize homepage field placement in package manifests ([#231](https://github.com/watanabe-1/rpc4next/issues/231)) ([2f20f6b](https://github.com/watanabe-1/rpc4next/commit/2f20f6bdaccd32c654fd85910ac52b1d6fb12956))

## [0.4.12](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.11...rpc4next-v0.4.12) (2026-02-23)


### Bug Fixes

* **build:** reorder version field in package manifests ([#227](https://github.com/watanabe-1/rpc4next/issues/227)) ([cfe7827](https://github.com/watanabe-1/rpc4next/commit/cfe7827ee5d08a791a7425b4c9ea6759e10ec05d))

## [0.4.11](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.10...rpc4next-v0.4.11) (2026-02-23)


### Bug Fixes

* **release:** align package homepage metadata ([#224](https://github.com/watanabe-1/rpc4next/issues/224)) ([be1f29c](https://github.com/watanabe-1/rpc4next/commit/be1f29c5467db2e42592f92a143c93a716fe9846))

## [0.4.10](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.9...rpc4next-v0.4.10) (2026-02-23)


### Bug Fixes

* **release:** add explicit package versions ([#221](https://github.com/watanabe-1/rpc4next/issues/221)) ([eaec4e3](https://github.com/watanabe-1/rpc4next/commit/eaec4e3b71dcc7aefc99b023dbc7b0ba584e5128))

## [0.4.9](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.8...rpc4next-v0.4.9) (2026-02-23)


### Bug Fixes

* **rpc:** Add TSDoc for catch-all key helper ([#219](https://github.com/watanabe-1/rpc4next/issues/219)) ([cc27113](https://github.com/watanabe-1/rpc4next/commit/cc27113aa8e93292ad5e410387bacb6239a83806))

## [0.4.8](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.7...rpc4next-v0.4.8) (2026-02-23)


### Bug Fixes

* Add TSDoc for isDynamic ([#217](https://github.com/watanabe-1/rpc4next/issues/217)) ([c395f28](https://github.com/watanabe-1/rpc4next/commit/c395f289ea9c3ad32da964f8d2bbf14a1319f64d))

## [0.4.7](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.6...rpc4next-v0.4.7) (2026-02-23)


### Bug Fixes

* **client:** Add createUrl TSDoc ([#214](https://github.com/watanabe-1/rpc4next/issues/214)) ([3440717](https://github.com/watanabe-1/rpc4next/commit/3440717351e36c52e229adb45d882a660f16d2af))

## [0.4.6](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.5...rpc4next-v0.4.6) (2026-02-23)


### Bug Fixes

* **client:** add TSDoc for replaceDynamicSegments ([#211](https://github.com/watanabe-1/rpc4next/issues/211)) ([5d13bd5](https://github.com/watanabe-1/rpc4next/commit/5d13bd56d6d59ef35867672020e6ed0c50a19784))

## [0.4.5](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.4...rpc4next-v0.4.5) (2026-02-23)


### Bug Fixes

* **rpc:** Add TSDoc for buildUrlSuffix ([#209](https://github.com/watanabe-1/rpc4next/issues/209)) ([6561b29](https://github.com/watanabe-1/rpc4next/commit/6561b2960316f96abc24df6e63cf777b12db2650))

## [0.4.4](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.3...rpc4next-v0.4.4) (2026-02-23)


### Bug Fixes

* **rpc:** Add TSDoc for normalizeHeaders ([#206](https://github.com/watanabe-1/rpc4next/issues/206)) ([804ec84](https://github.com/watanabe-1/rpc4next/commit/804ec84ab47781132755a429e18a02e55246c129))

## [0.4.3](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.2...rpc4next-v0.4.3) (2026-02-23)


### Bug Fixes

* **rpc:** Add TSDoc for safeDecode ([#204](https://github.com/watanabe-1/rpc4next/issues/204)) ([afce916](https://github.com/watanabe-1/rpc4next/commit/afce916473f82e886bcce3413c4b617cb9a1a6ea))

## [0.4.2](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.1...rpc4next-v0.4.2) (2026-02-23)


### Bug Fixes

* **rpc:** add TSDoc for normalizeBasePath ([#201](https://github.com/watanabe-1/rpc4next/issues/201)) ([62f93ae](https://github.com/watanabe-1/rpc4next/commit/62f93aec274af0df1777a2f1b682483d4e50f98f))

## [0.4.1](https://github.com/watanabe-1/rpc4next/compare/rpc4next-v0.4.0...rpc4next-v0.4.1) (2026-02-23)


### Bug Fixes

* **rpc:** Use arrow functions and trailing commas ([#197](https://github.com/watanabe-1/rpc4next/issues/197)) ([3d496a5](https://github.com/watanabe-1/rpc4next/commit/3d496a52d6903125418b832f070bbf4aacea878d))

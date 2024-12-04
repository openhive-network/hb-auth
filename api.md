
<a name="_modulesmd"></a>

# @hiveio/hb-auth

## Classes

- [AuthorizationError](#classesauthorizationerrormd)
- [OfflineClient](#classesofflineclientmd)
- [OnlineClient](#classesonlineclientmd)

## Interfaces

- [AuthStatus](#interfacesauthstatusmd)
- [AuthUser](#interfacesauthusermd)
- [ClientOptions](#interfacesclientoptionsmd)

## Type Aliases

### KeyAuthorityType

Ƭ **KeyAuthorityType**: typeof `KEY_TYPES`[`number`]

#### Defined in

dist/hb-auth.d.ts:14

## Variables

### isBrowser

• `Const` **isBrowser**: `boolean`

#### Defined in

dist/hb-auth.d.ts:4

___

### isSupportSharedWorker

• `Const` **isSupportSharedWorker**: `boolean`

#### Defined in

dist/hb-auth.d.ts:6

___

### isSupportWebWorker

• `Const` **isSupportWebWorker**: `boolean`

#### Defined in

dist/hb-auth.d.ts:5


<a name="classesauthorizationerrormd"></a>

# Class: AuthorizationError

## Hierarchy

- `Error`

  ↳ **`AuthorizationError`**

## Constructors

### constructor

• **new AuthorizationError**(`message`): [`AuthorizationError`](#classesauthorizationerrormd)

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `any` |

#### Returns

[`AuthorizationError`](#classesauthorizationerrormd)

#### Overrides

Error.constructor

#### Defined in

dist/hb-auth.d.ts:10

## Properties

### message

• **message**: `any`

#### Overrides

Error.message

#### Defined in

dist/hb-auth.d.ts:9

___

### name

• **name**: `string`

#### Inherited from

Error.name

#### Defined in

node_modules/.pnpm/typescript@5.4.5/node_modules/typescript/lib/lib.es5.d.ts:1076

___

### stack

• `Optional` **stack**: `string`

#### Inherited from

Error.stack

#### Defined in

node_modules/.pnpm/typescript@5.4.5/node_modules/typescript/lib/lib.es5.d.ts:1078

___

### prepareStackTrace

▪ `Static` `Optional` **prepareStackTrace**: (`err`: `Error`, `stackTraces`: `CallSite`[]) => `any`

Optional override for formatting stack traces

**`See`**

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Type declaration

▸ (`err`, `stackTraces`): `any`

##### Parameters

| Name | Type |
| :------ | :------ |
| `err` | `Error` |
| `stackTraces` | `CallSite`[] |

##### Returns

`any`

#### Inherited from

Error.prepareStackTrace

#### Defined in

node_modules/.pnpm/@types+node@20.14.14/node_modules/@types/node/globals.d.ts:28

___

### stackTraceLimit

▪ `Static` **stackTraceLimit**: `number`

#### Inherited from

Error.stackTraceLimit

#### Defined in

node_modules/.pnpm/@types+node@20.14.14/node_modules/@types/node/globals.d.ts:30

## Methods

### captureStackTrace

▸ **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Create .stack property on a target object

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetObject` | `object` |
| `constructorOpt?` | `Function` |

#### Returns

`void`

#### Inherited from

Error.captureStackTrace

#### Defined in

node_modules/.pnpm/@types+node@20.14.14/node_modules/@types/node/globals.d.ts:21


<a name="classesofflineclientmd"></a>

# Class: OfflineClient

**`Description`**

Auth client that doesn't
verify user's authority through the network. So, user has resposibility
for imported keys' validity.

## Hierarchy

- `Client`

  ↳ **`OfflineClient`**

## Constructors

### constructor

• **new OfflineClient**(`clientOptions?`): [`OfflineClient`](#classesofflineclientmd)

#### Parameters

| Name | Type |
| :------ | :------ |
| `clientOptions?` | `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\> |

#### Returns

[`OfflineClient`](#classesofflineclientmd)

#### Overrides

Client.constructor

#### Defined in

dist/hb-auth.d.ts:211

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

dist/hb-auth.d.ts:84

___

### clientOptions

• `Readonly` **clientOptions**: `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\>

#### Overrides

Client.clientOptions

#### Defined in

dist/hb-auth.d.ts:210

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.authenticate

#### Defined in

dist/hb-auth.d.ts:214

___

### authorize

▸ **authorize**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

dist/hb-auth.d.ts:212

___

### getAuthByUser

▸ **getAuthByUser**(`username`): `Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |

#### Returns

`Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

**`Description`**

Method to get auth status for a given user.
If there is no user it will return null.

#### Inherited from

Client.getAuthByUser

#### Defined in

dist/hb-auth.d.ts:138

___

### getAuths

▸ **getAuths**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

**`Description`**

Method to get all registered users with their active auth status.
If there is no user registered, it will return an empty array.

#### Inherited from

Client.getAuths

#### Defined in

dist/hb-auth.d.ts:131

___

### importKey

▸ **importKey**(`username`, `wifKey`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `wifKey` | `string` | WIF key |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Public Key

**`Description`**

Method that imports a new key for given user
This method requires user to be authenticated or unlocked first

#### Inherited from

Client.importKey

#### Defined in

dist/hb-auth.d.ts:180

___

### initialize

▸ **initialize**(): `Promise`\<[`OfflineClient`](#classesofflineclientmd)\>

#### Returns

`Promise`\<[`OfflineClient`](#classesofflineclientmd)\>

**`Description`**

Async method that prepares client to run.
That method should be called first before calling other methods.

#### Inherited from

Client.initialize

#### Defined in

dist/hb-auth.d.ts:119

___

### lock

▸ **lock**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that locks user session and keeps user session during session time.
Note that when user session time ends, user should authenticate again.

#### Inherited from

Client.lock

#### Defined in

dist/hb-auth.d.ts:163

___

### logout

▸ **logout**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that ends existing user session. This is different than locking user.
When this is called any callback set via

**`See`**

will fire.

#### Inherited from

Client.logout

#### Defined in

dist/hb-auth.d.ts:185

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `wifKey` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.register

#### Defined in

dist/hb-auth.d.ts:213

___

### setSessionEndCallback

▸ **setSessionEndCallback**(`cb`): `Promise`\<`void`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `cb` | () => `Promise`\<`void`\> | Async callback function that fires on session end |

#### Returns

`Promise`\<`void`\>

**`Description`**

Method to set callback for being notified on session and or logout action.

#### Inherited from

Client.setSessionEndCallback

#### Defined in

dist/hb-auth.d.ts:125

___

### sign

▸ **sign**(`username`, `transactionDigest`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `transactionDigest` | `string` | Transaction digest string |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Signature

**`Description`**

Method that signs given transaction as an authorized user based on selected authority type.

#### Inherited from

Client.sign

#### Defined in

dist/hb-auth.d.ts:193

___

### singleSign

▸ **singleSign**(`username`, `transactionDigest`, `wifKey`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `transactionDigest` | `string` | Transaction digest string |
| `wifKey` | `string` | WIF key |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Signature

**`Description`**

Method that signs given transaction as an authorized user based on selected authority type.

#### Inherited from

Client.singleSign

#### Defined in

dist/hb-auth.d.ts:202

___

### unlock

▸ **unlock**(`username`, `password`): `Promise`\<`void`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `password` | `string` | Password |

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that unlocks existing user's session.
This method will extend user's session time after unlocking.
This is different than authenticate method.

#### Inherited from

Client.unlock

#### Defined in

dist/hb-auth.d.ts:171


<a name="classesonlineclientmd"></a>

# Class: OnlineClient

**`Description`**

Auth client that additionally authorizes
user by verifying user's signature through the network.

## Hierarchy

- `Client`

  ↳ **`OnlineClient`**

## Constructors

### constructor

• **new OnlineClient**(`strict?`, `clientOptions?`): [`OnlineClient`](#classesonlineclientmd)

#### Parameters

| Name | Type |
| :------ | :------ |
| `strict?` | `boolean` |
| `clientOptions?` | `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\> |

#### Returns

[`OnlineClient`](#classesonlineclientmd)

#### Overrides

Client.constructor

#### Defined in

dist/hb-auth.d.ts:221

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

dist/hb-auth.d.ts:84

___

### clientOptions

• `Readonly` **clientOptions**: `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\>

#### Inherited from

Client.clientOptions

#### Defined in

dist/hb-auth.d.ts:86

___

### verify

• `Private` **verify**: `any`

#### Defined in

dist/hb-auth.d.ts:223

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.authenticate

#### Defined in

dist/hb-auth.d.ts:224

___

### authorize

▸ **authorize**(`username`, `txBuilder`, `keyType`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `txBuilder` | `ITransaction` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

dist/hb-auth.d.ts:222

___

### getAuthByUser

▸ **getAuthByUser**(`username`): `Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |

#### Returns

`Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

**`Description`**

Method to get auth status for a given user.
If there is no user it will return null.

#### Inherited from

Client.getAuthByUser

#### Defined in

dist/hb-auth.d.ts:138

___

### getAuths

▸ **getAuths**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

**`Description`**

Method to get all registered users with their active auth status.
If there is no user registered, it will return an empty array.

#### Inherited from

Client.getAuths

#### Defined in

dist/hb-auth.d.ts:131

___

### importKey

▸ **importKey**(`username`, `wifKey`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `wifKey` | `string` | WIF key |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Public Key

**`Description`**

Method that imports a new key for given user
This method requires user to be authenticated or unlocked first

#### Inherited from

Client.importKey

#### Defined in

dist/hb-auth.d.ts:180

___

### initialize

▸ **initialize**(): `Promise`\<[`OnlineClient`](#classesonlineclientmd)\>

#### Returns

`Promise`\<[`OnlineClient`](#classesonlineclientmd)\>

**`Description`**

Async method that prepares client to run.
That method should be called first before calling other methods.

#### Inherited from

Client.initialize

#### Defined in

dist/hb-auth.d.ts:119

___

### lock

▸ **lock**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that locks user session and keeps user session during session time.
Note that when user session time ends, user should authenticate again.

#### Inherited from

Client.lock

#### Defined in

dist/hb-auth.d.ts:163

___

### logout

▸ **logout**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that ends existing user session. This is different than locking user.
When this is called any callback set via

**`See`**

will fire.

#### Inherited from

Client.logout

#### Defined in

dist/hb-auth.d.ts:185

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`, `offline?`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `password` | `string` | Password |
| `wifKey` | `string` | Private key |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` | Key authority type |
| `offline?` | `boolean` | - |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

**`Description`**

Method that registers a new user or adding
another key with different authority to existing user.

#### Inherited from

Client.register

#### Defined in

dist/hb-auth.d.ts:150

___

### setSessionEndCallback

▸ **setSessionEndCallback**(`cb`): `Promise`\<`void`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `cb` | () => `Promise`\<`void`\> | Async callback function that fires on session end |

#### Returns

`Promise`\<`void`\>

**`Description`**

Method to set callback for being notified on session and or logout action.

#### Inherited from

Client.setSessionEndCallback

#### Defined in

dist/hb-auth.d.ts:125

___

### sign

▸ **sign**(`username`, `transactionDigest`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `transactionDigest` | `string` | Transaction digest string |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Signature

**`Description`**

Method that signs given transaction as an authorized user based on selected authority type.

#### Inherited from

Client.sign

#### Defined in

dist/hb-auth.d.ts:193

___

### singleSign

▸ **singleSign**(`username`, `transactionDigest`, `wifKey`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `transactionDigest` | `string` | Transaction digest string |
| `wifKey` | `string` | WIF key |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Signature

**`Description`**

Method that signs given transaction as an authorized user based on selected authority type.

#### Inherited from

Client.singleSign

#### Defined in

dist/hb-auth.d.ts:202

___

### unlock

▸ **unlock**(`username`, `password`): `Promise`\<`void`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `password` | `string` | Password |

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that unlocks existing user's session.
This method will extend user's session time after unlocking.
This is different than authenticate method.

#### Inherited from

Client.unlock

#### Defined in

dist/hb-auth.d.ts:171


<a name="interfacesauthstatusmd"></a>

# Interface: AuthStatus

## Properties

### error

• `Optional` **error**: ``null`` \| [`AuthorizationError`](#classesauthorizationerrormd)

**`Description`**

An error in case of unsuccessful authorization

**`Optional`**

#### Defined in

dist/hb-auth.d.ts:52

___

### ok

• **ok**: `boolean`

**`Description`**

Value that describes auth status

#### Defined in

dist/hb-auth.d.ts:47


<a name="interfacesauthusermd"></a>

# Interface: AuthUser

## Properties

### authorized

• **authorized**: `boolean`

#### Defined in

dist/hb-auth.d.ts:18

___

### loggedInKeyType

• **loggedInKeyType**: `undefined` \| ``"active"`` \| ``"posting"`` \| ``"owner"``

#### Defined in

dist/hb-auth.d.ts:19

___

### registeredKeyTypes

• **registeredKeyTypes**: (``"active"`` \| ``"posting"`` \| ``"owner"``)[]

#### Defined in

dist/hb-auth.d.ts:20

___

### unlocked

• **unlocked**: `boolean`

#### Defined in

dist/hb-auth.d.ts:17

___

### username

• **username**: `string`

#### Defined in

dist/hb-auth.d.ts:16


<a name="interfacesclientoptionsmd"></a>

# Interface: ClientOptions

## Properties

### chainId

• **chainId**: `string`

**`Description`**

Blockchain ID used for calculating digest

**`Default Value`**

`"beeab0de00000000000000000000000000000000000000000000000000000000"`

#### Defined in

dist/hb-auth.d.ts:60

___

### node

• **node**: `string`

**`Description`**

Blockchain Node address for online account verification

**`Default Value`**

`"https://api.hive.blog"`

#### Defined in

dist/hb-auth.d.ts:66

___

### sessionTimeout

• **sessionTimeout**: `number`

**`Description`**

Session timeout (in seconds) for Wallet, after that session will be destroyed and user must authenticate again

**`Default Value`**

`900`

#### Defined in

dist/hb-auth.d.ts:78

___

### workerUrl

• **workerUrl**: `string`

**`Description`**

Url for worker script path provided by hb-auth library

**`Default Value`**

`"/auth/worker.js"`

#### Defined in

dist/hb-auth.d.ts:72

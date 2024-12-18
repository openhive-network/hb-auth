
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

dist/hb-auth.d.ts:241

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

dist/hb-auth.d.ts:102

___

### clientOptions

• `Readonly` **clientOptions**: `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\>

#### Overrides

Client.clientOptions

#### Defined in

dist/hb-auth.d.ts:240

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

dist/hb-auth.d.ts:244

___

### authorize

▸ **authorize**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

dist/hb-auth.d.ts:242

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

dist/hb-auth.d.ts:152

___

### getAuths

▸ **getAuths**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

**`Description`**

Method to get all registered users with their active auth status.
If there is no user registered, it will return an empty array.

**`Deprecated`**

Use

**`See`**

instead.

#### Inherited from

Client.getAuths

#### Defined in

dist/hb-auth.d.ts:145

___

### getRegisteredUsers

▸ **getRegisteredUsers**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

**`Description`**

Method that returns all registered users with their active auth status.

#### Inherited from

Client.getRegisteredUsers

#### Defined in

dist/hb-auth.d.ts:232

___

### getUserSettings

▸ **getUserSettings**(`username`): `Promise`\<``null`` \| `UserSettings`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |

#### Returns

`Promise`\<``null`` \| `UserSettings`\>

#### Inherited from

Client.getUserSettings

#### Defined in

dist/hb-auth.d.ts:153

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

dist/hb-auth.d.ts:201

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

dist/hb-auth.d.ts:132

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

dist/hb-auth.d.ts:184

___

### logout

▸ **logout**(`username`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |

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

dist/hb-auth.d.ts:206

___

### logoutAll

▸ **logoutAll**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that ends all user sessions.

#### Inherited from

Client.logoutAll

#### Defined in

dist/hb-auth.d.ts:210

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`, `strict?`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `wifKey` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |
| `strict?` | `boolean` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.register

#### Defined in

dist/hb-auth.d.ts:243

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

dist/hb-auth.d.ts:138

___

### setUserSettings

▸ **setUserSettings**(`username`, `settings`, `keyType`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `settings` | `Object` |
| `settings.authorizedAccounts?` | `Object` |
| `settings.authorizedAccounts.active` | `undefined` \| `string` |
| `settings.authorizedAccounts.owner` | `undefined` \| `string` |
| `settings.authorizedAccounts.posting` | `undefined` \| `string` |
| `settings.strict` | `boolean` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |

#### Returns

`Promise`\<`void`\>

#### Inherited from

Client.setUserSettings

#### Defined in

dist/hb-auth.d.ts:154

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

dist/hb-auth.d.ts:218

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

dist/hb-auth.d.ts:227

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

dist/hb-auth.d.ts:192


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

• **new OnlineClient**(`clientOptions?`): [`OnlineClient`](#classesonlineclientmd)

#### Parameters

| Name | Type |
| :------ | :------ |
| `clientOptions?` | `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\> |

#### Returns

[`OnlineClient`](#classesonlineclientmd)

#### Overrides

Client.constructor

#### Defined in

dist/hb-auth.d.ts:252

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

dist/hb-auth.d.ts:102

___

### clientOptions

• `Readonly` **clientOptions**: `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\>

#### Overrides

Client.clientOptions

#### Defined in

dist/hb-auth.d.ts:251

___

### verify

• `Private` **verify**: `any`

#### Defined in

dist/hb-auth.d.ts:254

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

dist/hb-auth.d.ts:255

___

### authorize

▸ **authorize**(`username`, `txBuilder`, `keyType`, `isStrict`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `txBuilder` | `ITransaction` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |
| `isStrict` | `boolean` |

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

dist/hb-auth.d.ts:253

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

dist/hb-auth.d.ts:152

___

### getAuths

▸ **getAuths**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

**`Description`**

Method to get all registered users with their active auth status.
If there is no user registered, it will return an empty array.

**`Deprecated`**

Use

**`See`**

instead.

#### Inherited from

Client.getAuths

#### Defined in

dist/hb-auth.d.ts:145

___

### getRegisteredUsers

▸ **getRegisteredUsers**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

**`Description`**

Method that returns all registered users with their active auth status.

#### Inherited from

Client.getRegisteredUsers

#### Defined in

dist/hb-auth.d.ts:232

___

### getUserSettings

▸ **getUserSettings**(`username`): `Promise`\<``null`` \| `UserSettings`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |

#### Returns

`Promise`\<``null`` \| `UserSettings`\>

#### Inherited from

Client.getUserSettings

#### Defined in

dist/hb-auth.d.ts:153

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

dist/hb-auth.d.ts:201

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

dist/hb-auth.d.ts:132

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

dist/hb-auth.d.ts:184

___

### logout

▸ **logout**(`username`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |

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

dist/hb-auth.d.ts:206

___

### logoutAll

▸ **logoutAll**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that ends all user sessions.

#### Inherited from

Client.logoutAll

#### Defined in

dist/hb-auth.d.ts:210

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`, `strict?`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `wifKey` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |
| `strict?` | `boolean` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.register

#### Defined in

dist/hb-auth.d.ts:256

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

dist/hb-auth.d.ts:138

___

### setUserSettings

▸ **setUserSettings**(`username`, `settings`, `keyType`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `settings` | `Object` |
| `settings.authorizedAccounts?` | `Object` |
| `settings.authorizedAccounts.active` | `undefined` \| `string` |
| `settings.authorizedAccounts.owner` | `undefined` \| `string` |
| `settings.authorizedAccounts.posting` | `undefined` \| `string` |
| `settings.strict` | `boolean` |
| `keyType` | ``"active"`` \| ``"posting"`` \| ``"owner"`` |

#### Returns

`Promise`\<`void`\>

#### Inherited from

Client.setUserSettings

#### Defined in

dist/hb-auth.d.ts:154

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

dist/hb-auth.d.ts:218

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

dist/hb-auth.d.ts:227

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

dist/hb-auth.d.ts:192


<a name="interfacesauthstatusmd"></a>

# Interface: AuthStatus

## Properties

### error

• `Optional` **error**: ``null`` \| [`AuthorizationError`](#classesauthorizationerrormd)

**`Description`**

An error in case of unsuccessful authorization

**`Optional`**

#### Defined in

dist/hb-auth.d.ts:70

___

### ok

• **ok**: `boolean`

**`Description`**

Value that describes auth status

#### Defined in

dist/hb-auth.d.ts:65


<a name="interfacesauthusermd"></a>

# Interface: AuthUser

## Properties

### authorized

• **authorized**: `boolean`

#### Defined in

dist/hb-auth.d.ts:27

___

### loggedInKeyType

• **loggedInKeyType**: `undefined` \| ``"active"`` \| ``"posting"`` \| ``"owner"``

#### Defined in

dist/hb-auth.d.ts:28

___

### registeredKeyTypes

• **registeredKeyTypes**: (``"active"`` \| ``"posting"`` \| ``"owner"``)[]

#### Defined in

dist/hb-auth.d.ts:29

___

### unlocked

• **unlocked**: `boolean`

#### Defined in

dist/hb-auth.d.ts:26

___

### username

• **username**: `string`

#### Defined in

dist/hb-auth.d.ts:25


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

dist/hb-auth.d.ts:78

___

### node

• **node**: `string`

**`Description`**

Blockchain Node address for online account verification

**`Default Value`**

`"https://api.hive.blog"`

#### Defined in

dist/hb-auth.d.ts:84

___

### sessionTimeout

• **sessionTimeout**: `number`

**`Description`**

Session timeout (in seconds) for Wallet, after that session will be destroyed and user must authenticate again

**`Default Value`**

`900`

#### Defined in

dist/hb-auth.d.ts:96

___

### workerUrl

• **workerUrl**: `string`

**`Description`**

Url for worker script path provided by hb-auth library

**`Default Value`**

`"/auth/worker.js"`

#### Defined in

dist/hb-auth.d.ts:90

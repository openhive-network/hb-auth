
<a name="_modulesmd"></a>

# @hive/hb-auth

## Classes

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

hb-auth.d.ts:14

## Variables

### isBrowser

• `Const` **isBrowser**: `boolean`

#### Defined in

hb-auth.d.ts:4

___

### isSupportSharedWorker

• `Const` **isSupportSharedWorker**: `boolean`

#### Defined in

hb-auth.d.ts:6

___

### isSupportWebWorker

• `Const` **isSupportWebWorker**: `boolean`

#### Defined in

hb-auth.d.ts:5


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

hb-auth.d.ts:201

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:83

___

### clientOptions

• `Readonly` **clientOptions**: `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\>

#### Overrides

Client.clientOptions

#### Defined in

hb-auth.d.ts:200

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.authenticate

#### Defined in

hb-auth.d.ts:204

___

### authorize

▸ **authorize**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

hb-auth.d.ts:202

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

hb-auth.d.ts:137

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

hb-auth.d.ts:130

___

### importKey

▸ **importKey**(`username`, `wifKey`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `wifKey` | `string` | WIF key |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Public Key

**`Description`**

Method that imports a new key for given user
This method requires user to be authenticated or unlocked first

#### Inherited from

Client.importKey

#### Defined in

hb-auth.d.ts:179

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

hb-auth.d.ts:118

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

hb-auth.d.ts:162

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

hb-auth.d.ts:184

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `wifKey` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.register

#### Defined in

hb-auth.d.ts:203

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

hb-auth.d.ts:124

___

### sign

▸ **sign**(`username`, `transactionDigest`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `transactionDigest` | `string` | Transaction digest string |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Signature

**`Description`**

Method that signs given transaction as an authorized user based on selected authority type.

#### Inherited from

Client.sign

#### Defined in

hb-auth.d.ts:192

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

hb-auth.d.ts:170


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

• **new OnlineClient**(`strict`, `clientOptions?`): [`OnlineClient`](#classesonlineclientmd)

#### Parameters

| Name | Type |
| :------ | :------ |
| `strict` | `boolean` |
| `clientOptions?` | `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\> |

#### Returns

[`OnlineClient`](#classesonlineclientmd)

**`Description`**

Additional options for auth client

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:107

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:83

___

### clientOptions

• `Readonly` **clientOptions**: `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\>

#### Inherited from

Client.clientOptions

#### Defined in

hb-auth.d.ts:85

___

### verify

• `Private` **verify**: `any`

#### Defined in

hb-auth.d.ts:212

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.authenticate

#### Defined in

hb-auth.d.ts:214

___

### authorize

▸ **authorize**(`username`, `txBuilder`, `keyType`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `txBuilder` | `ITransactionBuilder` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

hb-auth.d.ts:211

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

hb-auth.d.ts:137

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

hb-auth.d.ts:130

___

### importKey

▸ **importKey**(`username`, `wifKey`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `wifKey` | `string` | WIF key |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Public Key

**`Description`**

Method that imports a new key for given user
This method requires user to be authenticated or unlocked first

#### Inherited from

Client.importKey

#### Defined in

hb-auth.d.ts:179

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

hb-auth.d.ts:118

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

hb-auth.d.ts:162

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

hb-auth.d.ts:184

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `wifKey` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Overrides

Client.register

#### Defined in

hb-auth.d.ts:213

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

hb-auth.d.ts:124

___

### sign

▸ **sign**(`username`, `transactionDigest`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `transactionDigest` | `string` | Transaction digest string |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<`string`\>

Signature

**`Description`**

Method that signs given transaction as an authorized user based on selected authority type.

#### Inherited from

Client.sign

#### Defined in

hb-auth.d.ts:192

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

hb-auth.d.ts:170


<a name="interfacesauthstatusmd"></a>

# Interface: AuthStatus

## Properties

### error

• `Optional` **error**: ``null`` \| `AuthorizationError`

**`Description`**

An error in case of unsuccessful authorization

**`Optional`**

#### Defined in

hb-auth.d.ts:51

___

### ok

• **ok**: `boolean`

**`Description`**

Value that describes auth status

#### Defined in

hb-auth.d.ts:46


<a name="interfacesauthusermd"></a>

# Interface: AuthUser

## Properties

### authorized

• **authorized**: `boolean`

#### Defined in

hb-auth.d.ts:18

___

### loggedInKeyType

• **loggedInKeyType**: `undefined` \| ``"active"`` \| ``"posting"``

#### Defined in

hb-auth.d.ts:19

___

### registeredKeyTypes

• **registeredKeyTypes**: (``"active"`` \| ``"posting"``)[]

#### Defined in

hb-auth.d.ts:20

___

### unlocked

• **unlocked**: `boolean`

#### Defined in

hb-auth.d.ts:17

___

### username

• **username**: `string`

#### Defined in

hb-auth.d.ts:16


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

hb-auth.d.ts:59

___

### node

• **node**: `string`

**`Description`**

Blockchain Node address for online account verification

**`Default Value`**

`"https://api.hive.blog"`

#### Defined in

hb-auth.d.ts:65

___

### sessionTimeout

• **sessionTimeout**: `number`

**`Description`**

Session timeout (in seconds) for Wallet, after that session will be destroyed and user must authenticate again

**`Default Value`**

`900`

#### Defined in

hb-auth.d.ts:77

___

### workerUrl

• **workerUrl**: `string`

**`Description`**

Url for worker script path provided by hb-auth library

**`Default Value`**

`"/auth/worker.js"`

#### Defined in

hb-auth.d.ts:71

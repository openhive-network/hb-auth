
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

hb-auth.d.ts:13

## Variables

### isBrowser

• `Const` **isBrowser**: `boolean`

#### Defined in

hb-auth.d.ts:3

___

### isSupportSharedWorker

• `Const` **isSupportSharedWorker**: `boolean`

#### Defined in

hb-auth.d.ts:5

___

### isSupportWebWorker

• `Const` **isSupportWebWorker**: `boolean`

#### Defined in

hb-auth.d.ts:4


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

**`Description`**

Additional options for auth client

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:85

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:69

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `password` | `string` | Password |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

**`Description`**

Method that authenticates an already registered user.

#### Inherited from

Client.authenticate

#### Defined in

hb-auth.d.ts:135

___

### authorize

▸ **authorize**(`username`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

hb-auth.d.ts:156

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

hb-auth.d.ts:115

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

hb-auth.d.ts:108

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

hb-auth.d.ts:96

___

### logout

▸ **logout**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that ends existing user session.
When this is called any callback set via

**`See`**

will fire.

#### Inherited from

Client.logout

#### Defined in

hb-auth.d.ts:140

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `password` | `string` | Password |
| `wifKey` | `string` | Private key |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

**`Description`**

Method that registers a new user or adding
another key with different authority to existing user.

#### Inherited from

Client.register

#### Defined in

hb-auth.d.ts:127

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

hb-auth.d.ts:102

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

hb-auth.d.ts:148


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

**`Description`**

Additional options for auth client

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:85

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:69

___

### verify

• `Private` **verify**: `any`

#### Defined in

hb-auth.d.ts:164

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `password` | `string` | Password |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

**`Description`**

Method that authenticates an already registered user.

#### Inherited from

Client.authenticate

#### Defined in

hb-auth.d.ts:135

___

### authorize

▸ **authorize**(`username`, `digest`, `signature`, `keyType`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `digest` | `string` |
| `signature` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<`boolean`\>

#### Overrides

Client.authorize

#### Defined in

hb-auth.d.ts:163

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

hb-auth.d.ts:115

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

hb-auth.d.ts:108

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

hb-auth.d.ts:96

___

### logout

▸ **logout**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

**`Description`**

Method that ends existing user session.
When this is called any callback set via

**`See`**

will fire.

#### Inherited from

Client.logout

#### Defined in

hb-auth.d.ts:140

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`): `Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |
| `password` | `string` | Password |
| `wifKey` | `string` | Private key |
| `keyType` | ``"active"`` \| ``"posting"`` | Key authority type |

#### Returns

`Promise`\<[`AuthStatus`](#interfacesauthstatusmd)\>

**`Description`**

Method that registers a new user or adding
another key with different authority to existing user.

#### Inherited from

Client.register

#### Defined in

hb-auth.d.ts:127

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

hb-auth.d.ts:102

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

hb-auth.d.ts:148


<a name="interfacesauthstatusmd"></a>

# Interface: AuthStatus

## Properties

### error

• `Optional` **error**: ``null`` \| `AuthorizationError`

**`Description`**

An error in case of unsuccessful authorization

**`Optional`**

#### Defined in

hb-auth.d.ts:43

___

### ok

• **ok**: `boolean`

**`Description`**

Value that describes auth status

#### Defined in

hb-auth.d.ts:38


<a name="interfacesauthusermd"></a>

# Interface: AuthUser

## Properties

### authorized

• **authorized**: `boolean`

#### Defined in

hb-auth.d.ts:16

___

### keyType

• **keyType**: `undefined` \| ``"active"`` \| ``"posting"``

#### Defined in

hb-auth.d.ts:17

___

### username

• **username**: `string`

#### Defined in

hb-auth.d.ts:15


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

hb-auth.d.ts:51

___

### node

• **node**: `string`

**`Description`**

Blockchain Node address for online account verification

**`Default Value`**

`"https://api.hive.blog"`

#### Defined in

hb-auth.d.ts:57

___

### workerUrl

• **workerUrl**: `string`

**`Description`**

Url for worker script path provided by hb-auth library

**`Default Value`**

`"/auth/worker.js"`

#### Defined in

hb-auth.d.ts:63

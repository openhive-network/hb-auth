
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

• **new OfflineClient**(`strict`, `clientOptions?`): [`OfflineClient`](#classesofflineclientmd)

#### Parameters

| Name | Type |
| :------ | :------ |
| `strict` | `boolean` |
| `clientOptions?` | `Partial`\<[`ClientOptions`](#interfacesclientoptionsmd)\> |

#### Returns

[`OfflineClient`](#classesofflineclientmd)

**`Description`**

Additional options for auth client

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:92

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:70

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

hb-auth.d.ts:165

___

### authorize

▸ **authorize**(): `Promise`\<`boolean`\>

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

hb-auth.d.ts:122

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

hb-auth.d.ts:115

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

hb-auth.d.ts:103

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

hb-auth.d.ts:147

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

hb-auth.d.ts:164

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

hb-auth.d.ts:109

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

hb-auth.d.ts:155


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

hb-auth.d.ts:92

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:70

___

### verify

• `Private` **verify**: `any`

#### Defined in

hb-auth.d.ts:173

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

hb-auth.d.ts:175

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

hb-auth.d.ts:172

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

hb-auth.d.ts:122

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

hb-auth.d.ts:115

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

hb-auth.d.ts:103

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

hb-auth.d.ts:147

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

hb-auth.d.ts:174

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

hb-auth.d.ts:109

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

hb-auth.d.ts:155


<a name="interfacesauthstatusmd"></a>

# Interface: AuthStatus

## Properties

### error

• `Optional` **error**: ``null`` \| `AuthorizationError`

**`Description`**

An error in case of unsuccessful authorization

**`Optional`**

#### Defined in

hb-auth.d.ts:44

___

### ok

• **ok**: `boolean`

**`Description`**

Value that describes auth status

#### Defined in

hb-auth.d.ts:39


<a name="interfacesauthusermd"></a>

# Interface: AuthUser

## Properties

### authorized

• **authorized**: `boolean`

#### Defined in

hb-auth.d.ts:17

___

### keyType

• **keyType**: `undefined` \| ``"active"`` \| ``"posting"``

#### Defined in

hb-auth.d.ts:18

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

hb-auth.d.ts:52

___

### node

• **node**: `string`

**`Description`**

Blockchain Node address for online account verification

**`Default Value`**

`"https://api.hive.blog"`

#### Defined in

hb-auth.d.ts:58

___

### workerUrl

• **workerUrl**: `string`

**`Description`**

Url for worker script path provided by hb-auth library

**`Default Value`**

`"/auth/worker.js"`

#### Defined in

hb-auth.d.ts:64

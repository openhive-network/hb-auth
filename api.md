
<a name="readmemd"></a>




<a name="_modulesmd"></a>

# @hive/hb-auth

## Classes

- [OfflineClient](#classesofflineclientmd)
- [OnlineClient](#classesonlineclientmd)

## Interfaces

- [AuthStatus](#interfacesauthstatusmd)
- [ClientOptions](#interfacesclientoptionsmd)

## Variables

### isBrowser

• `Const` **isBrowser**: `boolean`

#### Defined in

hb-auth.d.ts:3

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
| `clientOptions?` | [`ClientOptions`](#interfacesclientoptionsmd) |

#### Returns

[`OfflineClient`](#classesofflineclientmd)

**`Description`**

Additional options for auth client

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:77

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:61

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

hb-auth.d.ts:126

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

hb-auth.d.ts:147

___

### getAuthByUser

▸ **getAuthByUser**(`username`): `Promise`\<``null`` \| `AuthUser`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |

#### Returns

`Promise`\<``null`` \| `AuthUser`\>

**`Description`**

Method to get auth status for a given user.
If there is no user it will return null.

#### Inherited from

Client.getAuthByUser

#### Defined in

hb-auth.d.ts:106

___

### getAuths

▸ **getAuths**(): `Promise`\<`AuthUser`[]\>

#### Returns

`Promise`\<`AuthUser`[]\>

**`Description`**

Method to get all registered users with their active auth status.
If there is no user registered, it will return an empty array.

#### Inherited from

Client.getAuths

#### Defined in

hb-auth.d.ts:99

___

### initialize

▸ **initialize**(): `Promise`\<`Client`\>

#### Returns

`Promise`\<`Client`\>

**`Description`**

Async method that prepares client to run.
That method should be called first before calling other methods.

#### Inherited from

Client.initialize

#### Defined in

hb-auth.d.ts:87

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

hb-auth.d.ts:131

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

hb-auth.d.ts:118

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

hb-auth.d.ts:93

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

hb-auth.d.ts:139


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
| `clientOptions?` | [`ClientOptions`](#interfacesclientoptionsmd) |

#### Returns

[`OnlineClient`](#classesonlineclientmd)

**`Description`**

Additional options for auth client

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:77

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:61

___

### verify

• `Private` **verify**: `any`

#### Defined in

hb-auth.d.ts:155

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

hb-auth.d.ts:126

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

hb-auth.d.ts:154

___

### getAuthByUser

▸ **getAuthByUser**(`username`): `Promise`\<``null`` \| `AuthUser`\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `username` | `string` | Username |

#### Returns

`Promise`\<``null`` \| `AuthUser`\>

**`Description`**

Method to get auth status for a given user.
If there is no user it will return null.

#### Inherited from

Client.getAuthByUser

#### Defined in

hb-auth.d.ts:106

___

### getAuths

▸ **getAuths**(): `Promise`\<`AuthUser`[]\>

#### Returns

`Promise`\<`AuthUser`[]\>

**`Description`**

Method to get all registered users with their active auth status.
If there is no user registered, it will return an empty array.

#### Inherited from

Client.getAuths

#### Defined in

hb-auth.d.ts:99

___

### initialize

▸ **initialize**(): `Promise`\<`Client`\>

#### Returns

`Promise`\<`Client`\>

**`Description`**

Async method that prepares client to run.
That method should be called first before calling other methods.

#### Inherited from

Client.initialize

#### Defined in

hb-auth.d.ts:87

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

hb-auth.d.ts:131

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

hb-auth.d.ts:118

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

hb-auth.d.ts:93

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

hb-auth.d.ts:139


<a name="interfacesauthstatusmd"></a>

# Interface: AuthStatus

## Properties

### error

• `Optional` **error**: ``null`` \| `AuthorizationError`

**`Description`**

An error in case of unsuccessful authorization

**`Optional`**

#### Defined in

hb-auth.d.ts:41

___

### ok

• **ok**: `boolean`

**`Description`**

Value that describes auth status

#### Defined in

hb-auth.d.ts:36


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

hb-auth.d.ts:49

___

### node

• **node**: `string`

**`Description`**

Blockchain Node address for online account verification

**`Default Value`**

`"https://api.hive.blog"`

#### Defined in

hb-auth.d.ts:55

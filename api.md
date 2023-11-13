
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

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:79

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:63

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<\{ `ok`: `boolean`  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<\{ `ok`: `boolean`  }\>

#### Inherited from

Client.authenticate

#### Defined in

hb-auth.d.ts:129

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

hb-auth.d.ts:150

___

### getAuthByUser

▸ **getAuthByUser**(`username`): `Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |

#### Returns

`Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

#### Inherited from

Client.getAuthByUser

#### Defined in

hb-auth.d.ts:109

___

### getAuths

▸ **getAuths**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Inherited from

Client.getAuths

#### Defined in

hb-auth.d.ts:102

___

### initialize

▸ **initialize**(): `Promise`\<[`OfflineClient`](#classesofflineclientmd)\>

#### Returns

`Promise`\<[`OfflineClient`](#classesofflineclientmd)\>

#### Inherited from

Client.initialize

#### Defined in

hb-auth.d.ts:90

___

### logout

▸ **logout**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Inherited from

Client.logout

#### Defined in

hb-auth.d.ts:134

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`): `Promise`\<\{ `ok`: `boolean`  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `wifKey` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<\{ `ok`: `boolean`  }\>

#### Inherited from

Client.register

#### Defined in

hb-auth.d.ts:121

___

### setSessionEndCallback

▸ **setSessionEndCallback**(`cb`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `cb` | () => `Promise`\<`void`\> |

#### Returns

`Promise`\<`void`\>

#### Inherited from

Client.setSessionEndCallback

#### Defined in

hb-auth.d.ts:96

___

### sign

▸ **sign**(`username`, `transactionDigest`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `transactionDigest` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<`string`\>

#### Inherited from

Client.sign

#### Defined in

hb-auth.d.ts:142


<a name="classesonlineclientmd"></a>

# Class: OnlineClient

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

#### Inherited from

Client.constructor

#### Defined in

hb-auth.d.ts:79

## Properties

### #private

• `Private` **#private**: `any`

#### Inherited from

Client.#private

#### Defined in

hb-auth.d.ts:63

___

### verify

• `Private` **verify**: `any`

#### Defined in

hb-auth.d.ts:158

## Methods

### authenticate

▸ **authenticate**(`username`, `password`, `keyType`): `Promise`\<\{ `ok`: `boolean`  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<\{ `ok`: `boolean`  }\>

#### Inherited from

Client.authenticate

#### Defined in

hb-auth.d.ts:129

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

hb-auth.d.ts:157

___

### getAuthByUser

▸ **getAuthByUser**(`username`): `Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |

#### Returns

`Promise`\<``null`` \| [`AuthUser`](#interfacesauthusermd)\>

#### Inherited from

Client.getAuthByUser

#### Defined in

hb-auth.d.ts:109

___

### getAuths

▸ **getAuths**(): `Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Returns

`Promise`\<[`AuthUser`](#interfacesauthusermd)[]\>

#### Inherited from

Client.getAuths

#### Defined in

hb-auth.d.ts:102

___

### initialize

▸ **initialize**(): `Promise`\<[`OnlineClient`](#classesonlineclientmd)\>

#### Returns

`Promise`\<[`OnlineClient`](#classesonlineclientmd)\>

#### Inherited from

Client.initialize

#### Defined in

hb-auth.d.ts:90

___

### logout

▸ **logout**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Inherited from

Client.logout

#### Defined in

hb-auth.d.ts:134

___

### register

▸ **register**(`username`, `password`, `wifKey`, `keyType`): `Promise`\<\{ `ok`: `boolean`  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `password` | `string` |
| `wifKey` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<\{ `ok`: `boolean`  }\>

#### Inherited from

Client.register

#### Defined in

hb-auth.d.ts:121

___

### setSessionEndCallback

▸ **setSessionEndCallback**(`cb`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `cb` | () => `Promise`\<`void`\> |

#### Returns

`Promise`\<`void`\>

#### Inherited from

Client.setSessionEndCallback

#### Defined in

hb-auth.d.ts:96

___

### sign

▸ **sign**(`username`, `transactionDigest`, `keyType`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `username` | `string` |
| `transactionDigest` | `string` |
| `keyType` | ``"active"`` \| ``"posting"`` |

#### Returns

`Promise`\<`string`\>

#### Inherited from

Client.sign

#### Defined in

hb-auth.d.ts:142


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

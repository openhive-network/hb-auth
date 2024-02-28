## @hive/hb-auth

**hb-auth** is an authorization library for Hive blockchain users. The biggest goal of **hb-auth** library is making operations easier that require signing by users while keeping user's keys secure. Most important and underlying system of this library is [Hive Beekeeper](https://gitlab.syncad.com/hive/hive/-/tree/develop/programs/beekeeper/beekeeper_wasm?ref_type=heads). **hb-auth** provides a minimal API that allows you seamless user authorization for your web application that interacts with Hive Blockchain.

### How to use?

**hb-auth** is written in TypeScript, so out of the box it gives you clear API spec. 

### [Important!] Having worker file configured

This is a crucial step for having **hb-auth** work since it is based on WebWorkers. There is a file called `worker.js` in `@hive/hb-auth` package. It should be copied in your `public` folder where you serve your application. And path from your `public` folder should be defined in client options while creating new instance as below. Default value is `/auth/worker.js`

```
new OnlineClient(false, { workerUrl: "/your/path/to/worker.js" })
// or
new OfflineClient({ workerUrl: "/your/path/to/worker.js" })
```

#### Example usage

As a an example you can check `example` in this project. This is an application that demonstrates user flow (register, login and logout).

To run example project do following:

First you should install packages and build **hb-auth** locally. **hb-auth** uses [pnpm](https://pnpm.io/). Run following commands in root folder of this repository:

```
pnpm install
pnpm run build
```

After having **hb-auth** freshly build, build and run `example` project.

```
cd example
pnpm install
pnpm start
```

#### Install for your web application

To use **hb-auth** you can install it with you favorite node package manager. 

*Because **@hive/hb-auth** is in experimental version, it is only published to Hive Gitlab. Soon it will be available on global npm package registry.*

So, to access that library, add `.npmrc` file on you project's root with following code:

`@hive:registry=https://gitlab.syncad.com/api/v4/packages/npm/`

After having `.npmrc` file added, you can install package:

`npm install @hive/hb-auth@stable`

#### API Documentation

[Check API documention](api.md)
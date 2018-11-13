[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](./LICENSE)
[![style](https://img.shields.io/badge/style-eslint-green.svg?style=flat-square)](./.eslintrc.json)

## Overview

The Parsec web client allows you to connect to a Parsec host via Chrome 69+. It is written in vanilla ES2018 and has no development or runtime dependencies.

## Usage

```js
import {Client} from './client.js';

const client = new Client(videoElement);

client.connect(sessionId, serverId, {
    encoder_bitrate: 15,
    server_resolution_x: 1366,
    server_resolution_y: 768,
    ...
});
```

The constructor takes an HTML5 `<video>` element and can take an optional second callback argument that can receive events such as `connect`, `exit`,  and `shutter`. The `connect` method's third argument is the usual Parsec configuration file in JSON format.

For a more detailed example, check out the [example](./example) directory.

## Development

You'll need [Node.js](https://nodejs.org) to run the development server. This project was tested with `node 8.12.0 LTS`.

```bash
git clone https://github.com/parsec-cloud/web-client.git
cd web-client
npm start
```

The development server will be running on port 443, and should be accessed via `https://devlocal.info`. The web client must run on a secure origin or it will fail the origin check on the Parsec signal server.

## Contributing

Please make sure `eslint` is not throwing any errors before submitting a PR. You can run `eslint` with `--fix` to automatically clean up the style.

```bash
npm install -g eslint
eslint web-client/src/*
```

We hope to see your username on our [list of contributors](https://github.com/parsec-cloud/web-client/graphs/contributors) soon! 🎉🎉🎉

## Bugs & Known Issues

- The audio may crackle when using macOS. We will be switching to [MSE for Opus](https://www.chromestatus.com/feature/5100845653819392) with the release of Chrome 70.

## Resources

- 🌐 [The Parsec Website](https://parsecgaming.com)
- 💬 [The Parsec Discord](https://discord.gg/sfVWCzy)
- ✍ [The Parsec Blog](https://medium.com/@ParsecTeam)

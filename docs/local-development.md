# Apophis SDK Local Development
When developing the SDK locally, you will most likely test a combination of multiple packages. Writing automated tests for Apophis is not straightforward, as it is has to integrate with browser extensions and other inaccessible technologies. Thus, I recommend publishing the SDK to a local registry and installing it from there.

## Working with a Local Registry
You can set up a local registry with [Verdaccio](https://verdaccio.dev/). The easiest way is to create a docker container:

```bash
docker run --rm -p 4873:4873 --name local-npm verdaccio/verdaccio
```

Then, you must create a new user:

```bash
npm adduser --registry http://localhost:4873
```

Finally, you can publish a package to the local registry with the following command:

```bash
npm publish --registry http://localhost:4873
```

In a new project, you can then install the package from the local registry:

```bash
npm install @apophis-sdk/core @apophis-sdk/preact @apophis-sdk/keplr-signer --registry http://localhost:4873
```

## Development Scripts
I've written a couple of scripts to make working with a monorepo easier:

- `vertool.sh` helps manage the version of the packages. It takes the version from the root's `package.json`, edits it, and propagates it to all the packages.
- `localreg.sh` starts a local registry. You will then need to create a new user as described above.
- `publish.sh` publishes the packages. You may edit it to publish to the local registry instead.

These scripts are written for bash. If you're using zsh, you may need to modify them slightly. If you're running Windows, you'd best use WSL2.

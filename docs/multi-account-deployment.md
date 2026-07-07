# Multi-account Deployment Guide

This branch vendors a patched ZeroUI into `zerotier-planet-builder` and builds it into the final image. It no longer copies `/app` from `dec0dos/zero-ui:latest`.

## What changes after upgrade

- The `USERNAME` / `PASSWORD` configured in GitHub Actions or `init.sh` becomes the administrator account.
- Existing networks in `/app/backend/data/db.json` are migrated to the administrator on first startup.
- Friends cannot register openly. The administrator generates a one-time invite code, and the friend registers with that code.
- Normal users only see and manage networks they created.
- The web UI shows the planet download/subscription link before and after login.

## Preserve these paths

Keep the same mounted data paths across upgrades:

```sh
-v /data/zerotier:/var/lib/zerotier-one/controller.d
-v /data/zero-ui:/app/backend/data
```

`/data/zerotier` preserves the controller identity and planet-related state. `/data/zero-ui` preserves users, invite codes, network metadata, names, descriptions, and owner assignments.

## Build with GitHub Actions

Use the existing workflow after pushing this branch to your fork:

1. Set or keep repository secrets:
   - `IP`: `<YOUR_SERVER_IP_OR_DOMAIN>`
   - `USERNAME`: administrator username
   - `PASSWORD`: administrator password and artifact password
2. Run the `zerotier-planet-builder` workflow.
3. Download `zerotier-planet.tar.gz.7z`.
4. Extract it with `PASSWORD` to get `zerotier-planet.tar.gz`.

## Build on the server

If Docker Hub is reachable from the server:

```sh
git clone <your-fork-url> zerotier-planet-builder
cd zerotier-planet-builder
git checkout codex/zerotier-multi-account
sed -i "s/1.1.1.1/<YOUR_SERVER_IP_OR_DOMAIN>/g" ./patch/patch.json
docker build . --file Dockerfile --tag zerotier-planet:multi-account
```

If Docker Hub is not reachable but you have a trusted registry mirror for the Node image, override the base image:

```sh
docker build . \
  --file Dockerfile \
  --tag zerotier-planet:multi-account \
  --build-arg NODE_IMAGE=<trusted-registry-mirror>/library/node:lts-bullseye-slim
```

If Debian package downloads are also slow, pass a trusted Debian mirror:

```sh
docker build . \
  --file Dockerfile \
  --tag zerotier-planet:multi-account \
  --build-arg NODE_IMAGE=<trusted-registry-mirror>/library/node:lts-bullseye-slim \
  --build-arg APT_MIRROR=http://mirrors.aliyun.com/debian
```

On small servers, keep the default `ZEROTIER_MAKE_JOBS=1`. On larger builders you can pass a higher value to compile ZeroTier faster.

The Dockerfile defaults `ZEROTIER_ONE_REF` to `1.14.2` because newer ZeroTierOne sources removed the `attic/world` planet build tool this project patches. It builds the ZeroTier binaries from that source archive, so the image build does not depend on `download.zerotier.com` apt packages. Override the ref only with a version you have verified still contains `attic/world/mkworld.cpp`.

If no registry can pull `node:lts-bullseye-slim`, build with GitHub Actions or another network that can pull it, then transfer the saved image to the server.

## Upgrade the running container

Back up current data first:

```sh
mkdir -p /data/backup
docker cp zerotier-server:/var/lib/zerotier-one /data/backup/zerotier-one-before-multi-account
cp -a /data/zero-ui /data/backup/zero-ui-before-multi-account
```

Load or use the new image:

```sh
docker image load < zerotier-planet.tar.gz
```

Replace the container while keeping the same mounts:

```sh
docker stop zerotier-server
docker rename zerotier-server zerotier-server-before-multi-account

docker run -d \
  --name zerotier-server \
  -p 4000:4000 \
  -p 9993:9993/udp \
  -v /data/zerotier:/var/lib/zerotier-one/controller.d \
  -v /data/zero-ui:/app/backend/data \
  zerotier-planet
```

Open:

```text
http://<YOUR_SERVER_IP_OR_DOMAIN>:4000/app
```

If your deployment is exposed on a different external port, use that port.

## First login and invite flow

1. Log in with the administrator `USERNAME` / `PASSWORD`.
2. On the logged-in home page, copy the planet link shown by the UI.
3. Click `Generate invite`.
4. Copy the one-time invite code and send it to a friend.
5. The friend opens the app, switches to `Register`, enters username, password, and invite code.
6. After registration, the friend can create a network and manage members/routes inside that network only.

## API fallback for creating invites

If the UI is unavailable but the backend is running:

```sh
TOKEN=$(curl -s http://<YOUR_SERVER_IP_OR_DOMAIN>:4000/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"ADMIN_USERNAME","password":"ADMIN_PASSWORD"}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

curl -s http://<YOUR_SERVER_IP_OR_DOMAIN>:4000/auth/invites \
  -H "Authorization: token $TOKEN" \
  -X POST
```

The response contains the invite `code`.

## Verification checklist

- Logged-out home page shows a planet link ending in `/app/planet`.
- Admin can log in.
- Admin can generate an invite code.
- A friend can register only with a valid unused invite code.
- The same invite code cannot be reused.
- Friend A creates a network.
- Friend B does not see Friend A's network.
- Friend A can authorize devices and edit managed routes in Friend A's network.
- Existing pre-upgrade networks are visible to the administrator.

## Rollback

If the upgraded container fails:

```sh
docker stop zerotier-server
docker rm zerotier-server
docker rename zerotier-server-before-multi-account zerotier-server
docker start zerotier-server
```

If you need to restore data too:

```sh
rm -rf /data/zero-ui
cp -a /data/backup/zero-ui-before-multi-account /data/zero-ui
```

Do not delete `/data/zerotier` unless you intentionally want a new controller identity.

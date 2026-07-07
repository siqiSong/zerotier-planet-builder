#!/usr/bin/env sh

if  [ -z "$ZT_PORT"  ]
then export ZT_PORT=9993
fi

if  [ -z "$API_PORT"  ]
then export API_PORT=4000
fi

if  [ -z "$PORT"  ]
then export PORT="$API_PORT"
fi

if  [ -z "$HTTP_PORT"  ]
then export HTTP_PORT="$API_PORT"
fi

if  [ -z "$HTTP_ALL_INTERFACES"  ]
then export HTTP_ALL_INTERFACES=true
fi

if  [ -z "$ZT_ADDR"  ]
then export ZT_ADDR="http://localhost:${ZT_PORT}"
fi

cp /var/lib/zerotier-one/planet /app/frontend/build/planet
echo Run zerotier...
zerotier-one -p$ZT_PORT -d
echo Waiting for controller API...
for i in $(seq 1 30); do
  if node -e '
    const fs = require("node:fs");
    const token = fs.readFileSync("/var/lib/zerotier-one/authtoken.secret", "utf8").trim();
    fetch(process.env.ZT_ADDR + "/status", {
      headers: { "X-ZT1-Auth": token },
      signal: AbortSignal.timeout(1000)
    }).then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1));
  '; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Controller API did not become ready at ${ZT_ADDR}" >&2
    exit 1
  fi
  sleep 1
done
cd /app/ztncui/src
echo Run ztncui...
node ./bin/www

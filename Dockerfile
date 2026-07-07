ARG NODE_IMAGE=node:lts-bullseye-slim

FROM ${NODE_IMAGE} AS build-planet
LABEL stage=tmp

ARG APT_MIRROR=
ARG ZEROTIER_ONE_REF=1.14.2
ARG ZEROTIER_MAKE_JOBS=1
RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i "s|http://deb.debian.org/debian|$APT_MIRROR|g; s|http://security.debian.org/debian-security|$APT_MIRROR-security|g" /etc/apt/sources.list; \
    fi
RUN echo "download tools and code..." && \
    apt-get -qq update && \
    apt-get -qq -y install git python3 make curl wget g++ gnupg libssl-dev
RUN mkdir -p /usr/include/nlohmann/ && \
    cd /usr/include/nlohmann/ && \
    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors \
      https://raw.githubusercontent.com/nlohmann/json/v3.10.5/single_include/nlohmann/json.hpp \
      -o json.hpp
RUN cd /opt && \
    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors \
      "https://codeload.github.com/zerotier/ZeroTierOne/tar.gz/refs/tags/${ZEROTIER_ONE_REF}" \
      -o /tmp/zerotier-one.tar.gz && \
    tar -xzf /tmp/zerotier-one.tar.gz && \
    mv "ZeroTierOne-${ZEROTIER_ONE_REF}" ZeroTierOne && \
    rm /tmp/zerotier-one.tar.gz

RUN echo "build zerotier..." && \
    cd /opt/ZeroTierOne && \
    make -j"$ZEROTIER_MAKE_JOBS" ZT_EMBEDDED=1 ZT_SSO_SUPPORTED=0 one > /dev/null && \
    install -m 0755 zerotier-one /usr/sbin/zerotier-one && \
    ln -sf /usr/sbin/zerotier-one /usr/sbin/zerotier-idtool && \
    ln -sf /usr/sbin/zerotier-one /usr/sbin/zerotier-cli && \
    mkdir -p /tmp/zerotier-libs && \
    cp /usr/lib/*-linux-gnu/libssl* /tmp/zerotier-libs/ && \
    cp /usr/lib/*-linux-gnu/libcrypto* /tmp/zerotier-libs/ && \
    mkdir -p /var/lib/zerotier-one && \
    cd /var/lib/zerotier-one && \
    zerotier-idtool generate identity.secret identity.public && \
    zerotier-idtool initmoon identity.public >moon.json
ADD ./patch /app/patch
ARG planet
RUN cd /app/patch && \
    python3 patch.py  && \
    cd /var/lib/zerotier-one  && \
    zerotier-idtool genmoon moon.json  && \
    mkdir moons.d  && \
    cp ./*.moon ./moons.d
RUN echo "compile planet..." && \
    cd /opt/ZeroTierOne/attic/world/ && sh build.sh > /dev/null && \
    cd /opt/ZeroTierOne/attic/world/ && ./mkworld > /dev/null && \
    mkdir /app/bin -p && cp world.bin /app/bin/planet && \
    cp /app/bin/planet /var/lib/zerotier-one/planet

FROM ${NODE_IMAGE} AS build-ztncui
WORKDIR /app/ztncui/src
COPY ztncui/src/package.json ztncui/src/package-lock.json ./
RUN npm ci --omit=dev
COPY ztncui/src /app/ztncui/src

FROM ${NODE_IMAGE}
COPY --from=build-planet /var/lib/zerotier-one/ /var/lib/zerotier-one/
COPY --from=build-planet /usr/sbin/zero* /usr/bin/
COPY --from=build-planet /tmp/zerotier-libs/ /usr/lib/
COPY --from=build-ztncui /app/ztncui /app/ztncui
COPY init.sh /
RUN chmod +x /init.sh && mkdir -p /app/frontend/build
EXPOSE 9993/udp
EXPOSE 4000/tcp
ENV NODE_ENV=production
ENV LD_LIBRARY_PATH=/usr/lib
#VOLUME /var/lib/zerotier-one/controller.d /app/backend/data
ENTRYPOINT ["/init.sh"]

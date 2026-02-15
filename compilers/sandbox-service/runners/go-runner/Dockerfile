FROM golang:1.22-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove

RUN useradd -m -u 2000 -s /usr/sbin/nologin sandbox

RUN mkdir -p /sandbox /tmp && \
    chown sandbox:sandbox /sandbox /tmp && \
    chmod 755 /sandbox /tmp

USER sandbox
WORKDIR /sandbox

ENV GOCACHE=/tmp/.cache/go-build \
    GOPATH=/tmp/go

CMD ["go"]
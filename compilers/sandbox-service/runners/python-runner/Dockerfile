FROM python:3.11-slim

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

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

CMD ["python3"]
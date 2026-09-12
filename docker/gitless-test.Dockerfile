FROM node:22-bookworm-slim

# Debian slim + Node만 두고 Git은 넣지 않습니다 (Git 설치 플로우 수동 검증용).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN if command -v git >/dev/null 2>&1; then echo "unexpected: git already on PATH"; exit 1; fi

WORKDIR /workspace

COPY . .

RUN corepack enable pnpm \
  && pnpm install --frozen-lockfile

RUN pnpm build \
  && pnpm prune --prod \
  && if command -v git >/dev/null 2>&1; then echo "unexpected: git after build"; exit 1; fi

CMD ["bash", "-il"]

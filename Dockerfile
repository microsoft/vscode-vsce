FROM node:14-alpine
RUN apk add --update-cache \
    libsecret \
  && rm -rf /var/cache/apk/*
WORKDIR /opt/vsce
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run compile
RUN rm package-lock.json tsconfig.json
VOLUME /workspace
WORKDIR /workspace
ENTRYPOINT ["/opt/vsce/vsce"]

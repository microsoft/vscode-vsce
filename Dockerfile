FROM node:12-alpine
VOLUME /usr/share/vsce
WORKDIR /src
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY . .
RUN yarn compile
WORKDIR /usr/share/vsce
ENTRYPOINT ["/src/out/vsce"]
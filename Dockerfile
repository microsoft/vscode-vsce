FROM node:12-alpine
WORKDIR /opt/vsce
COPY package.json .
COPY yarn.lock .
RUN yarn
COPY . .
RUN yarn compile
VOLUME /workspace
WORKDIR /workspace
ENTRYPOINT ["/opt/vsce/out/vsce"]
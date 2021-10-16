FROM node:12-alpine
WORKDIR /opt/vsce
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run compile
RUN rm package-lock.json tsconfig.json
VOLUME /workspace
WORKDIR /workspace
ENTRYPOINT ["/opt/vsce/vsce"]
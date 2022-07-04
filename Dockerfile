FROM registry.qtmsheep.com/vagahbond/olaf:node as build

WORKDIR /usr/src/app

COPY src ./src
COPY *.json ./
COPY *.js ./

RUN npm ci
RUN npm run build

FROM build as prod

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./

ENTRYPOINT ["npm", "start"]
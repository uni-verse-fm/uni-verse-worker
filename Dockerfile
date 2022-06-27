FROM registry.qtmsheep.com/vagahbond/olaf:latest

RUN apt-get update

RUN apt-get -y install nodejs npm

COPY . .

WORKDIR /usr/src/app

ENTRYPOINT [ "npm", "run", "start" ]


FROM node:current-alpine3.19
LABEL authors="N08IK0"

WORKDIR /app/

RUN npm i --save-prod
ENTRYPOINT node build/index.js
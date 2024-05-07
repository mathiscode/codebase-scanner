FROM node:latest

RUN apt-get update && apt-get install -y git
WORKDIR /usr/src/app
COPY entrypoint.sh /usr/src/app
RUN chmod +x /usr/src/app/entrypoint.sh

# Define entrypoint
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

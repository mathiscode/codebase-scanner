FROM node:22
RUN apt-get update && apt-get install -y git
WORKDIR /usr/src/app
COPY scan-git-repo.sh /usr/src/app
RUN chmod +x /usr/src/app/scan-git-repo.sh
ENTRYPOINT ["/usr/src/app/scan-git-repo.sh"]

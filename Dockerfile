FROM    centos:centos6

# Enable EPEL for Node.js
RUN     rpm -Uvh http://download.fedoraproject.org/pub/epel/6/i386/epel-release-6-8.noarch.rpm

# Install Node.js and npm
RUN     yum install -y npm

# Bundle app source
COPY ./HW3 /HW3

# Install app dependencies
RUN cd /HW3; npm install

EXPOSE 8080 3000-3100 6379
CMD ["node", "/HW3/main.js"]
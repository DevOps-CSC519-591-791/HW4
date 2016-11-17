# HW4
CSC791-Devops-HW4 

Screencast: [link](https://www.youtube.com/watch?v=h-qRgHS8gUA)

```
docker-compose build
docker-compose up
bash container-creator.sh [num of scale service]
redis-bash-cli -h $REDIS_IP SMEMBERS serverSet

docker build -f Dockerfile-container-with-socat -t container-with-socat .
docker build -f Dockerfile-container-with-curl -t container-with-curl .
docker run -d --name container-with-socat container-with-socat
docker run -it --rm --name container-with-curl --link container-with-socat container-with-curl /bin/bash
curl container-with-socat:9001
```

### Prerequisite
#### HW4 file structure
```
.
├── App
│   ├── app.js
│   ├── img
│   ├── package.json
│   ├── README.md
│   └── uploads
├── container-creator.sh
├── docker-compose.yml
├── Dockerfile-app
├── Dockerfile-container-with-curl
├── Dockerfile-container-with-socat
├── Dockerfile-proxy
├── post-receive
├── Proxy
│   ├── package.json
│   ├── proxy.js
│   └── README.md
├── README.md
├── redis-bash
└── Simple-nodejs-app
```

 - Folder `App` stores files from HW#.
 - File `container-creator.sh` is used to spawn/scale a new container.
 - File `docker-compose.yml` is the configuration file of docker-compose.
 - File `Dockerfile-app` is the dockerfile to build the app service docker image.
 - File `Dockerfile-proxy` is the dockerfile to build the proxy service docker image.
 - File `Dockerfile-container-with-socat` is the dockerfile to build the container-with-socat docker image.
 - File `Dockerfile-container-with-curl` is the dockerfile to build the container-with-curl docker image.
 - File `post-receive` is the hook used in task2.
 - Folder `Proxy` stores files for proxy server.
 - Folder `redis-bash` is the bash library used to access redis from bash script directly.
 - Folder `Simple-nodejs-app` stores a simple node.js application used in task2.

### TASK1: `Docker Compose`
**Requirement:**
 - Setup a container for redis.
 - Setup a container for proxy.
 - Setup a container for node app.
 - Modify infrastructure.js to spawn new containers instead of new servers.

I created a `docker-compose.yml` file using the version 2 syntax. Below is the content of the file.
```
version: '2'
services:
    proxy:
        build:
            context: .
            dockerfile: Dockerfile-proxy
        links:
            - app
            - redis
        ports:
            - "8080:8080"
    app:
        image: hw4_app
        links:
            - redis
        ports:
            - "3000"
    redis:
        image: redis
        ports:
            - "6379:6379"
```
As you can see I listed 3 services, which are proxy, app and redis. 

For `redis service`, I told docker to use the existing redis image, then docker will find the running container using redis image during composing. In this way, we did not need to build redis image and run its container each time during composing, which will save a lot of time. What's more, since we need to keep using the data store in redis. It is good for redis container to keep running. And I also exposed the `6379` port on redis container and mapped to the `6379` port on host machine.

For `app service`, actually it is almost the same content as HW3. The only difference is I extracted the proxy server part to another docker container. During composing I will also using the existing app image in order to saving time. If you want to refuild the app image, you can always use [Dockerfile-app](https://github.ncsu.edu/zhu6/HW4/blob/master/Dockerfile-app) to achieve it. I linked the app service to redis service. And I exposed the `3000` port on app container and mapped it to a random port on host machine. It is good for proxying purpose. 
 > I want to scale app containers. My "scaled" containers are idential and I want to load balance across them. So I can link these app containers to the proxy container and do not bind app containers' ports to the host machine's ports. Instead, I can always call host entry plus port to access different containers (eg. for example `hw4_app_1:3000` in this case).
 
 For `proxy service`, I tried to build a new image and run it each time exectuing `docker-compose build`. And I will use [Dockerfile-proxy](https://github.ncsu.edu/zhu6/HW4/blob/master/Dockerfile-proxy) in current directory to build the image. Also, I linked the proxy service with app service and redis service. And I exposed the `8080` port on proxy container and mapped it to `8080` port on host machine.
 
 For `spawn new containers`, I wrote [container-creator.sh](https://github.ncsu.edu/zhu6/HW4/blob/master/container-creator.sh) to achieve this goal. (It is not a good idea and violate the docker design rule to create a new container from another container.) Below is the content of the bash script.
```
# obtain redis container ip
REDIS_IP=`docker inspect --format '{{ .NetworkSettings.Networks.hw4_default.IPAddress }}' $(docker ps -aqf "name=redis")`

echo 'Count current number of ips'
NUM_OF_IP=$1

# generate new port
NEW_PORT="300$NUM_OF_IP"
echo "Generate new port $NEW_PORT"

echo 'Scale one more `app` container'
docker-compose scale app=$((NUM_OF_IP+1))

echo 'Sleep 5 seconds'
sleep 5

echo 'Add port to redis'
for i in `seq 1 $1`; do
	redis-bash-cli -h $REDIS_IP SADD serverSet "300$i"
done
```

I first tried to get the redis container ip address and read the current number of ips from the first argument of command.

> Actually the ip address of docker container starts from `172.18.0.1` and increase one when a new container is built. But hard-coded ip address is not a decent way.

 After that I will generate a new port and use `docker-compose scale` to scale the app service to certain number. And at last I will add ports to redis key (serverSet). I used the [redis-bash-cli](https://github.com/caquino/redis-bash) to access redis from bash script directly. For some reason, after docker-compose scale, the data in redis will be reset. So when I add ports to redis key, I will actually enter a loop and add the original and new ports one by one to keep the data consistency (You can check the content of serverSet key in redis by running the command `redis-bash-cli -h $REDIS_IP SMEMBERS serverSet`). You can run the script of spawn/scale new container by the command `bash container-creator.sh [num of scale service]`.

> eg. For first time spawn/scale an app container, I can run the command `bash container-creator.sh 1`. It will tell the bash script that the current number of ip is 1 and the newly-generated port is `3001`. Also, docker-compose will scale the app container to 2. Since there is one app container is already running after `docker-compose up`, scale the app container to 2 is actually add another app containers. And the script will also keep data in redis consist. For next time you want to spawn/scale an app container, you can just run the command `bash container-creator.sh 2`.

### TASK2: `Docker Deploy`
**Requirement:**
 - On post-receive will build a new docker image.
 - Push to local registery.
 - Deploy the dockerized simple node.js App. Add appropriate hook commands to pull from registery, stop, and restart containers.
 
Basically, I wrote a [post-receive](https://github.ncsu.edu/zhu6/HW4/blob/master/post-receive) hook to meet all the requirements.

> Since post-receive hook is triggered after entire process is completed (after the server receive `git push` in this case). You have to put this hook at the server end.

Below is the detail of this hook.
```
#!/bin/sh
cd /home/expertiza_developer/DevOps/HW4/Simple-nodejs-app/

echo '=======Stop, untag and remove existing image=========='
docker stop app
docker rmi localhost:5000/ncsu:current
docker rmi localhost:5000/ncsu:latest
docker rmi ncsu-app:latest

# build image
echo '=======Build image=========='
docker build -t ncsu-app .

# tag image correctly first with registry host, which is localhost:5000 here
echo '=======Tag image first with registry host=========='
docker tag ncsu-app localhost:5000/ncsu:latest

# push image to local private registry
echo '=======Push image to local registry=========='
docker push localhost:5000/ncsu:latest

# make new directory
echo '=======Make new directory=========='
rm -rf /home/expertiza_developer/DevOps/HW4/Simple-nodejs-app-deployed/
mkdir /home/expertiza_developer/DevOps/HW4/Simple-nodejs-app-deployed/
cd /home/expertiza_developer/DevOps/HW4/Simple-nodejs-app-deployed/

echo '=======Pull image from local registry=========='
docker pull localhost:5000/ncsu:latest

echo '=======Stop and remove existing container and image=========='
docker stop app
docker rm app
docker rmi localhost:5000/ncsu:current

echo '=======Tag a new name to pulled image=========='
docker tag localhost:5000/ncsu:latest localhost:5000/ncsu:current

echo '=======Run docker on 0.0.0.0:8081=========='
docker run -p 8081:8080 -d --name app localhost:5000/ncsu:current
```

Basically, I did following things in this hook:
 - Stop, untag and remove existing image
 - Build a new docker image tagged ncsu-app
 - Tag image ncsu-app to localhost:5000/ncsu:latest
 - Push image to local registry
 - Make a new directory locally to mock the remote server
 - Pull image from local registry
 - Stop and remove existing container and image
 - Tag a new name to pulled image
 - Run docker on port 8080 and map port 8080 in container to port 8081 on host machine
 
After that you can access the app from broswer with the address `0.0.0.0:8081`.

### TASK3: `File IO`
**Requirement:**
 - Create a container that runs a command that outputs to a file.
 - Use socat to map file access to read file container and expose over port 9001 (hint can use SYSTEM + cat).
 - Use a linked container that access that file over network. The linked container can just use a command such as curl to access data from other container.
 
For this task, I build two docker images by using [Dockerfile-container-with-socat](Dockerfile-container-with-socat) and [Dockerfile-container-with-curl](https://github.ncsu.edu/zhu6/HW4/blob/master/Dockerfile-container-with-curl).

For `container-with-socat`, the content of its dockerfile is shown below:
```
FROM ubuntu:14.04
RUN apt-get -y update
RUN apt-get -y install socat
RUN echo "People are awesome!" > output
CMD socat TCP-LISTEN:9001 SYSTEM:'cat output'
```

The container-with-socat docker image is based on Ubuntu 14.04. And I installed socat in it and also wrote a sentence to a file named output. Then I wrote `CMD socat TCP-LISTEN:9001 SYSTEM:'cat output'` this line to use socat to map file access to another container and expose over port 9001. I built this image by the command `docker build -f Dockerfile-container-with-socat -t container-with-socat .` and I ran the container in the background by the command `docker run -d --name container-with-socat container-with-socat`.

For `container-with-curl`, the content of its dockerfile is below:
```
FROM ubuntu:14.04
RUN apt-get -y update
RUN apt-get -y install curl
```

The container-with-curl docker image is also based to Ubuntu 14.04. And I installed curl to access the data from container-with-socat. I build this image by the command `docker build -f Dockerfile-container-with-curl -t container-with-curl .` and I ran the container and enter its terminal by the command `docker run -it --rm --name container-with-curl --link container-with-socat container-with-curl /bin/bash`. Then I can run the command `curl container-with-socat:9001` in terminal, and I will get `People are awesome!`, which is written in output file.

#### Tips for Docker Compose
Docker compose can use host entries created by docker in `/etc/hosts`. In this homework, I used `redis` instead of `127.0.0.1` in [/App/app.js#L12](https://github.ncsu.edu/zhu6/HW4/blob/master/App/app.js#L12) and used `hw4_app_[num]` instead of `0.0.0.0` in [/Proxy/proxy.js#L15](https://github.ncsu.edu/zhu6/HW4/blob/master/Proxy/proxy.js#L15).

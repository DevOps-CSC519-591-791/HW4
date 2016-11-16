# HW4
CSC791-Devops-HW4 


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
# redis-bash-cli -h $REDIS_IP SADD serverSet $NEW_PORT
for i in `seq 1 $1`; do
	redis-bash-cli -h $REDIS_IP SADD serverSet "300$i"
done
```

I first tried to get the redis container ip address and read the current number of ips from the first argument of command. After that I will generate a new port and use `docker-compose scale` to scale the app service to certain number. And at last I will add ports to redis key (serverSet). For some reason, after docker-compose scale, the data in redis will be reset. So when I add ports to redis key, I will actually enter a loop and add the original and new ports one by one to keep the data consistency. You can run the script by the command `bash container-creator.sh [num of scale service]`.

> eg. For first time spawn/scale an app container, I can run the command `bash container-creator.sh 1`. It will tell the bash script that the current number of ip is 1 and the newly-generated port is `3001`. Also, docker-compose will scale the app container to 2. Since there is one app container is already running after `docker-compose up`, scale the app container to 2 is actually add another app containers. And the script will also keep data in redis consist. For next time you want to spawn/scale an app container, you can just run the command `bash container-creator.sh 2`.

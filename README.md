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

#!/bin/bash

# 兼容 sh/bash 的写法
SCRIPT_DIR=$(cd "$(dirname "${0}")" && pwd)

echo "参数总个数：$#"

IMAGE_VERSION='latest'
ALIYUN_PREFIX='crpi-npw0av7ozhtwtzou.cn-hangzhou.personal.cr.aliyuncs.com/memos_meetmonth/memos:'

echo "当前工作目录：$(pwd)"

export http_proxy=http://192.168.19.1:27890
export https_proxy=http://192.168.19.1:27890

cd $SCRIPT_DIR
# 先进行缓存配置
./build.sh

# 重新编译前端
cd ../web
pnpm build

echo "正在将前端产物复制到后端目录..."
rm -rf ../server/router/frontend/dist
mv dist ../server/router/frontend/

# 进入memos目录
cd ../

# 
docker buildx build -t memos:ai \
--platform linux/amd64 \
--build-arg VERSION=$IMAGE_VERSION \
--build-arg COMMIT=$(git rev-parse --short HEAD) \
-f ./scripts/Dockerfile \
--load .

echo 'Zzy521hyy' | docker login --username=z9z9y2 --password-stdin crpi-npw0av7ozhtwtzou.cn-hangzhou.personal.cr.aliyuncs.com

docker tag memos:ai $ALIYUN_PREFIX$IMAGE_VERSION

docker push $ALIYUN_PREFIX$IMAGE_VERSION

docker rmi memos:ai  crpi-npw0av7ozhtwtzou.cn-hangzhou.personal.cr.aliyuncs.com/memos_meetmonth/memos:$IMAGE_VERSION
# crpi-npw0av7ozhtwtzou.cn-hangzhou.personal.cr.aliyuncs.com/memos_meetmonth/memos:$IMAGE_VERSION
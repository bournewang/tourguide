#!/bin/sh

if [ $# -ne 2 ]; then
    echo "this script will compress the image to 900px width and 80% quality"
    echo "Usage: $0 <image_file> <output_file>"
    echo "Example: $0 ~/Downloads/zhonglou-1.jpg 钟楼.jpg"
    exit 1
fi

echo "compressing $1 to $2"
echo "magick $1 -resize 900x -quality 80 $2"
magick $1 -resize 900x -quality 80 $2

if [ -f $2 ]; then
    echo "$2 successfully compressed"
else
    echo "failed to compress $1 to $2"
    exit 1
fi
#!/bin/bash

# Usage: sh scripts/list_empty_spot_folders.sh <scenic-area-folder>
# Example: sh scripts/list_empty_spot_folders.sh public/assets/images/中岳庙/

if [ -z "$1" ]; then
  echo "Usage: $0 <scenic-area-folder>"
  exit 1
fi

AREA_DIR="$1"

if [ ! -d "$AREA_DIR" ]; then
  echo "Directory not found: $AREA_DIR"
  exit 1
fi

echo "Empty folders under $AREA_DIR:" 
find "$AREA_DIR" -type d -empty 
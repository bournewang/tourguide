#!/usr/bin/env bash
set -euo pipefail

# Orchestrator: generate thumbnails and update spot JSON image fields in one go
# Usage:
#   scripts/update_spot_assets.sh [OPTIONS] <IMAGES_DIR> <AREA_NAME> <SPOTS_JSON_FILE>
#
# Options (passed through to create_thumbnails.sh):
#   -s, --size SIZE       Thumbnail size (default from create_thumbnails.sh)
#   -q, --quality NUM     JPEG quality 1-100 (default from create_thumbnails.sh)
#   -j, --json DIR        JSON directory for create_thumbnails.sh to optionally scan (optional)
#   -h, --help            Show this help
#
# Examples:
#   scripts/update_spot_assets.sh assets/henan/kaifeng/images 中国翰园 assets/henan/kaifeng/data/spots/hanyuan.json
#   scripts/update_spot_assets.sh -s 900x -q 80 assets/dengfeng/images 嵩阳书院 assets/dengfeng/data/spots/songyangshuyuan.json
#

SIZE=""
QUALITY=""
JSON_DIR=""

print_usage() {
  echo "Usage: $0 [OPTIONS] <IMAGES_DIR> <AREA_NAME> <SPOTS_JSON_FILE>"
  echo
  echo "Runs:"
  echo "  1) scripts/create_thumbnails.sh to generate thumbnails"
  echo "  2) scripts/add_image_sequence_to_spots.js to update image/thumbnail/imageSequence in JSON"
  echo
  echo "Options:"
  echo "  -s, --size SIZE       Thumbnail size (e.g. 300x200, 900x)"
  echo "  -q, --quality NUM     JPEG quality 1-100"
  echo "  -j, --json DIR        JSON directory for create_thumbnails.sh to optionally scan"
  echo "  -h, --help            Show this help"
  echo
  echo "Examples:"
  echo "  $0 assets/henan/kaifeng/images 中国翰园 assets/henan/kaifeng/data/spots/hanyuan.json"
  echo "  $0 -s 900x -q 80 assets/dengfeng/images 嵩阳书院 assets/dengfeng/data/spots/songyangshuyuan.json"
}

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--size)
      SIZE="$2"; shift 2 ;;
    -q|--quality)
      QUALITY="$2"; shift 2 ;;
    -j|--json)
      JSON_DIR="$2"; shift 2 ;;
    -h|--help)
      print_usage; exit 0 ;;
    --)
      shift; break ;;
    -*)
      echo "Unknown option: $1" >&2
      print_usage; exit 1 ;;
    *)
      break ;;
  esac
done

# Positional args
if [[ $# -lt 3 ]]; then
  echo "Missing required arguments" >&2
  print_usage
  exit 1
fi

IMAGES_DIR="$1"; shift
AREA_NAME="$1"; shift
SPOTS_JSON_FILE="$1"; shift

# Validation
if [[ ! -d "$IMAGES_DIR" ]]; then
  echo "Images directory not found: $IMAGES_DIR" >&2
  exit 1
fi
if [[ -z "$AREA_NAME" ]]; then
  echo "Area name is required" >&2
  exit 1
fi
if [[ ! -f "$SPOTS_JSON_FILE" ]]; then
  echo "Spots JSON file not found: $SPOTS_JSON_FILE" >&2
  exit 1
fi
if [[ ! -x "scripts/create_thumbnails.sh" ]]; then
  # Try to make it executable if present
  if [[ -f "scripts/create_thumbnails.sh" ]]; then
    chmod +x scripts/create_thumbnails.sh || true
  else
    echo "scripts/create_thumbnails.sh not found" >&2
    exit 1
  fi
fi

# Build args for create_thumbnails.sh
CREATE_ARGS=()
if [[ -n "$SIZE" ]]; then CREATE_ARGS+=("-s" "$SIZE"); fi
if [[ -n "$QUALITY" ]]; then CREATE_ARGS+=("-q" "$QUALITY"); fi
if [[ -n "$JSON_DIR" ]]; then CREATE_ARGS+=("-j" "$JSON_DIR"); fi

echo "[1/2] Generating thumbnails..."
./scripts/create_thumbnails.sh "$IMAGES_DIR" "$AREA_NAME"
echo "[1/2] Thumbnails generation completed."

echo "[2/2] Updating spots JSON with images and thumbnails..."
node scripts/add_image_sequence_to_spots.js "$SPOTS_JSON_FILE" "$AREA_NAME"
echo "[2/2] Spots JSON update completed."

echo
echo "All done."
echo "Images dir:   $IMAGES_DIR"
echo "Area name:    $AREA_NAME"
echo "Spots JSON:   $SPOTS_JSON_FILE"

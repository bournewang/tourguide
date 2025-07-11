#!/bin/bash

# Convert all images (including HEIC) to JPG format: 900px width, under 200KB
# Usage: ./convert_to_jpg.sh [source_directory] [destination_directory]
# Supports: JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, TIF, HEIC, HEIF
# Method: Resize to 900px width, adjust quality starting from 70%

# Default directories
SOURCE_DIR="${1:-.}"
DEST_DIR="${2:-converted}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Image Format Converter ===${NC}"
echo -e "Source directory: ${YELLOW}$SOURCE_DIR${NC}"
echo -e "Destination directory: ${YELLOW}$DEST_DIR${NC}"
echo ""

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo -e "${RED}Error: ImageMagick is not installed.${NC}"
    echo "Please install ImageMagick first:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  CentOS/RHEL: sudo yum install ImageMagick"
    exit 1
fi

# Check if ImageMagick supports HEIC format
echo -e "${BLUE}Checking HEIC support...${NC}"
if magick -list format | grep -qi "heic\|heif"; then
    echo -e "${GREEN}✓${NC} HEIC/HEIF format support detected"
else
    echo -e "${YELLOW}⚠${NC} HEIC/HEIF support not detected in ImageMagick"
    echo -e "  For HEIC support, install with: ${YELLOW}brew install imagemagick --with-heif${NC} (macOS)"
    echo -e "  Or install libheif development packages on Linux"
    echo -e "  Script will continue but HEIC files may fail to convert"
fi

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: Source directory '$SOURCE_DIR' does not exist.${NC}"
    exit 1
fi

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

# Count total images
echo -e "${BLUE}Scanning for images...${NC}"
TOTAL_IMAGES=$(find "$SOURCE_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" -o -iname "*.gif" -o -iname "*.bmp" -o -iname "*.tiff" -o -iname "*.tif" -o -iname "*.heic" -o -iname "*.heif" \) | wc -l)

if [ "$TOTAL_IMAGES" -eq 0 ]; then
    echo -e "${YELLOW}No images found in source directory.${NC}"
    exit 0
fi

echo -e "Found ${GREEN}$TOTAL_IMAGES${NC} images to convert"
echo ""

# Initialize counters
CONVERTED=0
SKIPPED=0
FAILED=0

# Function to convert a single image
convert_image() {
    local input_file="$1"
    local filename=$(basename "$input_file")
    local name_without_ext="${filename%.*}"
    local output_file="$DEST_DIR/${name_without_ext}.jpg"
    
    # Skip if output file already exists and is newer than input
    if [ -f "$output_file" ] && [ "$output_file" -nt "$input_file" ]; then
        echo -e "  ${YELLOW}SKIP${NC} $filename (already converted)"
        ((SKIPPED++))
        return 0
    fi
    
    # Convert image to JPG with compression
    if compress_to_jpg "$input_file" "$output_file"; then
        echo -e "  ${GREEN}✓${NC} $filename → ${name_without_ext}.jpg"
        ((CONVERTED++))
    else
        echo -e "  ${RED}✗${NC} $filename (conversion failed)"
        ((FAILED++))
    fi
}

# Function to compress image to under 200KB with 900px width
compress_to_jpg() {
    local input_file="$1"
    local output_file="$2"
    local max_size=200000  # 200KB in bytes
    local target_width=900 # Target width in pixels
    
    # Resize to 900px width and try different quality levels
    for quality in 70 65 60 55 50 45 40 35 30 25 20; do
        if magick "$input_file" -resize "${target_width}x" -quality $quality "$output_file" 2>/dev/null; then
            local file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
            
            if [ "$file_size" -le "$max_size" ]; then
                echo -e "    (resized to ${target_width}px width, quality: $quality, size: ${file_size} bytes)"
                return 0
            fi
        fi
    done
    
    # If still too large, return error
    echo -e "    (unable to compress to target size)"
    return 1
}

# Process all images
echo -e "${BLUE}Converting images...${NC}"
# Create a temporary file with the list of images
temp_file_list=$(mktemp)
find "$SOURCE_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" -o -iname "*.gif" -o -iname "*.bmp" -o -iname "*.tiff" -o -iname "*.tif" -o -iname "*.heic" -o -iname "*.heif" \) > "$temp_file_list"

while IFS= read -r file; do
    convert_image "$file"
done < "$temp_file_list"

rm -f "$temp_file_list"

echo ""
echo -e "${BLUE}=== Conversion Summary ===${NC}"
echo -e "Total images found: ${GREEN}$TOTAL_IMAGES${NC}"
echo -e "Successfully converted: ${GREEN}$CONVERTED${NC}"
echo -e "Skipped (already converted): ${YELLOW}$SKIPPED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""
echo -e "Converted images saved to: ${YELLOW}$DEST_DIR${NC}"

# Show file count by format in destination
if [ -d "$DEST_DIR" ]; then
    echo ""
    echo -e "${BLUE}Destination directory contents:${NC}"
    jpg_count=$(find "$DEST_DIR" -name "*.jpg" | wc -l)
    echo -e "JPG files: ${GREEN}$jpg_count${NC}"
    
    # Show compression statistics
    if [ "$jpg_count" -gt 0 ]; then
        echo ""
        echo -e "${BLUE}Compression Statistics:${NC}"
        
        # Calculate total size and average size using a temporary file
        temp_stats=$(mktemp)
        find "$DEST_DIR" -name "*.jpg" -exec stat -f%z {} \; 2>/dev/null | awk '
        BEGIN { total = 0; large = 0; count = 0 }
        {
            total += $1
            count++
            if ($1 > 200000) large++
        }
        END {
            if (count > 0) {
                avg = total / count
                printf "Total size: %.1f KB\n", total/1024
                printf "Average file size: %.1f KB\n", avg/1024
                printf "Files over 200KB: %d\n", large
            }
        }' > "$temp_stats"
        
        if [ -s "$temp_stats" ]; then
            while IFS= read -r line; do
                if [[ "$line" == "Total size:"* ]]; then
                    echo -e "Total size: ${GREEN}${line#Total size: }${NC}"
                elif [[ "$line" == "Average file size:"* ]]; then
                    echo -e "Average file size: ${GREEN}${line#Average file size: }${NC}"
                elif [[ "$line" == "Files over 200KB:"* ]]; then
                    echo -e "Files over 200KB: ${YELLOW}${line#Files over 200KB: }${NC}"
                fi
            done < "$temp_stats"
        fi
        
        rm -f "$temp_stats"
    fi
fi 
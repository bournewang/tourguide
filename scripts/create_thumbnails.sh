#!/bin/bash

# Script to create thumbnails for all spot images
# This script will process all images in public/spots/ directories and create optimized thumbnails

set -e  # Exit on any error

# Configuration
IMAGES_DIR="assets/dengfeng/images"
THUMBS_DIR="assets/dengfeng/thumb"
THUMB_SUFFIX=""  # No suffix needed since they're in separate directory
THUMB_SIZE="300x200"  # Width x Height for thumbnails
QUALITY=85           # JPEG quality (1-100)
SUPPORTED_FORMATS=("jpg" "jpeg" "png" "webp" "gif")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if ImageMagick is installed
check_imagemagick() {
    if ! command -v convert &> /dev/null; then
        print_error "ImageMagick is not installed. Please install it first:"
        echo "  macOS: brew install imagemagick"
        echo "  Ubuntu: sudo apt-get install imagemagick"
        echo "  CentOS: sudo yum install ImageMagick"
        exit 1
    fi
    
    print_success "ImageMagick is installed"
}

# Check if spots directory exists
check_images_directory() {
    if [ ! -d "$IMAGES_DIR" ]; then
        print_error "Images directory '$IMAGES_DIR' does not exist"
        exit 1
    fi
    
    print_success "Found images directory: $IMAGES_DIR"
}

# Function to create thumbnail
create_thumbnail() {
    local input_file="$1"
    local output_file="$2"
    
    # Skip if thumbnail already exists and is newer than source
    if [ -f "$output_file" ] && [ "$output_file" -nt "$input_file" ]; then
        print_warning "Thumbnail already exists and is up to date: $output_file"
        return 0
    fi
    
    # Create thumbnail with ImageMagick
    if magick "$input_file" \
        -resize "${THUMB_SIZE}^" \
        -gravity center \
        -extent "$THUMB_SIZE" \
        -quality "$QUALITY" \
        -strip \
        "$output_file"; then
        
        # Get file sizes
        local original_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file" 2>/dev/null)
        local thumb_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
        local reduction=$((100 - (thumb_size * 100 / original_size)))
        
        print_success "Created thumbnail: $(basename "$output_file") (${reduction}% smaller)"
        return 0
    else
        print_error "Failed to create thumbnail for: $input_file"
        return 1
    fi
}

# Function to process images in a directory
process_spot_directory() {
    local spot_dir="$1"
    # This will be <area-name>/<spot-name>
    local relative_path=${spot_dir#"$IMAGES_DIR/"}
    local thumb_dir="$THUMBS_DIR/$relative_path"
    local processed=0
    local failed=0
    
    print_status "Processing spot: $relative_path"
    
    # Create thumbnail directory if it doesn't exist
    if [ ! -d "$thumb_dir" ]; then
        mkdir -p "$thumb_dir"
        print_status "  Created thumbnail directory: $thumb_dir"
    fi
    
    # Find all supported image files
    for format in "${SUPPORTED_FORMATS[@]}"; do
        # Process both lowercase and uppercase extensions
        for ext in "$format" "$(echo "$format" | tr '[:lower:]' '[:upper:]')"; do # e.g., jpg and JPG
            for image_file in "$spot_dir"/*."$ext"; do
                # Skip if no files match the pattern
                [ ! -f "$image_file" ] && continue
                
                # if original image is not a jpg, rename it to jpg
                if [ "$ext" != "jpg" ]; then
                    local new_filename="${filename%.*}"
                    local new_path="$spot_dir/$new_filename.jpg"
                    mv "$image_file" "$new_path"
                    image_file="$new_path"
                fi
                # Generate thumbnail filename (remove suffix, keep original name)
                local filename=$(basename "$image_file")
                local name_without_ext="${filename%.*}"
                local thumb_filename="${name_without_ext}.jpg"  # Always save as JPG
                local thumb_path="$thumb_dir/$thumb_filename"

                # skip if thumbnail already exists
                if [ -f "$thumb_path" ]; then
                    print_warning "Thumbnail already exists: $thumb_path"
                    continue
                fi
                
                print_status "  Processing: $filename"
                
                if create_thumbnail "$image_file" "$thumb_path"; then
                    ((processed++))
                    # Break after creating first thumbnail
                    # break 3  # Break out of all nested loops
                    echo "Processed: $filename"
                else
                    ((failed++))
                fi
            done
        done
    done
    
    if [ $processed -gt 0 ]; then
        print_success "Processed $processed images in $relative_path"
    fi
    
    if [ $failed -gt 0 ]; then
        print_error "Failed to process $failed images in $relative_path"
    fi
    
    if [ $processed -eq 0 ] && [ $failed -eq 0 ]; then
        print_warning "No images found in $relative_path"
    fi
    
    return $failed
}

# Function to update JSON files with thumbnail paths
update_json_files() {
    print_status "Updating JSON files with thumbnail paths..."
    
    # Find all JSON files in src/data/spots/
    local json_dir="public/data/spots"
    local updated_files=0
    
    if [ ! -d "$json_dir" ]; then
        print_warning "JSON directory '$json_dir' not found, skipping JSON updates"
        return 0
    fi
    
    for json_file in "$json_dir"/*.json; do
        [ ! -f "$json_file" ] && continue
        
        local spot_name=$(basename "$json_file" .json)
        local thumb_dir="$THUMBS_DIR/$spot_name"
        
        # Find the first thumbnail in the spot directory
        local first_thumb=""
        for thumb_file in "$thumb_dir"/*.jpg; do
            if [ -f "$thumb_file" ]; then
                first_thumb="/spots-thumb/$spot_name/$(basename "$thumb_file")"
                break
            fi
        done
        
        if [ -n "$first_thumb" ]; then
            # Create a backup of the JSON file
            cp "$json_file" "$json_file.bak"
            
            # Update the JSON file (this is a simple approach, might need refinement)
            print_status "  Updating $json_file with thumbnail: $first_thumb"
            
            # Note: This is a basic approach. For production, you might want to use jq or a proper JSON parser
            print_warning "  JSON update skipped - please manually update image_thumb paths in JSON files"
            ((updated_files++))
        fi
    done
    
    if [ $updated_files -gt 0 ]; then
        print_success "Found thumbnails for $updated_files JSON files"
    fi
}

# Main execution
main() {
    print_status "Starting thumbnail creation process..."
    print_status "Source Images: $IMAGES_DIR"
    print_status "Thumbnail Destination: $THUMBS_DIR"
    print_status "Thumbnail size: $THUMB_SIZE"
    print_status "Quality: $QUALITY%"
    echo
    
    # Check prerequisites
    check_imagemagick
    check_images_directory
    echo
    
    # Determine which areas to process
    local AREAS_TO_PROCESS=()
    if [ -n "$1" ]; then
        local AREA_NAME="$1"
        if [ -d "$IMAGES_DIR/$AREA_NAME" ]; then
            AREAS_TO_PROCESS=("$IMAGES_DIR/$AREA_NAME")
            print_status "Processing only area: $AREA_NAME"
        else
            print_error "Area directory '$IMAGES_DIR/$AREA_NAME' does not exist."
            exit 1
        fi
    else
        AREAS_TO_PROCESS=("$IMAGES_DIR"/*)
    fi
    
    # Process all spot directories within area directories
    local total_spots_processed=0
    local total_spots_failed=0
    
    for area_dir in "${AREAS_TO_PROCESS[@]}"; do
        if [ -d "$area_dir" ]; then
            print_status "Processing area: $(basename "$area_dir")"
            for spot_dir in "$area_dir"/*; do
                if [ -d "$spot_dir" ]; then
                    process_spot_directory "$spot_dir"
                    local exit_code=$?
                    if [ $exit_code -eq 0 ]; then
                        ((total_spots_processed++))
                    else
                        ((total_spots_failed++))
                    fi
                    echo
                fi
            done
        fi
    done
    
    # Update JSON files
    update_json_files
    echo
    
    # Summary
    print_status "=== SUMMARY ==="
    print_success "Processed spot directories: $total_spots_processed"
    if [ $total_spots_failed -gt 0 ]; then
        print_error "Failed spot directories: $total_spots_failed"
    fi
    
    print_status "Thumbnails are saved in a parallel directory structure: $THUMBS_DIR"
    print_status "You can now update your JSON data to use the new thumbnail paths."
    print_status "Example: \"image_thumb\": \"/images-thumb/spot-area/spot-name/image.jpg\""
    
    echo
    print_success "Thumbnail creation process completed!"
}

# Show help
show_help() {
    echo "Usage: $0 [OPTIONS] [AREA_NAME]"
    echo
    echo "Create thumbnails for all spot images in public/images/<area>/<spot>/ directories"
    echo "Thumbnails will be saved to public/images-thumb/<area>/<spot>/ with the same structure"
    echo
    echo "Options:"
    echo "  -s, --size SIZE     Thumbnail size (default: $THUMB_SIZE)"
    echo "  -q, --quality NUM   JPEG quality 1-100 (default: $QUALITY)"
    echo "  -h, --help          Show this help message"
    echo
    echo "Examples:"
    echo "  $0                           # Use default settings"
    echo "  $0 --size 400x300          # Custom thumbnail size"
    echo "  $0 --quality 90            # Higher quality"
    echo "  $0 --size 200x150 --quality 75  # Custom size and quality"
    echo "  $0 中岳庙                     # Process only the '中岳庙' area"
    echo
    echo "Output structure:"
    echo "  public/images/<area>/<spot>/image.jpg  ->  public/images-thumb/<area>/<spot>/image.jpg"
    echo
}

# Parse command line arguments
AREA_NAME=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--size)
            THUMB_SIZE="$2"
            shift 2
            ;;
        -q|--quality)
            QUALITY="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        --)
            shift
            break
            ;;
        -*)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            if [[ -z "$AREA_NAME" ]]; then
                AREA_NAME="$1"
                shift
            else
                print_error "Unknown option: $1"
                show_help
                exit 1
            fi
            ;;
    esac
done

# Validate quality parameter
if ! [[ "$QUALITY" =~ ^[0-9]+$ ]] || [ "$QUALITY" -lt 1 ] || [ "$QUALITY" -gt 100 ]; then
    print_error "Quality must be a number between 1 and 100"
    exit 1
fi

# Run main function
main "$AREA_NAME" 
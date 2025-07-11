#!/bin/bash

# Script to create thumbnails for all spot images
# This script will process all images in public/spots/ directories and create optimized thumbnails

set -e  # Exit on any error

# Configuration
SPOTS_DIR="public/spots"
THUMBS_DIR="public/spots-thumb"
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
check_spots_directory() {
    if [ ! -d "$SPOTS_DIR" ]; then
        print_error "Spots directory '$SPOTS_DIR' does not exist"
        exit 1
    fi
    
    print_success "Found spots directory: $SPOTS_DIR"
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
    if convert "$input_file" \
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
process_directory() {
    local dir="$1"
    local spot_name=$(basename "$dir")
    local thumb_dir="$THUMBS_DIR/$spot_name"
    local processed=0
    local skipped=0
    local failed=0
    
    print_status "Processing spot: $spot_name"
    
    # Create thumbnail directory if it doesn't exist
    if [ ! -d "$thumb_dir" ]; then
        mkdir -p "$thumb_dir"
        print_status "  Created thumbnail directory: $thumb_dir"
    fi
    
    # Find all supported image files
    for format in "${SUPPORTED_FORMATS[@]}"; do
        # Process both lowercase and uppercase extensions
        for ext in "$format" "$(echo "$format" | tr '[:lower:]' '[:upper:]')"; do
            for image_file in "$dir"/*."$ext"; do
                # Skip if no files match the pattern
                [ ! -f "$image_file" ] && continue
                
                # Generate thumbnail filename (remove suffix, keep original name)
                local filename=$(basename "$image_file")
                local name_without_ext="${filename%.*}"
                local thumb_filename="${name_without_ext}.jpg"  # Always save as JPG
                local thumb_path="$thumb_dir/$thumb_filename"
                
                print_status "  Processing: $filename"
                
                if create_thumbnail "$image_file" "$thumb_path"; then
                    ((processed++))
                else
                    ((failed++))
                fi
            done
        done
    done
    
    if [ $processed -gt 0 ]; then
        print_success "Processed $processed images in $spot_name"
    fi
    
    if [ $failed -gt 0 ]; then
        print_error "Failed to process $failed images in $spot_name"
    fi
    
    if [ $processed -eq 0 ] && [ $failed -eq 0 ]; then
        print_warning "No images found in $spot_name"
    fi
    
    return $failed
}

# Function to update JSON files with thumbnail paths
update_json_files() {
    print_status "Updating JSON files with thumbnail paths..."
    
    # Find all JSON files in src/data/spots/
    local json_dir="src/data/spots"
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
    print_status "Thumbnail size: $THUMB_SIZE"
    print_status "Quality: $QUALITY%"
    echo
    
    # Check prerequisites
    check_imagemagick
    check_spots_directory
    echo
    
    # Process all spot directories
    local total_processed=0
    local total_failed=0
    
    for spot_dir in "$SPOTS_DIR"/*; do
        if [ -d "$spot_dir" ]; then
            process_directory "$spot_dir"
            local exit_code=$?
            if [ $exit_code -eq 0 ]; then
                ((total_processed++))
            else
                ((total_failed++))
            fi
            echo
        fi
    done
    
    # Update JSON files
    update_json_files
    echo
    
    # Summary
    print_status "=== SUMMARY ==="
    print_success "Processed directories: $total_processed"
    if [ $total_failed -gt 0 ]; then
        print_error "Failed directories: $total_failed"
    fi
    
    print_status "Thumbnails are saved in separate directory structure: $THUMBS_DIR"
    print_status "You can now update your JSON files to use the thumbnail paths"
    print_status "Example: \"image_thumb\": \"/spots-thumb/景点名/图片名.jpg\""
    
    echo
    print_success "Thumbnail creation process completed!"
}

# Show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Create thumbnails for all spot images in public/spots/ directories"
    echo "Thumbnails will be saved to public/spots-thumb/ with same directory structure"
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
    echo
    echo "Output structure:"
    echo "  public/spots/景点名/图片.jpg  ->  public/spots-thumb/景点名/图片.jpg"
    echo
}

# Parse command line arguments
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
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate quality parameter
if ! [[ "$QUALITY" =~ ^[0-9]+$ ]] || [ "$QUALITY" -lt 1 ] || [ "$QUALITY" -gt 100 ]; then
    print_error "Quality must be a number between 1 and 100"
    exit 1
fi

# Run main function
main 
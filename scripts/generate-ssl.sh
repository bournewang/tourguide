#!/bin/bash

# Generate SSL certificates for local HTTPS development
echo "🔒 Generating SSL certificates for HTTPS development..."

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Generate private key
openssl genrsa -out ssl/server.key 2048

# Generate certificate signing request
openssl req -new -key ssl/server.key -out ssl/server.csr -subj "/C=CN/ST=Henan/L=Zhengzhou/O=TourGuide/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in ssl/server.csr -signkey ssl/server.key -out ssl/server.crt

# Clean up CSR file
rm ssl/server.csr

echo "✅ SSL certificates generated successfully!"
echo "📁 Certificates saved to:"
echo "   - ssl/server.key (private key)"
echo "   - ssl/server.crt (certificate)"
echo ""
echo "🚀 You can now run your server with HTTPS support"
echo "📱 iPhone Safari will now prompt for location permission!"
echo ""
echo "⚠️  Note: These are self-signed certificates"
echo "   - Browsers will show a security warning"
echo "   - Click 'Advanced' → 'Proceed to localhost' to accept"
echo "   - For production, use real SSL certificates from Let's Encrypt" 